const { Admin } = require('../model/adminModel');
const Food = require('../model/foodModel');
const User = require('../model/userModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');
const { BLOCKED_USER_MESSAGE } = require('../../utils/userAccessGuards');

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

// Legacy category reference (category is now open string, no enum restriction)
const allowedCategories = ['Protein', 'Carbs', 'Vegetables', 'Fruit', 'Fats', 'Other'];

const buildCategoryFilter = (rawCategory) => {
  if (!rawCategory || String(rawCategory).toLowerCase() === 'all') return null;
  const trimmed = String(rawCategory).trim();
  const lower = trimmed.toLowerCase();

  // 1. Common macro group fallbacks (handles mobile app macro filters):
  if (lower === 'fruit' || lower === 'fruits') {
    return { $regex: /fruit/i };
  }
  if (lower === 'vegetable' || lower === 'vegetables') {
    return { $regex: /vegetable/i };
  }
  if (lower === 'fat' || lower === 'fats' || lower === 'healthy fats') {
    return { $regex: /fat/i };
  }
  if (lower === 'protein' || lower === 'proteins') {
    return { $regex: /protein|poultry|beef|pork|finfish|shellfish|lamb|veal|game|sausages|meat/i };
  }
  if (lower === 'carb' || lower === 'carbs') {
    return { $regex: /cereal|grain|pasta|bak|snack|sweet|bread|chip|cookie|cracker|candy/i };
  }

  // 2. Exact match (case-insensitive) for any specific category
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $regex: new RegExp(`^${escaped}$`, 'i') };
};
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
  const image = stored && req && typeof req.get === 'function' ? toPublicFileUrl(req, stored) : stored;
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

