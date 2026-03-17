const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const PrivacyPolicy = require('../model/privacyPolicyModel');

// Helper: validate admin from token
const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;

  const admin = await Admin.findById(admin_id);
  if (!admin) return null;
  if (admin.status === 'Deleted') return null;
  return admin;
};

// Helper: validate user from token
const getValidUser = async (token) => {
  const user_id = token?._id;
  if (!user_id) return null;

  const user = await User.findById(user_id);
  if (!user) return null;
  if (user.status === 'Deleted') return null;
  return user;
};

// ----------------- Admin Controllers -----------------

// 1. Admin - Add Privacy Policy
const addPrivacyPolicy = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { title, content, lastUpdated } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'title and content are required',
      });
    }

    const policy = await PrivacyPolicy.create({
      title: title.trim(),
      content: content.trim(),
      lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
    });

    return res.json({
      success: true,
      message: 'Privacy policy added successfully',
      result: policy,
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

// 2. Admin - Get all Privacy Policies (with optional status filter)
const getAllPrivacyPoliciesAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const statusFilter = (req.query.status || 'all').toLowerCase();
    const query = {};
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'deleted') query.status = 'Deleted';

    const policies = await PrivacyPolicy.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Privacy policies fetched successfully',
      result: policies,
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

// 3. Admin - Get Privacy Policy by ID
const getPrivacyPolicyByIdAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const policy = await PrivacyPolicy.findById(id).lean();

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Privacy policy not found',
      });
    }

    return res.json({
      success: true,
      message: 'Privacy policy fetched successfully',
      result: policy,
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

// 4. Admin - Update Privacy Policy
const updatePrivacyPolicy = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const { title, content, lastUpdated, status } = req.body;

    const policy = await PrivacyPolicy.findById(id);
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Privacy policy not found',
      });
    }

    if (title != null && title !== '') policy.title = title.trim();
    if (content != null && content !== '') policy.content = content.trim();
    if (lastUpdated) policy.lastUpdated = new Date(lastUpdated);
    if (status && ['Active', 'Deleted'].includes(status)) policy.status = status;

    await policy.save();

    return res.json({
      success: true,
      message: 'Privacy policy updated successfully',
      result: policy,
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

// 5. Admin - Delete Privacy Policy (soft delete)
const deletePrivacyPolicy = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const policy = await PrivacyPolicy.findById(id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Privacy policy not found',
      });
    }

    policy.status = 'Deleted';
    await policy.save();

    return res.json({
      success: true,
      message: 'Privacy policy deleted successfully',
      result: policy,
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

// ----------------- User Controllers -----------------

// 6. User/Admin - Get all active Privacy Policies
const getAllPrivacyPoliciesUser = async (req, res) => {
  try {
    // allow both user and admin tokens
    const token = req.token;
    if (!token?._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const policies = await PrivacyPolicy.find({
      status: { $ne: 'Deleted' },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Privacy policies fetched successfully',
      result: policies,
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

// 7. User/Admin - Get single active Privacy Policy by ID
const getPrivacyPolicyByIdUser = async (req, res) => {
  try {
    const token = req.token;
    if (!token?._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;
    const policy = await PrivacyPolicy.findOne({
      _id: id,
      status: { $ne: 'Deleted' },
    }).lean();

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Privacy policy not found',
      });
    }

    return res.json({
      success: true,
      message: 'Privacy policy fetched successfully',
      result: policy,
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
  // admin
  addPrivacyPolicy,
  getAllPrivacyPoliciesAdmin,
  getPrivacyPolicyByIdAdmin,
  updatePrivacyPolicy,
  deletePrivacyPolicy,
  // user/admin common read APIs
  getAllPrivacyPoliciesUser,
  getPrivacyPolicyByIdUser,
};

