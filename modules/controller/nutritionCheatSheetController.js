const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const NutritionCheatSheet = require('../model/nutritionCheatSheetModel');

const MACRO_TYPES_LIST = NutritionCheatSheet.MACRO_TYPES;

const SECTION_BY_MACRO = {
  protein: 'Protein Sources',
  carb: 'Carb Sources',
  fat: 'Fat Sources',
};

const SECTION_ORDER = ['protein', 'carb', 'fat'];

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;
  const admin = await Admin.findById(admin_id);
  if (!admin || admin.status === 'Deleted') return null;
  return admin;
};

const getValidUserId = (token) => token?._id || null;

// ---------------- Admin ----------------

const addNutritionCheatSheetItem = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { name, servingSize, macroType, macroAmountGrams, calories, sortOrder } = req.body;

    if (!name?.trim() || !servingSize?.trim() || !macroType || macroAmountGrams == null || calories == null) {
      return res.status(400).json({
        success: false,
        message: 'name, servingSize, macroType, macroAmountGrams and calories are required',
      });
    }

    const mt = String(macroType).toLowerCase();
    if (!MACRO_TYPES_LIST.includes(mt)) {
      return res.status(400).json({
        success: false,
        message: 'macroType must be protein, carb or fat',
      });
    }

    const grams = Number(macroAmountGrams);
    const cal = Number(calories);
    if (Number.isNaN(grams) || Number.isNaN(cal)) {
      return res.status(400).json({
        success: false,
        message: 'macroAmountGrams and calories must be valid numbers',
      });
    }

    const item = await NutritionCheatSheet.create({
      name: name.trim(),
      servingSize: servingSize.trim(),
      macroType: mt,
      macroAmountGrams: grams,
      calories: cal,
      sortOrder: sortOrder != null && sortOrder !== '' ? Number(sortOrder) : 0,
      createdBy: admin._id,
    });

    return res.json({
      success: true,
      message: 'Nutrition cheat sheet item added successfully',
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

const getAllNutritionCheatSheetAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const macroType = (req.query.macroType || '').toLowerCase();
    const statusFilter = (req.query.status || 'active').toLowerCase();
    const search = (req.query.search || '').trim();

    const query = {};
    if (macroType && MACRO_TYPES_LIST.includes(macroType)) {
      query.macroType = macroType;
    }
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'deleted') query.status = 'Deleted';
    else query.status = { $in: ['Active', 'Deleted'] };

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.name = regex;
    }

    const pipeline = [
      { $match: query },
      {
        $addFields: {
          _macroOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$macroType', 'protein'] }, then: 0 },
                { case: { $eq: ['$macroType', 'carb'] }, then: 1 },
                { case: { $eq: ['$macroType', 'fat'] }, then: 2 },
              ],
              default: 99,
            },
          },
        },
      },
      { $sort: { _macroOrder: 1, sortOrder: 1, createdAt: 1 } },
      { $project: { _macroOrder: 0 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const agg = await NutritionCheatSheet.aggregate(pipeline);
    const facet = agg[0] || { items: [], totalCount: [] };
    const items = facet.items || [];
    const total = facet.totalCount?.[0]?.count ?? 0;

    return res.json({
      success: true,
      message: 'Nutrition cheat sheet items fetched successfully',
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

const getNutritionCheatSheetByIdAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const item = await NutritionCheatSheet.findById(id).lean();
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    return res.json({
      success: true,
      message: 'Nutrition cheat sheet item fetched successfully',
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

const updateNutritionCheatSheetItem = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const { name, servingSize, macroType, macroAmountGrams, calories, sortOrder, status } = req.body;

    const item = await NutritionCheatSheet.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    if (name != null && String(name).trim() !== '') item.name = String(name).trim();
    if (servingSize != null && String(servingSize).trim() !== '') item.servingSize = String(servingSize).trim();
    if (macroType != null && String(macroType).trim() !== '') {
      const mt = String(macroType).toLowerCase();
      if (!MACRO_TYPES_LIST.includes(mt)) {
        return res.status(400).json({
          success: false,
          message: 'macroType must be protein, carb or fat',
        });
      }
      item.macroType = mt;
    }
    if (macroAmountGrams != null && macroAmountGrams !== '') {
      const g = Number(macroAmountGrams);
      if (Number.isNaN(g)) {
        return res.status(400).json({ success: false, message: 'macroAmountGrams must be a number' });
      }
      item.macroAmountGrams = g;
    }
    if (calories != null && calories !== '') {
      const c = Number(calories);
      if (Number.isNaN(c)) {
        return res.status(400).json({ success: false, message: 'calories must be a number' });
      }
      item.calories = c;
    }
    if (sortOrder != null && sortOrder !== '') item.sortOrder = Number(sortOrder);
    if (status && ['Active', 'Deleted'].includes(status)) item.status = status;

    await item.save();

    return res.json({
      success: true,
      message: 'Nutrition cheat sheet item updated successfully',
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

const deleteNutritionCheatSheetItem = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const item = await NutritionCheatSheet.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    item.status = 'Deleted';
    await item.save();

    return res.json({
      success: true,
      message: 'Nutrition cheat sheet item deleted successfully',
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

// ---------------- User ----------------

const getNutritionCheatSheetForUser = async (req, res) => {
  try {
    const userId = getValidUserId(req.token);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const user = await User.findById(userId).lean();
    if (!user || user.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const items = await NutritionCheatSheet.find({ status: 'Active' })
      .sort({ macroType: 1, sortOrder: 1, createdAt: 1 })
      .select('name servingSize macroType macroAmountGrams calories sortOrder createdAt updatedAt')
      .lean();

    const byMacro = { protein: [], carb: [], fat: [] };
    for (const row of items) {
      if (byMacro[row.macroType]) byMacro[row.macroType].push(row);
    }

    const sections = SECTION_ORDER.map((macroType) => ({
      macroType,
      title: SECTION_BY_MACRO[macroType],
      items: byMacro[macroType] || [],
    }));

    return res.json({
      success: true,
      message: 'Nutrition cheat sheet fetched successfully',
      result: {
        title: 'Nutrition Cheat Sheet',
        subtitle: 'Quick reference for macro tracking',
        sections,
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

const getNutritionCheatSheetByIdForUser = async (req, res) => {
  try {
    const userId = getValidUserId(req.token);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const user = await User.findById(userId).lean();
    if (!user || user.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const { id } = req.params;
    const item = await NutritionCheatSheet.findOne({ _id: id, status: 'Active' })
      .select('name servingSize macroType macroAmountGrams calories sortOrder createdAt updatedAt')
      .lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Nutrition cheat sheet item not found',
      });
    }

    return res.json({
      success: true,
      message: 'Nutrition cheat sheet item fetched successfully',
      result: {
        ...item,
        sectionTitle: SECTION_BY_MACRO[item.macroType] || '',
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

module.exports = {
  addNutritionCheatSheetItem,
  getAllNutritionCheatSheetAdmin,
  getNutritionCheatSheetByIdAdmin,
  updateNutritionCheatSheetItem,
  deleteNutritionCheatSheetItem,
  getNutritionCheatSheetForUser,
  getNutritionCheatSheetByIdForUser,
};
