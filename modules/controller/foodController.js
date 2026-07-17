const { Admin } = require('../model/adminModel');
const Food = require('../model/foodModel');
const User = require('../model/userModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');

const FOOD_NAME_PATTERN = /^[a-zA-Z0-9\s\-'.,()&]+$/;
const FOOD_NAME_MAX = 100;

const validateFoodName = (name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'Food name is required';
  if (trimmed.length > FOOD_NAME_MAX) {
    return `Food name must be ${FOOD_NAME_MAX} characters or fewer`;
  }
  if (!FOOD_NAME_PATTERN.test(trimmed)) {
    return "Food name contains invalid characters";
  }
  return null;
};

const allowedCategories = ['Protein', 'Carbs', 'Vegetables', 'Fruit', 'Fats', 'Other'];
const allowedMealTypes = [
  'Breakfast',
  'Morning Snack',
  'Lunch',
  'Evening Snack',
  'Snack',
  'Dinner',
  'Other',
];

const parseRequiredCalories = (raw) => {
  if (raw == null || raw === '') return { error: 'calories are required' };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return { error: 'calories must be a valid number' };
  }
  if (n > 9999) {
    return { error: 'calories cannot exceed 9999' };
  }
  return { value: Math.round(n) };
};

const parseOptionalMacro = (raw, label) => {
  if (raw == null || raw === '') return { value: 0 };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return { error: `${label} must be a valid number` };
  }
  if (n > 9999) {
    return { error: `${label} cannot exceed 9999` };
  }
  return { value: n };
};

/** Rewrite DB `image` (disk path) to a public URL — no extra alias fields. */
const withFoodImageUrl = (req, food) => {
  if (!food) return food;
  const stored = String(food.image ?? '').trim();
  const image = stored ? toPublicFileUrl(req, stored) : '';
  return { ...food, image };
};

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;

  const admin = await Admin.findById(admin_id);
  if (!admin) return null;
  if (admin.status === 'Deleted') return null;
  return admin;
};

