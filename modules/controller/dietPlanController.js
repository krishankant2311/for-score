const { Admin } = require('../model/adminModel');
const DietPlan = require('../model/dietPlanModel');

// 1. Add Diet Plan
const addDietPlan = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }
    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const { mealType, foodItems, calories } = req.body;

    if (!mealType || !foodItems || calories == null || calories === '') {
      return res.status(400).json({
        success: false,
        message: 'mealType, foodItems and calories are required',
      });
    }

    const mealAllowed = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    if (!mealAllowed.includes(mealType)) {
      return res.status(400).json({
        success: false,
        message: 'mealType must be Breakfast, Lunch, Dinner or Snacks',
      });
    }

    const caloriesNum = Number(calories);
    if (isNaN(caloriesNum) || caloriesNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid calories (number, >= 0) is required',
      });
    }

    const dietPlan = await DietPlan.create({
      mealType,
      foodItems: foodItems.trim(),
      calories: caloriesNum,
    });

    return res.json({
      success: true,
      message: 'Diet plan added successfully',
      result: dietPlan,
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

// 2. Get All Diet Plans (search, pagination, filter)
const getAllDietPlans = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }
    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const mealType = req.query.mealType;
    const statusFilter = (req.query.status || 'all').toLowerCase();

    const query = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ foodItems: regex }, { mealType: regex }];
    }
    if (mealType) query.mealType = mealType;
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'deleted') query.status = 'Deleted';

    const [dietPlans, total] = await Promise.all([
      DietPlan.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      DietPlan.countDocuments(query),
    ]);

    return res.json({
      success: true,
      message: 'Diet plans fetched successfully',
      result: {
        dietPlans,
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

// 3. Get Diet Plan by ID
const getDietPlanById = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }
    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const { id } = req.params;
    const dietPlan = await DietPlan.findById(id).lean();
    if (!dietPlan) {
      return res.status(404).json({
        success: false,
        message: 'Diet plan not found',
      });
    }

    return res.json({
      success: true,
      message: 'Diet plan fetched successfully',
      result: dietPlan,
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

// 4. Update Diet Plan
const updateDietPlan = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }
    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const { id } = req.params;
    const { mealType, foodItems, calories } = req.body;

    const dietPlan = await DietPlan.findById(id);
    if (!dietPlan) {
      return res.status(404).json({
        success: false,
        message: 'Diet plan not found',
      });
    }

    if (mealType && ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].includes(mealType)) {
      dietPlan.mealType = mealType;
    }
    if (foodItems != null && foodItems !== '') dietPlan.foodItems = foodItems.trim();
    if (calories != null && calories !== '') {
      const caloriesNum = Number(calories);
      if (!isNaN(caloriesNum) && caloriesNum >= 0) dietPlan.calories = caloriesNum;
    }

    await dietPlan.save();

    return res.json({
      success: true,
      message: 'Diet plan updated successfully',
      result: dietPlan,
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

// 5. Delete Diet Plan (soft delete)
const deleteDietPlan = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }
    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const { id } = req.params;
    const dietPlan = await DietPlan.findByIdAndUpdate(id, { status: 'Deleted' }, { new: true }).lean();
    if (!dietPlan) {
      return res.status(404).json({
        success: false,
        message: 'Diet plan not found',
      });
    }

    return res.json({
      success: true,
      message: 'Diet plan deleted successfully',
      result: dietPlan,
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
  addDietPlan,
  getAllDietPlans,
  getDietPlanById,
  updateDietPlan,
  deleteDietPlan,
};
