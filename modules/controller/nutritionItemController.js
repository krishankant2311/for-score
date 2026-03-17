const { Admin } = require('../model/adminModel');
const NutritionItem = require('../model/nutritionItemModel');

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;

  const admin = await Admin.findById(admin_id);
  if (!admin) return null;
  if (admin.status === 'Deleted') return null;
  return admin;
};

// 1. Add Nutrition Item
const addNutritionItem = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const {
      name,
      category,
      mealType,
      calories,
      protein,
      carbs,
      fats,
      description,
      alternateFood,
    } = req.body;

    if (!name || !category || !mealType || !calories || !protein || !carbs || !fats || !description) {
      return res.status(400).json({
        success: false,
        message:
          'name, category, mealType, calories, protein, carbs, fats and description are required',
      });
    }

    const allowedCategories = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'category must be Breakfast, Lunch, Dinner or Snack',
      });
    }

    const allowedMealTypes = ['Vegetarian', 'Non-Vegetarian', 'Vegan'];
    if (!allowedMealTypes.includes(mealType)) {
      return res.status(400).json({
        success: false,
        message: 'mealType must be Vegetarian, Non-Vegetarian or Vegan',
      });
    }

    const imagePath = req.file ? req.file.path : '';

    const item = await NutritionItem.create({
      name: name.trim(),
      category,
      mealType,
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fats: Number(fats),
      description: description.trim(),
      alternateFood: (alternateFood || '').trim(),
      imagePath,
      createdBy: admin._id,
    });

    return res.json({
      success: true,
      message: 'Nutrition item added successfully',
      result: item,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// 2. Get all Nutrition Items (with filters)
const getAllNutritionItems = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const category = req.query.category;
    const mealType = req.query.mealType;
    const statusFilter = (req.query.status || 'active').toLowerCase();

    const query = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'i');
      query.name = regex;
    }
    if (category && ['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(category)) {
      query.category = category;
    }
    if (mealType && ['Vegetarian', 'Non-Vegetarian', 'Vegan'].includes(mealType)) {
      query.mealType = mealType;
    }
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'deleted') query.status = 'Deleted';

    const [items, total] = await Promise.all([
      NutritionItem.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NutritionItem.countDocuments(query),
    ]);

    return res.json({
      success: true,
      message: 'Nutrition items fetched successfully',
      result: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// 3. Get Nutrition Item by ID
const getNutritionItemById = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const item = await NutritionItem.findById(id).lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Nutrition item not found',
      });
    }

    return res.json({
      success: true,
      message: 'Nutrition item fetched successfully',
      result: item,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// 4. Update Nutrition Item
const updateNutritionItem = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const {
      name,
      category,
      mealType,
      calories,
      protein,
      carbs,
      fats,
      description,
      alternateFood,
      status,
    } = req.body;

    const item = await NutritionItem.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Nutrition item not found',
      });
    }

    if (name != null && name !== '') item.name = name.trim();
    if (category && ['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(category)) {
      item.category = category;
    }
    if (mealType && ['Vegetarian', 'Non-Vegetarian', 'Vegan'].includes(mealType)) {
      item.mealType = mealType;
    }
    if (calories != null && calories !== '') item.calories = Number(calories);
    if (protein != null && protein !== '') item.protein = Number(protein);
    if (carbs != null && carbs !== '') item.carbs = Number(carbs);
    if (fats != null && fats !== '') item.fats = Number(fats);
    if (description != null && description !== '') item.description = description.trim();
    if (alternateFood != null) item.alternateFood = (alternateFood || '').trim();
    if (status && ['Active', 'Deleted'].includes(status)) item.status = status;

    if (req.file) {
      item.imagePath = req.file.path;
    }

    await item.save();

    return res.json({
      success: true,
      message: 'Nutrition item updated successfully',
      result: item,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// 5. Soft delete Nutrition Item
const deleteNutritionItem = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const item = await NutritionItem.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Nutrition item not found',
      });
    }

    item.status = 'Deleted';
    await item.save();

    return res.json({
      success: true,
      message: 'Nutrition item deleted successfully',
      result: item,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// 6. Nutrition stats for admin header & tabs
const getNutritionStats = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const [total, active, inactive, veg, nonVeg, vegan] = await Promise.all([
      NutritionItem.countDocuments(),
      NutritionItem.countDocuments({ status: 'Active' }),
      NutritionItem.countDocuments({ status: 'Deleted' }),
      NutritionItem.countDocuments({ mealType: 'Vegetarian', status: 'Active' }),
      NutritionItem.countDocuments({ mealType: 'Non-Vegetarian', status: 'Active' }),
      NutritionItem.countDocuments({ mealType: 'Vegan', status: 'Active' }),
    ]);

    return res.json({
      success: true,
      message: 'Nutrition stats fetched successfully',
      result: {
        total,
        active,
        inactive,
        byMealType: {
          vegetarian: veg,
          nonVegetarian: nonVeg,
          vegan,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// 7. User: Get all active nutrition items
const getAllNutritionItemsForUser = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const items = await NutritionItem.find({ status: 'Active' })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Nutrition items fetched successfully',
      result: items,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// 8. User: Get single active nutrition item by id
const getNutritionItemByIdForUser = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;
    const item = await NutritionItem.findOne({ _id: id, status: 'Active' }).lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Nutrition item not found',
      });
    }

    return res.json({
      success: true,
      message: 'Nutrition item fetched successfully',
      result: item,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

module.exports = {
  addNutritionItem,
  getAllNutritionItems,
  getNutritionItemById,
  updateNutritionItem,
  deleteNutritionItem,
  getNutritionStats,
  getAllNutritionItemsForUser,
  getNutritionItemByIdForUser,
};

