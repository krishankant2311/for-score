const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const TermsCondition = require('../model/termsConditionModel');

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

// 1. Admin - Add Terms & Conditions (single-doc upsert)
const addTermsCondition = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { title, content, lastUpdated } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'content is required',
      });
    }

    // Keep a single Terms & Conditions document: second add acts as update.
    let terms = await TermsCondition.findOne({ status: { $ne: 'Deleted' } }).sort({
      createdAt: -1,
    });
    const isUpdate = !!terms;

    if (!terms) {
      terms = await TermsCondition.create({
        title: (title || '').trim(),
        content: content.trim(),
        lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
        status: 'Active',
      });
    } else {
      terms.title = (title || '').trim();
      terms.content = content.trim();
      terms.lastUpdated = lastUpdated ? new Date(lastUpdated) : new Date();
      terms.status = 'Active';
      await terms.save();
    }

    return res.json({
      success: true,
      message: isUpdate
        ? 'Terms & Conditions updated successfully'
        : 'Terms & Conditions added successfully',
      result: terms,
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

// 2. Admin - Get all Terms & Conditions (optional status filter)
const getAllTermsConditionAdmin = async (req, res) => {
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

    const terms = await TermsCondition.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      message: 'Terms & Conditions fetched successfully',
      result: terms,
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

// 3. Admin - Get Terms & Conditions by ID
const getTermsConditionByIdAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const terms = await TermsCondition.findById(id).lean();

    if (!terms) {
      return res.status(404).json({
        success: false,
        message: 'Terms & Conditions not found',
      });
    }

    return res.json({
      success: true,
      message: 'Terms & Conditions fetched successfully',
      result: terms,
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

// 4. Admin - Update Terms & Conditions by ID
const updateTermsCondition = async (req, res) => {
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

    const terms = await TermsCondition.findById(id);
    if (!terms) {
      return res.status(404).json({
        success: false,
        message: 'Terms & Conditions not found',
      });
    }

    if (title != null) terms.title = (title || '').trim();
    if (content != null && String(content).trim() !== '')
      terms.content = String(content).trim();
    if (lastUpdated != null)
      terms.lastUpdated = lastUpdated ? new Date(lastUpdated) : new Date();
    if (status && ['Active', 'Deleted'].includes(status)) terms.status = status;

    await terms.save();

    return res.json({
      success: true,
      message: 'Terms & Conditions updated successfully',
      result: terms,
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

// 5. Admin - Soft delete Terms & Conditions
const deleteTermsCondition = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const terms = await TermsCondition.findById(id);
    if (!terms) {
      return res.status(404).json({
        success: false,
        message: 'Terms & Conditions not found',
      });
    }

    terms.status = 'Deleted';
    await terms.save();

    return res.json({
      success: true,
      message: 'Terms & Conditions deleted successfully',
      result: terms,
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

// 6. User - Get all active Terms & Conditions (normally 0/1)
const getAllTermsConditionUser = async (req, res) => {
  try {
    const user = await getValidUser(req.token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const terms = await TermsCondition.find({ status: 'Active' })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Terms & Conditions fetched successfully',
      result: terms,
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

// 7. User - Get Terms & Conditions by ID (active only)
const getTermsConditionByIdUser = async (req, res) => {
  try {
    const user = await getValidUser(req.token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const { id } = req.params;
    const terms = await TermsCondition.findOne({ _id: id, status: 'Active' }).lean();

    if (!terms) {
      return res.status(404).json({
        success: false,
        message: 'Terms & Conditions not found',
      });
    }

    return res.json({
      success: true,
      message: 'Terms & Conditions fetched successfully',
      result: terms,
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
  addTermsCondition,
  getAllTermsConditionAdmin,
  getTermsConditionByIdAdmin,
  updateTermsCondition,
  deleteTermsCondition,
  getAllTermsConditionUser,
  getTermsConditionByIdUser,
};

