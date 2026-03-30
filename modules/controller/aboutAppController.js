const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const AboutApp = require('../model/aboutAppModel');

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;

  const admin = await Admin.findById(admin_id);
  if (!admin) return null;
  if (admin.status === 'Deleted') return null;
  return admin;
};

// Admin: Add About App content
const addAboutApp = async (req, res) => {
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

    const about = await AboutApp.create({
      title: (title || '').trim(),
      content: content.trim(),
      lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
    });

    return res.json({
      success: true,
      message: 'About app content added successfully',
      result: about,
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

// Admin: Get all About App entries
const getAllAboutAppAdmin = async (req, res) => {
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

    const items = await AboutApp.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      message: 'About app content fetched successfully',
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

// Admin: Get About App by ID
const getAboutAppByIdAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const item = await AboutApp.findById(id).lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'About app content not found',
      });
    }

    return res.json({
      success: true,
      message: 'About app content fetched successfully',
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

// Admin: Update About App
const updateAboutApp = async (req, res) => {
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

    const item = await AboutApp.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'About app content not found',
      });
    }

    if (title != null && title !== '') item.title = title.trim();
    if (content != null && content !== '') item.content = content.trim();
    if (lastUpdated) item.lastUpdated = new Date(lastUpdated);
    if (status && ['Active', 'Deleted'].includes(status)) item.status = status;

    await item.save();

    return res.json({
      success: true,
      message: 'About app content updated successfully',
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

// Admin: Soft delete About App entry
const deleteAboutApp = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const item = await AboutApp.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'About app content not found',
      });
    }

    item.status = 'Deleted';
    await item.save();

    return res.json({
      success: true,
      message: 'About app content deleted successfully',
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

// User/Admin: get all active About App entries
const getAboutAppForUser = async (req, res) => {
  try {
    const token = req.token;
    if (!token?._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const items = await AboutApp.find({ status: { $ne: 'Deleted' } })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'About app content fetched successfully',
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

module.exports = {
  addAboutApp,
  getAllAboutAppAdmin,
  getAboutAppByIdAdmin,
  updateAboutApp,
  deleteAboutApp,
  getAboutAppForUser,
};

