const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const SocialMedia = require('../model/socialMediaModel');

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;

  const admin = await Admin.findById(admin_id);
  if (!admin) return null;
  if (admin.status === 'Deleted') return null;
  return admin;
};

// Admin: Add Social Media link
const addSocialMedia = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { platform, url, icon } = req.body;

    if (!platform || !url) {
      return res.status(400).json({
        success: false,
        message: 'platform and url are required',
      });
    }

    const item = await SocialMedia.create({
      platform: platform.trim(),
      url: url.trim(),
      icon: (icon || '').trim(),
    });

    return res.json({
      success: true,
      message: 'Social media link added successfully',
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

// Admin: Get all Social Media links
const getAllSocialMediaAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const statusFilter = (req.query.status || 'active').toLowerCase();
    const query = {};
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'deleted') query.status = 'Deleted';

    const items = await SocialMedia.find(query).sort({ createdAt: 1 }).lean();

    return res.json({
      success: true,
      message: 'Social media links fetched successfully',
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

// Admin: Get Social Media by ID
const getSocialMediaByIdAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const item = await SocialMedia.findById(id).lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Social media link not found',
      });
    }

    return res.json({
      success: true,
      message: 'Social media link fetched successfully',
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

// Admin: Update Social Media link
const updateSocialMedia = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const { platform, url, icon, status } = req.body;

    const item = await SocialMedia.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Social media link not found',
      });
    }

    if (platform != null && platform !== '') item.platform = platform.trim();
    if (url != null && url !== '') item.url = url.trim();
    if (icon != null) item.icon = (icon || '').trim();
    if (status && ['Active', 'Deleted'].includes(status)) item.status = status;

    await item.save();

    return res.json({
      success: true,
      message: 'Social media link updated successfully',
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

// Admin: Soft delete Social Media link
const deleteSocialMedia = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const item = await SocialMedia.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Social media link not found',
      });
    }

    item.status = 'Deleted';
    await item.save();

    return res.json({
      success: true,
      message: 'Social media link deleted successfully',
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

// User/Admin: Get all active Social Media links
const getSocialMediaForUser = async (req, res) => {
  try {
    const token = req.token;
    if (!token?._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const items = await SocialMedia.find({ status: { $ne: 'Deleted' } })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      message: 'Social media links fetched successfully',
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
  addSocialMedia,
  getAllSocialMediaAdmin,
  getSocialMediaByIdAdmin,
  updateSocialMedia,
  deleteSocialMedia,
  getSocialMediaForUser,
};