const parseOptionalNumber = (raw, fallback = 0) => {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const parseNullableNumber = (raw) => {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const parseServingSizes = (raw) => {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({
      servingDescription: String(s.servingDescription || s.label || '').trim(),
      servingGrams: parseOptionalNumber(s.servingGrams ?? s.grams, 0),
      calories: Math.round(parseOptionalNumber(s.calories, 0)),
      protein: parseOptionalNumber(s.protein, 0),
      carbs: parseOptionalNumber(s.carbs, 0),
      fats: parseOptionalNumber(s.fats ?? s.fat, 0),
    }))
    .filter((s) => s.servingDescription || s.servingGrams > 0);
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
      servingGrams,
      calories_per_serving,
      protein_g_per_serving,
      carbs_g_per_serving,
      fat_g_per_serving,
      calories_per_100g,
      protein_g_per_100g,
      carbs_g_per_100g,
      fat_g_per_100g,
      fiber,
      sugar,
      sodium,
      brand,
      upc,
      servingSizes,
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

    const numProtein = protein != null && protein !== '' ? Number(protein) : 0;
    const numCarbs = carbs != null && carbs !== '' ? Number(carbs) : 0;
    const numFats = fats != null && fats !== '' ? Number(fats) : 0;
    const numServingGrams = parseNullableNumber(servingGrams);

    const calPerServing =
      calories_per_serving != null && calories_per_serving !== ''
        ? Math.round(Number(calories_per_serving))
        : caloriesParsed.value;
    const proPerServing =
      protein_g_per_serving != null && protein_g_per_serving !== ''
        ? Number(protein_g_per_serving)
        : numProtein;
    const carbPerServing =
      carbs_g_per_serving != null && carbs_g_per_serving !== ''
        ? Number(carbs_g_per_serving)
        : numCarbs;
    const fatPerServing =
      fat_g_per_serving != null && fat_g_per_serving !== ''
        ? Number(fat_g_per_serving)
        : numFats;

    let cal100 = parseOptionalNumber(calories_per_100g, 0);
    let pro100 = parseOptionalNumber(protein_g_per_100g, 0);
    let carb100 = parseOptionalNumber(carbs_g_per_100g, 0);
    let fat100 = parseOptionalNumber(fat_g_per_100g, 0);

    if (numServingGrams && numServingGrams > 0) {
      if (!cal100 && calPerServing > 0) {
        cal100 = Math.round((calPerServing / numServingGrams) * 100);
      }
      if (!pro100 && proPerServing > 0) {
        pro100 = Math.round((proPerServing / numServingGrams) * 100 * 100) / 100;
      }
      if (!carb100 && carbPerServing > 0) {
        carb100 = Math.round((carbPerServing / numServingGrams) * 100 * 100) / 100;
      }
      if (!fat100 && fatPerServing > 0) {
        fat100 = Math.round((fatPerServing / numServingGrams) * 100 * 100) / 100;
      }
    }

    const extraServingSizes = parseServingSizes(servingSizes);

    const food = await Food.create({
      createdByAdminId: admin._id,
      name: name.trim(),
      calories: caloriesParsed.value,
      protein: numProtein,
      carbs: numCarbs,
      fats: numFats,
      category: String(category || '').trim() || 'Other',
      mealType: mealType && allowedMealTypes.includes(mealType) ? mealType : 'Other',
      servingSize: (servingSize || '').trim(),
      servingGrams: numServingGrams,
      calories_per_serving: calPerServing,
      protein_g_per_serving: proPerServing,
      carbs_g_per_serving: carbPerServing,
      fat_g_per_serving: fatPerServing,
      calories_per_100g: cal100,
      protein_g_per_100g: pro100,
      carbs_g_per_100g: carb100,
      fat_g_per_100g: fat100,
      fiber: parseOptionalNumber(fiber, 0),
      sugar: parseOptionalNumber(sugar, 0),
      sodium: parseOptionalNumber(sodium, 0),
      brand: (brand || '').trim(),
      upc: (upc || '').trim(),
      servingSizes: extraServingSizes,
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
        message: BLOCKED_USER_MESSAGE,
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
      servingGrams,
      calories_per_serving,
      protein_g_per_serving,
      carbs_g_per_serving,
      fat_g_per_serving,
      calories_per_100g,
      protein_g_per_100g,
      carbs_g_per_100g,
      fat_g_per_100g,
      fiber,
      sugar,
      sodium,
      brand,
      upc,
      servingSizes,
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

    const numServingGrams = parseNullableNumber(servingGrams);
    const calPerServing =
      calories_per_serving != null && calories_per_serving !== ''
        ? Math.round(Number(calories_per_serving))
        : caloriesParsed.value;
    const proPerServing =
      protein_g_per_serving != null && protein_g_per_serving !== ''
        ? Number(protein_g_per_serving)
        : proteinParsed.value;
    const carbPerServing =
      carbs_g_per_serving != null && carbs_g_per_serving !== ''
        ? Number(carbs_g_per_serving)
        : carbsParsed.value;
    const fatPerServing =
      fat_g_per_serving != null && fat_g_per_serving !== ''
        ? Number(fat_g_per_serving)
        : fatsParsed.value;

    let cal100 = parseOptionalNumber(calories_per_100g, 0);
    let pro100 = parseOptionalNumber(protein_g_per_100g, 0);
    let carb100 = parseOptionalNumber(carbs_g_per_100g, 0);
    let fat100 = parseOptionalNumber(fat_g_per_100g, 0);

    if (numServingGrams && numServingGrams > 0) {
      if (!cal100 && calPerServing > 0) {
        cal100 = Math.round((calPerServing / numServingGrams) * 100);
      }
      if (!pro100 && proPerServing > 0) {
        pro100 = Math.round((proPerServing / numServingGrams) * 100 * 100) / 100;
      }
      if (!carb100 && carbPerServing > 0) {
        carb100 = Math.round((carbPerServing / numServingGrams) * 100 * 100) / 100;
      }
      if (!fat100 && fatPerServing > 0) {
        fat100 = Math.round((fatPerServing / numServingGrams) * 100 * 100) / 100;
      }
    }

    const food = await Food.create({
      createdByUserId: user._id,
      name: name.trim(),
      calories: caloriesParsed.value,
      protein: proteinParsed.value,
      carbs: carbsParsed.value,
      fats: fatsParsed.value,
      category: String(category || '').trim() || 'Other',
      mealType: mealType && allowedMealTypes.includes(mealType) ? mealType : 'Other',
      servingSize: (servingSize || '').trim(),
      servingGrams: numServingGrams,
      calories_per_serving: calPerServing,
      protein_g_per_serving: proPerServing,
      carbs_g_per_serving: carbPerServing,
      fat_g_per_serving: fatPerServing,
      calories_per_100g: cal100,
      protein_g_per_100g: pro100,
      carbs_g_per_100g: carb100,
      fat_g_per_100g: fat100,
      fiber: parseOptionalNumber(fiber, 0),
      sugar: parseOptionalNumber(sugar, 0),
      sodium: parseOptionalNumber(sodium, 0),
      brand: (brand || '').trim(),
      upc: (upc || '').trim(),
      servingSizes: parseServingSizes(servingSizes),
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

// 2A. User - Get global catalog + own foods (paginated)
const getAllFoodsForUser = async (req, res) => {
  try {
    const user = await User.findById(req.token?._id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const rawCategory = String(req.query.category ?? 'all').trim();
    const mealType = req.query.mealType;
    const search = (req.query.search || '').trim();
    const query = { status: { $ne: 'Deleted' } };
    Object.assign(query, buildUserVisibleFoodQuery(user._id));
    const catFilter = buildCategoryFilter(req.query.category);
    if (catFilter) {
      query.category = catFilter;
    }
    if (mealType && allowedMealTypes.includes(mealType)) query.mealType = mealType;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: regex }, { brand: regex }, { servingSize: regex }];
    }

    const [foods, total] = await Promise.all([
      Food.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Food.countDocuments(query),
    ]);

    return res.json({
      success: true,
      message: 'Foods fetched successfully',
      result: {
        items: foods.map((food) => withFoodImageUrl(req, food)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
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

// 2. Admin - Get all foods (paginated for admin panel)
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

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const rawCategory = String(req.query.category ?? 'all').trim();
    const mealType = req.query.mealType;
    const search = (req.query.search || '').trim();
    const query = { status: { $ne: 'Deleted' } };
    if (!admin) Object.assign(query, buildUserVisibleFoodQuery(user._id));
    const catFilter = buildCategoryFilter(req.query.category);
    if (catFilter) {
      query.category = catFilter;
    }
    if (mealType && allowedMealTypes.includes(mealType)) query.mealType = mealType;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { name: regex },
        { brand: regex },
        { servingSize: regex },
      ];
    }

    const baseCountQuery = { status: { $ne: 'Deleted' } };
    if (!admin) Object.assign(baseCountQuery, buildUserVisibleFoodQuery(user._id));

    const [foods, total, categoryCountsAgg] = await Promise.all([
      Food.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Food.countDocuments(query),
      Food.aggregate([
        { $match: baseCountQuery },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
    ]);

    const categoryCounts = {};
    let allCount = 0;
    (categoryCountsAgg || []).forEach((c) => {
      if (c._id) categoryCounts[c._id] = c.count;
      allCount += c.count || 0;
    });

    return res.json({
      success: true,
      message: 'Foods fetched successfully',
      result: {
        items: foods.map((food) => withFoodImageUrl(req, food)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        categoryCounts,
        allCount,
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

    const rawCategory = String(req.query.category ?? 'all').trim();
    const mealType = req.query.mealType;
    const search = (req.query.search || '').trim();
    const query = {
      status: { $ne: 'Deleted' },
      createdByUserId: user._id,
    };
    const catFilter = buildCategoryFilter(req.query.category);
    if (catFilter) {
      query.category = catFilter;
    }
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
      servingGrams,
      calories_per_serving,
      protein_g_per_serving,
      carbs_g_per_serving,
      fat_g_per_serving,
      calories_per_100g,
      protein_g_per_100g,
      carbs_g_per_100g,
      fat_g_per_100g,
      fiber,
      sugar,
      sodium,
      brand,
      upc,
      servingSizes,
    } = req.body;

    const food = await Food.findOne({ _id: id, status: { $ne: 'Deleted' } });

    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food not found',
      });
    }

    if (food.createdByUserId) {
      return res.status(403).json({
        success: false,
        message: 'Admin cannot edit foods added by users',
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
    if (category !== undefined) {
      const trimmedCat = String(category || '').trim();
      if (trimmedCat) food.category = trimmedCat;
    }
    if (mealType && allowedMealTypes.includes(mealType)) {
      food.mealType = mealType;
    }
    if (servingSize != null) food.servingSize = servingSize.trim();
    if (brand !== undefined) food.brand = String(brand || '').trim();
    if (upc !== undefined) food.upc = String(upc || '').trim();
    if (servingGrams !== undefined) food.servingGrams = parseNullableNumber(servingGrams);

    if (calories_per_serving !== undefined && calories_per_serving !== '') {
      food.calories_per_serving = Math.round(Number(calories_per_serving));
    } else {
      food.calories_per_serving = food.calories;
    }
    if (protein_g_per_serving !== undefined && protein_g_per_serving !== '') {
      food.protein_g_per_serving = Number(protein_g_per_serving);
    } else {
      food.protein_g_per_serving = food.protein;
    }
    if (carbs_g_per_serving !== undefined && carbs_g_per_serving !== '') {
      food.carbs_g_per_serving = Number(carbs_g_per_serving);
    } else {
      food.carbs_g_per_serving = food.carbs;
    }
    if (fat_g_per_serving !== undefined && fat_g_per_serving !== '') {
      food.fat_g_per_serving = Number(fat_g_per_serving);
    } else {
      food.fat_g_per_serving = food.fats;
    }

    if (calories_per_100g !== undefined) {
      food.calories_per_100g = calories_per_100g !== '' ? parseOptionalNumber(calories_per_100g, 0) : 0;
    }
    if (protein_g_per_100g !== undefined) {
      food.protein_g_per_100g = protein_g_per_100g !== '' ? parseOptionalNumber(protein_g_per_100g, 0) : 0;
    }
    if (carbs_g_per_100g !== undefined) {
      food.carbs_g_per_100g = carbs_g_per_100g !== '' ? parseOptionalNumber(carbs_g_per_100g, 0) : 0;
    }
    if (fat_g_per_100g !== undefined) {
      food.fat_g_per_100g = fat_g_per_100g !== '' ? parseOptionalNumber(fat_g_per_100g, 0) : 0;
    }

    if (fiber !== undefined) food.fiber = fiber !== '' ? parseOptionalNumber(fiber, 0) : 0;
    if (sugar !== undefined) food.sugar = sugar !== '' ? parseOptionalNumber(sugar, 0) : 0;
    if (sodium !== undefined) food.sodium = sodium !== '' ? parseOptionalNumber(sodium, 0) : 0;

    if (servingSizes !== undefined) {
      food.servingSizes = parseServingSizes(servingSizes);
    }
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
  getAllFoodsForUser,
  getMyFoods,
  getAllFoodCategories,
  getFoodById,
  addFoodByUser,
  addFoodByAdmin,
  updateFoodByAdmin,
  deleteFoodByAdmin,
  deleteMyFood,
};

