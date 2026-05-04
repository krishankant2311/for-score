const { Admin } = require('../model/adminModel');
const Food = require('../model/foodModel');
const User = require('../model/userModel');

const allowedCategories = ['Protein', 'Carbs', 'Vegetables', 'Fruit', 'Fats', 'Other'];
const allowedMealTypes = ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Other'];

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;

  const admin = await Admin.findById(admin_id);
  if (!admin) return null;
  if (admin.status === 'Deleted') return null;
  return admin;
};

// 1. Admin - Add food in global catalog
const addFoodByAdmin = async (req, res) => {
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
      calories,
      protein,
      carbs,
      fats,
      category,
      mealType,
      servingSize,
    } = req.body;

    if (!name || !calories) {
      return res.status(400).json({
        success: false,
        message: 'name and calories are required',
      });
    }

    const food = await Food.create({
      createdByAdminId: admin._id,
      name: name.trim(),
      calories: Number(calories),
      protein: protein != null && protein !== '' ? Number(protein) : 0,
      carbs: carbs != null && carbs !== '' ? Number(carbs) : 0,
      fats: fats != null && fats !== '' ? Number(fats) : 0,
      category: category && allowedCategories.includes(category) ? category : 'Other',
      mealType: mealType && allowedMealTypes.includes(mealType) ? mealType : 'Other',
      servingSize: (servingSize || '').trim(),
    });

    return res.json({
      success: true,
      message: 'Food added successfully',
      result: food,
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

// 2. User - Get global food catalog (admin created)
const getAllFoods = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const category = req.query.category;
    const mealType = req.query.mealType;
    const query = { status: { $ne: 'Deleted' } };
    if (category && allowedCategories.includes(category)) query.category = category;
    if (mealType && allowedMealTypes.includes(mealType)) query.mealType = mealType;

    const foods = await Food.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Foods fetched successfully',
      result: foods,
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

// 3. User - Get single food by id
const getFoodById = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const food = await Food.findOne({ _id: id, status: { $ne: 'Deleted' } }).lean();

    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food not found',
      });
    }

    return res.json({
      success: true,
      message: 'Food fetched successfully',
      result: food,
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

// 4. Admin - Update food
const updateFoodByAdmin = async (req, res) => {
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
      calories,
      protein,
      carbs,
      fats,
      category,
      mealType,
      servingSize,
    } = req.body;

    const food = await Food.findOne({ _id: id, status: { $ne: 'Deleted' } });

    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food not found',
      });
    }

    if (name != null && name !== '') food.name = name.trim();
    if (calories != null && calories !== '') food.calories = Number(calories);
    if (protein != null && protein !== '') food.protein = Number(protein);
    if (carbs != null && carbs !== '') food.carbs = Number(carbs);
    if (fats != null && fats !== '') food.fats = Number(fats);
    if (category && allowedCategories.includes(category)) {
      food.category = category;
    }
    if (mealType && allowedMealTypes.includes(mealType)) {
      food.mealType = mealType;
    }
    if (servingSize != null) food.servingSize = servingSize.trim();

    await food.save();

    return res.json({
      success: true,
      message: 'Food updated successfully',
      result: food,
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

// 5. Admin - Soft delete food
const deleteFoodByAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const food = await Food.findByIdAndUpdate(id, { status: 'Deleted' }, { new: true }).lean();

    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food not found',
      });
    }

    return res.json({
      success: true,
      message: 'Food deleted successfully',
      result: food,
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
  getAllFoods,
  getFoodById,
  addFoodByAdmin,
  updateFoodByAdmin,
  deleteFoodByAdmin,
};

