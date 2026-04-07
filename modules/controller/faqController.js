const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const Faq = require('../model/faqModel');
const { FAQ_CATEGORIES } = Faq;

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;
  const admin = await Admin.findById(admin_id);
  if (!admin || admin.status === 'Deleted') return null;
  return admin;
};

const getValidUser = async (token) => {
  const user_id = token?._id;
  if (!user_id) return null;
  const user = await User.findById(user_id);
  if (!user || user.status === 'Deleted') return null;
  return user;
};

// ---------------- Admin ----------------

const addFaq = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { question, answer, category, status } = req.body;

    if (!question?.trim() || answer == null || String(answer).trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'question and answer are required',
      });
    }

    const cat =
      category && FAQ_CATEGORIES.includes(category) ? category : 'General';
    const statusVal =
      status && ['Active', 'Inactive'].includes(status) ? status : 'Active';

    const faq = await Faq.create({
      question: question.trim(),
      answer: String(answer),
      category: cat,
      status: statusVal,
    });

    return res.json({
      success: true,
      message: 'FAQ created successfully',
      result: faq,
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

const getAllFaqsAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const category = (req.query.category || '').trim();
    const statusFilter = (req.query.status || 'all').toLowerCase();
    const search = (req.query.search || '').trim();

    const query = {};
    if (category && FAQ_CATEGORIES.includes(category)) {
      query.category = category;
    }
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'inactive') query.status = 'Inactive';
    else if (statusFilter === 'deleted') query.status = 'Deleted';
    else query.status = { $in: ['Active', 'Inactive'] };

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.question = regex;
    }

    const faqs = await Faq.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      message: 'FAQs fetched successfully',
      result: faqs,
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

const getFaqByIdAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const faq = await Faq.findById(id).lean();
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found',
      });
    }

    return res.json({
      success: true,
      message: 'FAQ fetched successfully',
      result: faq,
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

const updateFaq = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const { question, answer, category, status } = req.body;

    const faq = await Faq.findById(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found',
      });
    }

    if (question != null && String(question).trim() !== '')
      faq.question = String(question).trim();
    if (answer != null) faq.answer = String(answer);
    if (category != null && FAQ_CATEGORIES.includes(category))
      faq.category = category;
    if (status && ['Active', 'Inactive', 'Deleted'].includes(status))
      faq.status = status;

    await faq.save();

    return res.json({
      success: true,
      message: 'FAQ updated successfully',
      result: faq,
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

const deleteFaq = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const faq = await Faq.findById(id);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found',
      });
    }

    faq.status = 'Deleted';
    await faq.save();

    return res.json({
      success: true,
      message: 'FAQ deleted successfully',
      result: faq,
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

// ---------------- User (read-only, Active only) ----------------

const getFaqsForUser = async (req, res) => {
  try {
    const user = await getValidUser(req.token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const category = (req.query.category || '').trim();
    const query = { status: 'Active' };
    if (category && FAQ_CATEGORIES.includes(category)) {
      query.category = category;
    }

    const faqs = await Faq.find(query).sort({ category: 1, createdAt: -1 }).lean();

    return res.json({
      success: true,
      message: 'FAQs fetched successfully',
      result: faqs,
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

const getFaqByIdForUser = async (req, res) => {
  try {
    const user = await getValidUser(req.token);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const { id } = req.params;
    const faq = await Faq.findOne({ _id: id, status: 'Active' }).lean();
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found',
      });
    }

    return res.json({
      success: true,
      message: 'FAQ fetched successfully',
      result: faq,
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
  addFaq,
  getAllFaqsAdmin,
  getFaqByIdAdmin,
  updateFaq,
  deleteFaq,
  getFaqsForUser,
  getFaqByIdForUser,
};
