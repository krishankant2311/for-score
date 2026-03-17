const { Admin } = require('../model/adminModel');
const RecoveryContent = require('../model/recoveryContentModel');

// 1. Add Recovery Content (new UI: category + contentType + media)
const addRecoveryContent = async (req, res) => {
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

    const { category, contentType, title, description, durationOrTarget, status } = req.body;

    if (!category || !contentType || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'category, contentType, title and description are required',
      });
    }

    const allowedCategories = [
      'Breathing',
      'Stretching',
      'Sleep',
      'Meditation',
      'Self-Massage',
      'Nutrition',
      'Yoga',
      'Therapy',
      'Relaxation',
    ];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message:
          'category must be one of Breathing, Stretching, Sleep, Meditation, Self-Massage, Nutrition, Yoga, Therapy, Relaxation',
      });
    }

    const allowedContentTypes = ['Video', 'Article', 'Audio', 'Image'];
    if (!allowedContentTypes.includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'contentType must be Video, Article, Audio or Image',
      });
    }

    if ((contentType === 'Video' || contentType === 'Audio' || contentType === 'Image') && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Media file is required for selected content type',
      });
    }

    const statusVal = status && ['Active', 'Draft'].includes(status) ? status : 'Active';

    const content = await RecoveryContent.create({
      category,
      contentType,
      title: title.trim(),
      description: description.trim(),
      durationOrTarget: (durationOrTarget || '').trim(),
      mediaPath: req.file ? req.file.path : '',
      status: statusVal,
    });

    return res.json({
      success: true,
      message: 'Recovery content added successfully',
      result: content,
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

// 2. Get All Recovery Content (search, pagination, filter)
const getAllRecoveryContent = async (req, res) => {
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
    const categoryFilter = req.query.category;
    const contentTypeFilter = req.query.contentType;
    const statusFilter = (req.query.status || 'all').toLowerCase();

    const query = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { description: regex }, { category: regex }];
    }
    if (categoryFilter) query.category = categoryFilter;
    if (contentTypeFilter && ['Video', 'Article', 'Audio', 'Image'].includes(contentTypeFilter)) {
      query.contentType = contentTypeFilter;
    }
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'draft') query.status = 'Draft';
    else if (statusFilter === 'deleted') query.status = 'Deleted';

    const [contentList, total] = await Promise.all([
      RecoveryContent.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      RecoveryContent.countDocuments(query),
    ]);

    return res.json({
      success: true,
      message: 'Recovery content fetched successfully',
      result: {
        contentList,
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

// 3. Get Recovery Content Stats (counts by category + total active)
const getRecoveryContentStats = async (req, res) => {
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

    const totalActive = await RecoveryContent.countDocuments({ status: 'Active' });

    const byCategory = await RecoveryContent.aggregate([
      { $match: { status: { $in: ['Active', 'Draft'] } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      message: 'Recovery content stats fetched successfully',
      result: {
        totalActive,
        byCategory,
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

// 4. Get Recovery Content by ID
const getRecoveryContentById = async (req, res) => {
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
    const content = await RecoveryContent.findById(id).lean();
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Recovery content not found',
      });
    }

    return res.json({
      success: true,
      message: 'Recovery content fetched successfully',
      result: content,
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

// 5. Update Recovery Content
const updateRecoveryContent = async (req, res) => {
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
    const { category, contentType, title, description, durationOrTarget, status } = req.body;

    const content = await RecoveryContent.findById(id);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Recovery content not found',
      });
    }

    const allowedCategories = [
      'Breathing',
      'Stretching',
      'Sleep',
      'Meditation',
      'Self-Massage',
      'Nutrition',
      'Yoga',
      'Therapy',
      'Relaxation',
    ];
    if (category && allowedCategories.includes(category)) {
      content.category = category;
    }

    const allowedContentTypes = ['Video', 'Article', 'Audio', 'Image'];
    if (contentType && allowedContentTypes.includes(contentType)) {
      content.contentType = contentType;
    }

    if (title != null && title !== '') content.title = title.trim();
    if (description != null && description !== '') content.description = description.trim();
    if (durationOrTarget != null) content.durationOrTarget = durationOrTarget.trim();
    if (status && ['Active', 'Draft'].includes(status)) content.status = status;

    if (req.file) {
      content.mediaPath = req.file.path;
    }

    await content.save();

    return res.json({
      success: true,
      message: 'Recovery content updated successfully',
      result: content,
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

// 6. Delete Recovery Content (soft delete)
const deleteRecoveryContent = async (req, res) => {
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
    const content = await RecoveryContent.findByIdAndUpdate(id, { status: 'Deleted' }, { new: true }).lean();
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Recovery content not found',
      });
    }

    return res.json({
      success: true,
      message: 'Recovery content deleted successfully',
      result: content,
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

// 7. User - Get all active recovery content (optional filters)
const getAllRecoveryContentForUser = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const categoryFilter = req.query.category;
    const contentTypeFilter = req.query.contentType;

    const query = { status: 'Active' };
    if (categoryFilter) query.category = categoryFilter;
    if (contentTypeFilter && ['Video', 'Article', 'Audio', 'Image'].includes(contentTypeFilter)) {
      query.contentType = contentTypeFilter;
    }

    const contentList = await RecoveryContent.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      message: 'Recovery content fetched successfully',
      result: contentList,
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

// 8. User - Get single active recovery content by id
const getRecoveryContentByIdForUser = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;
    const content = await RecoveryContent.findOne({
      _id: id,
      status: 'Active',
    }).lean();

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Recovery content not found',
      });
    }

    return res.json({
      success: true,
      message: 'Recovery content fetched successfully',
      result: content,
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
  addRecoveryContent,
  getAllRecoveryContent,
  getRecoveryContentStats,
  getRecoveryContentById,
  updateRecoveryContent,
  deleteRecoveryContent,
  getAllRecoveryContentForUser,
  getRecoveryContentByIdForUser,
};
