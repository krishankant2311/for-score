const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const Plan = require('../model/planModel');
const { PLAN_ACCESS_MODULES } = Plan;

const getValidAdmin = async (token) => {
  const adminId = token?._id;
  if (!adminId) return null;
  const admin = await Admin.findById(adminId);
  if (!admin || admin.status === 'Deleted') return null;
  return admin;
};

const getValidUser = async (token) => {
  const userId = token?._id;
  if (!userId) return null;
  const user = await User.findById(userId);
  if (!user || user.status === 'Deleted') return null;
  return user;
};

const normalizeFeatures = (features) => {
  if (Array.isArray(features)) {
    return features.map((f) => String(f).trim()).filter(Boolean);
  }
  if (typeof features === 'string') {
    return features
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizePlanAccess = (planAccess) => {
  if (!planAccess) return [];
  const items = Array.isArray(planAccess) ? planAccess : [planAccess];
  return items
    .map((item) => String(item).trim())
    .filter((item) => PLAN_ACCESS_MODULES.includes(item));
};

const addPlan = async (req, res, next) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { planName, price, tagline, periodDays, features, planAccess, status } = req.body;
    if (!planName?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'planName is required',
      });
    }
    if (price == null || Number.isNaN(Number(price))) {
      return res.status(400).json({
        success: false,
        message: 'Valid price is required',
      });
    }

    const existing = await Plan.findOne({ planName: planName.trim() });
    if (existing && existing.status !== 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Plan name already exists',
      });
    }

    const payload = {
      planName: planName.trim(),
      price: Number(price),
      tagline: tagline ? String(tagline).trim() : '',
      periodDays: periodDays && !Number.isNaN(Number(periodDays)) ? Number(periodDays) : 30,
      features: normalizeFeatures(features),
      planAccess: normalizePlanAccess(planAccess),
      status: ['Active', 'Inactive'].includes(status) ? status : 'Active',
    };

    const plan = existing
      ? await Plan.findByIdAndUpdate(existing._id, payload, { new: true })
      : await Plan.create(payload);

    return res.status(200).json({
      success: true,
      message: existing ? 'Plan recreated successfully' : 'Plan created successfully',
      result: plan,
    });
  } catch (err) {
    next(err);
  }
};

const getAllPlansAdmin = async (req, res, next) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const statusFilter = (req.query.status || 'all').toLowerCase();
    const search = (req.query.search || '').trim();
    const query = {};

    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'inactive') query.status = 'Inactive';
    else if (statusFilter === 'deleted') query.status = 'Deleted';
    else query.status = { $in: ['Active', 'Inactive'] };

    if (search) {
      query.planName = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    const plans = await Plan.find(query).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      message: 'Plans fetched successfully',
      result: plans,
    });
  } catch (err) {
    next(err);
  }
};

const getPlanByIdAdmin = async (req, res, next) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const plan = await Plan.findById(req.params.id).lean();
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Plan fetched successfully',
      result: plan,
    });
  } catch (err) {
    next(err);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
    }

    const { planName, price, tagline, periodDays, features, planAccess, status } = req.body;

    if (planName != null && String(planName).trim()) {
      const normalizedName = String(planName).trim();
      const duplicate = await Plan.findOne({ _id: { $ne: plan._id }, planName: normalizedName });
      if (duplicate && duplicate.status !== 'Deleted') {
        return res.status(400).json({
          success: false,
          message: 'Plan name already exists',
        });
      }
      plan.planName = normalizedName;
    }

    if (price != null && !Number.isNaN(Number(price))) plan.price = Number(price);
    if (tagline != null) plan.tagline = String(tagline).trim();
    if (periodDays != null && !Number.isNaN(Number(periodDays))) plan.periodDays = Number(periodDays);
    if (features != null) plan.features = normalizeFeatures(features);
    if (planAccess != null) plan.planAccess = normalizePlanAccess(planAccess);
    if (status && ['Active', 'Inactive', 'Deleted'].includes(status)) plan.status = status;

    await plan.save();

    return res.status(200).json({
      success: true,
      message: 'Plan updated successfully',
      result: plan,
    });
  } catch (err) {
    next(err);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
    }

    plan.status = 'Deleted';
    await plan.save();

    return res.status(200).json({
      success: true,
      message: 'Plan deleted successfully',
      result: plan,
    });
  } catch (err) {
    next(err);
  }
};

const getAllPlansForUser = async (req, res, next) => {
  try {
    const user = await getValidUser(req.token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const plans = await Plan.find({ status: 'Active' }).sort({ price: 1, createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      message: 'Plans fetched successfully',
      result: plans,
    });
  } catch (err) {
    next(err);
  }
};

const getPlanByIdForUser = async (req, res, next) => {
  try {
    const user = await getValidUser(req.token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const plan = await Plan.findOne({ _id: req.params.id, status: 'Active' }).lean();
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Plan fetched successfully',
      result: plan,
    });
  } catch (err) {
    next(err);
  }
};

const selectPlanForUser = async (req, res, next) => {
  try {
    const token = req.token;
    const user_id = token?._id;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'planId is required',
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'User account has been deleted',
      });
    }

    const plan = await Plan.findOne({ _id: planId, status: 'Active' }).lean();
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
    }

    user.selectedPlan = plan.planName;
    user.selectedPlanId = plan._id;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Plan selected successfully',
      result: {
        selectedPlan: user.selectedPlan,
        selectedPlanId: user.selectedPlanId,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addPlan,
  getAllPlansAdmin,
  getPlanByIdAdmin,
  updatePlan,
  deletePlan,
  getAllPlansForUser,
  getPlanByIdForUser,
  selectPlanForUser,
};
