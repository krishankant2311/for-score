const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const Feedback = require('../model/feedbackModel');

// Helper: validate admin from token
const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;

  const admin = await Admin.findById(admin_id);
  if (!admin) return null;
  if (admin.status === 'Deleted') return null;
  return admin;
};

// 1. User - Send feedback
const addFeedback = async (req, res) => {
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

    const { feedbackType, type, email, message } = req.body;
    const resolvedType = feedbackType || type;

    if (!resolvedType || !message) {
      return res.status(400).json({
        success: false,
        message: 'feedbackType/type and message are required',
      });
    }

    const allowedTypes = ['General', 'Bug', 'Feature'];
    if (!allowedTypes.includes(resolvedType)) {
      return res.status(400).json({
        success: false,
        message: 'feedbackType must be General, Bug or Feature',
      });
    }

    const feedback = await Feedback.create({
      userId: user_id,
      type: resolvedType,
      email: (email || '').trim(),
      message: message.trim(),
    });

    return res.json({
      success: true,
      message: 'Feedback submitted successfully',
      result: feedback,
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

// 2. User - Get all feedback submitted by logged-in user (non-deleted)
const getMyFeedbacks = async (req, res) => {
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

    const feedbacks = await Feedback.find({
      userId: user_id,
      status: { $ne: 'Deleted' },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Your feedback fetched successfully',
      result: feedbacks,
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

// 3. User - Get single feedback by id (owned by logged-in user)
const getMyFeedbackById = async (req, res) => {
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

    const { id } = req.params;
    const feedback = await Feedback.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    }).lean();

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    return res.json({
      success: true,
      message: 'Feedback fetched successfully',
      result: feedback,
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

// 4. User - Update own feedback
const updateMyFeedback = async (req, res) => {
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

    const { id } = req.params;
    const { feedbackType, type, email, message } = req.body;
    const resolvedType = feedbackType || type;

    const feedback = await Feedback.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    if (resolvedType) {
      const allowedTypes = ['General', 'Bug', 'Feature'];
      if (!allowedTypes.includes(resolvedType)) {
        return res.status(400).json({
          success: false,
          message: 'feedbackType must be General, Bug or Feature',
        });
      }
      feedback.type = resolvedType;
    }

    if (email != null) {
      feedback.email = (email || '').trim();
    }
    if (message != null && message !== '') {
      feedback.message = message.trim();
    }

    await feedback.save();

    return res.json({
      success: true,
      message: 'Feedback updated successfully',
      result: feedback,
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

// 5. User - Soft delete own feedback
const deleteMyFeedback = async (req, res) => {
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

    const { id } = req.params;
    const feedback = await Feedback.findOne({
      _id: id,
      userId: user_id,
    });

    if (!feedback || feedback.status === 'Deleted') {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    feedback.status = 'Deleted';
    await feedback.save();

    return res.json({
      success: true,
      message: 'Feedback deleted successfully',
      result: feedback,
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

// 6. Admin - Get all feedback (with optional filters)
const getAllFeedbackAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const typeFilter = req.query.type;
    const statusFilter = (req.query.status || 'all').toLowerCase();

    const query = {};
    if (typeFilter && ['General', 'Bug', 'Feature'].includes(typeFilter)) {
      query.type = typeFilter;
    }
    if (statusFilter === 'new') query.status = 'New';
    else if (statusFilter === 'inprogress') query.status = 'InProgress';
    else if (statusFilter === 'resolved') query.status = 'Resolved';
    else if (statusFilter === 'deleted') query.status = 'Deleted';

    const feedbacks = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Feedback list fetched successfully',
      result: feedbacks,
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

// 7. Admin - Get feedback by ID
const getFeedbackByIdAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const feedback = await Feedback.findById(id).lean();

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    return res.json({
      success: true,
      message: 'Feedback fetched successfully',
      result: feedback,
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

// 8. Admin - Update feedback status
const updateFeedbackStatus = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'status is required',
      });
    }

    const allowedStatus = ['New', 'InProgress', 'Resolved', 'Deleted'];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be New, InProgress, Resolved or Deleted',
      });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    feedback.status = status;
    await feedback.save();

    return res.json({
      success: true,
      message: 'Feedback status updated successfully',
      result: feedback,
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

// 9. Admin - Soft delete feedback
const deleteFeedback = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const feedback = await Feedback.findById(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    feedback.status = 'Deleted';
    await feedback.save();

    return res.json({
      success: true,
      message: 'Feedback deleted successfully',
      result: feedback,
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
  addFeedback,
  getMyFeedbacks,
  getMyFeedbackById,
  updateMyFeedback,
  deleteMyFeedback,
  getAllFeedbackAdmin,
  getFeedbackByIdAdmin,
  updateFeedbackStatus,
  deleteFeedback,
};