const buildUserVisibleFoodQuery = (userId) => ({
  $or: [
    { createdByUserId: userId },
    { createdByUserId: null },
    { createdByUserId: { $exists: false } },
  ],
});

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
      servingSize,
    } = req.body;

    if (!name || calories == null || calories === '') {
      return res.status(400).json({
        success: false,
        message: 'name and calories are required',
      });
    }

    const nameError = validateFoodName(name);
    if (nameError) {
      return res.status(400).json({
        success: false,
        message: nameError,
      });
    }

    const caloriesParsed = parseRequiredCalories(calories);
    if (caloriesParsed.error) {
      return res.status(400).json({
        success: false,
        message: caloriesParsed.error,
      });
    }

    const food = await Food.create({
      createdByAdminId: admin._id,
      name: name.trim(),
      calories: caloriesParsed.value,
      protein: protein != null && protein !== '' ? Number(protein) : 0,
      carbs: carbs != null && carbs !== '' ? Number(carbs) : 0,
      fats: fats != null && fats !== '' ? Number(fats) : 0,
      category: category && allowedCategories.includes(category) ? category : 'Other',
      mealType: mealType && allowedMealTypes.includes(mealType) ? mealType : 'Other',
      servingSize: (servingSize || '').trim(),
      image: req.file?.path || '',
    });

    return res.json({
      success: true,
      message: 'Food added successfully',
      result: withFoodImageUrl(req, food.toObject()),
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

// 1B. User - Add private food for own catalog
const addFoodByUser = async (req, res) => {
  try {
    const user = await User.findById(req.token?._id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }
    if (user.status === 'Blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.',
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

    if (!name || calories == null || calories === '') {
      return res.status(400).json({
        success: false,
        message: 'name and calories are required',
      });
    }

    const nameError = validateFoodName(name);
    if (nameError) {
      return res.status(400).json({
        success: false,
        message: nameError,
      });
    }

    const caloriesParsed = parseRequiredCalories(calories);
    if (caloriesParsed.error) {
      return res.status(400).json({
        success: false,
        message: caloriesParsed.error,
      });
    }

    const proteinParsed = parseOptionalMacro(protein, 'protein');
    const carbsParsed = parseOptionalMacro(carbs, 'carbs');
    const fatsParsed = parseOptionalMacro(fats, 'fats');
    const macroError = proteinParsed.error || carbsParsed.error || fatsParsed.error;
    if (macroError) {
      return res.status(400).json({
        success: false,
        message: macroError,
      });
    }

    const food = await Food.create({
      createdByUserId: user._id,
      name: name.trim(),
      calories: caloriesParsed.value,
      protein: proteinParsed.value,
      carbs: carbsParsed.value,
      fats: fatsParsed.value,
      category: category && allowedCategories.includes(category) ? category : 'Other',
      mealType: 'Other',
      servingSize: (servingSize || '').trim(),
      image: req.file?.path || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Food added successfully',
      result: withFoodImageUrl(req, food.toObject()),
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

// 2. User or Admin - Get global food catalog
const getAllFoods = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    let user = null;
    if (!admin) {
      user = await User.findById(req.token?._id);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found',
        });
      }
    }

    const category = req.query.category;
    const mealType = req.query.mealType;
    const search = (req.query.search || '').trim();
    const query = { status: { $ne: 'Deleted' } };
    if (!admin) Object.assign(query, buildUserVisibleFoodQuery(user._id));
    if (category && allowedCategories.includes(category)) query.category = category;
    if (mealType && allowedMealTypes.includes(mealType)) query.mealType = mealType;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.name = regex;
    }

    const foods = await Food.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Foods fetched successfully',
      result: foods.map((food) => withFoodImageUrl(req, food)),
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

// 2B. User - Get only foods created by current user
const getMyFoods = async (req, res) => {
  try {
    const user = await User.findById(req.token?._id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const category = req.query.category;
    const mealType = req.query.mealType;
    const search = (req.query.search || '').trim();
    const query = {
      status: { $ne: 'Deleted' },
      createdByUserId: user._id,
    };
    if (category && allowedCategories.includes(category)) query.category = category;
    if (mealType && allowedMealTypes.includes(mealType)) query.mealType = mealType;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.name = regex;
    }

    const foods = await Food.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'My foods fetched successfully',
      result: foods.map((food) => withFoodImageUrl(req, food)),
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

// 3. User - Get all food categories
const getAllFoodCategories = async (req, res) => {
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

    const categories = await Food.distinct('category', {
      status: { $ne: 'Deleted' },
      ...buildUserVisibleFoodQuery(user._id),
    });
    const normalized = categories
      .map((c) => String(c || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return res.json({
      success: true,
      message: 'Food categories fetched successfully',
      result: normalized,
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

// 4. User or Admin - Get single food by id
const getFoodById = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      const user = await User.findById(req.token?._id);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found',
        });
      }
    }

    const { id } = req.params;
    const query = { _id: id, status: { $ne: 'Deleted' } };
    if (!admin) Object.assign(query, buildUserVisibleFoodQuery(req.token?._id));
    const food = await Food.findOne(query).lean();

    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food not found',
      });
    }

    return res.json({
      success: true,
      message: 'Food fetched successfully',
      result: withFoodImageUrl(req, food),
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

// 5. Admin - Update food
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

    const trimmedName = name != null ? String(name).trim() : '';
    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: 'name is required',
      });
    }
    if (calories == null || calories === '') {
      return res.status(400).json({
        success: false,
        message: 'calories are required',
      });
    }

    const nameError = validateFoodName(trimmedName);
    if (nameError) {
      return res.status(400).json({
        success: false,
        message: nameError,
      });
    }

    const caloriesParsed = parseRequiredCalories(calories);
    if (caloriesParsed.error) {
      return res.status(400).json({
        success: false,
        message: caloriesParsed.error,
      });
    }

    food.name = trimmedName;
    food.calories = caloriesParsed.value;
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
    if (req.file?.path) food.image = req.file.path;

    await food.save();

    return res.json({
      success: true,
      message: 'Food updated successfully',
      result: withFoodImageUrl(req, food.toObject()),
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

// 6. Admin - Soft delete food
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

// 7. User - Soft delete own food only
const deleteMyFood = async (req, res) => {
  try {
    const user = await User.findById(req.token?._id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const food = await Food.findOneAndUpdate(
      {
        _id: id,
        createdByUserId: user._id,
        status: { $ne: 'Deleted' },
      },
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
      result: withFoodImageUrl(req, food),
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
  getMyFoods,
  getAllFoodCategories,
  getFoodById,
  addFoodByUser,
  addFoodByAdmin,
  updateFoodByAdmin,
  deleteFoodByAdmin,
  deleteMyFood,
};

