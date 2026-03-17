const User = require('../model/userModel');
const Food = require('../model/foodModel');

// 1. Add Food (for logged-in user)
const addFood = async (req, res) => {
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
      userId: user_id,
      name: name.trim(),
      calories: Number(calories),
      protein: protein != null && protein !== '' ? Number(protein) : 0,
      carbs: carbs != null && carbs !== '' ? Number(carbs) : 0,
      fats: fats != null && fats !== '' ? Number(fats) : 0,
      category:
        category && ['Protein', 'Carbs', 'Vegetables', 'Fruit', 'Fats', 'Other'].includes(category)
          ? category
          : 'Other',
      mealType:
        mealType && ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Other'].includes(mealType)
          ? mealType
          : 'Other',
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

// 2. Get all foods for logged-in user (non-deleted)
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

    const foods = await Food.find({
      userId: user_id,
      status: { $ne: 'Deleted' },
    })
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

// 3. Get single food by id (for logged-in user)
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
    const food = await Food.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    }).lean();

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

// 4. Update food
const updateFood = async (req, res) => {
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

    const food = await Food.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    });

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
    if (category && ['Protein', 'Carbs', 'Vegetables', 'Fruit', 'Fats', 'Other'].includes(category)) {
      food.category = category;
    }
    if (mealType && ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Other'].includes(mealType)) {
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

// 5. Soft delete food
const deleteFood = async (req, res) => {
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
    const food = await Food.findOneAndUpdate(
      { _id: id, userId: user_id },
      { status: 'Deleted' },
      { new: true }
    ).lean();

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
  addFood,
  getAllFoods,
  getFoodById,
  updateFood,
  deleteFood,
};

