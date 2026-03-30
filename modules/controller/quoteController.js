const { Admin } = require('../model/adminModel');
const User = require('../model/userModel');
const Quote = require('../model/quoteModel');

const getValidAdmin = async (token) => {
  const admin_id = token?._id;
  if (!admin_id) return null;

  const admin = await Admin.findById(admin_id);
  if (!admin) return null;
  if (admin.status === 'Deleted') return null;
  return admin;
};

// Admin: Add Quote
const addQuote = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { text, author } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'text is required',
      });
    }

    const quote = await Quote.create({
      text: text.trim(),
      author: (author || '').trim(),
    });

    return res.json({
      success: true,
      message: 'Quote added successfully',
      result: quote,
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

// Admin: Get all Quotes
const getAllQuotesAdmin = async (req, res) => {
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

    const quotes = await Quote.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      message: 'Quotes fetched successfully',
      result: quotes,
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

// Admin: Get Quote by ID
const getQuoteByIdAdmin = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const quote = await Quote.findById(id).lean();

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found',
      });
    }

    return res.json({
      success: true,
      message: 'Quote fetched successfully',
      result: quote,
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

// Admin: Update Quote
const updateQuote = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const { text, author, status } = req.body;

    const quote = await Quote.findById(id);
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found',
      });
    }

    if (text != null && text !== '') quote.text = text.trim();
    if (author != null) quote.author = (author || '').trim();
    if (status && ['Active', 'Deleted'].includes(status)) quote.status = status;

    await quote.save();

    return res.json({
      success: true,
      message: 'Quote updated successfully',
      result: quote,
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

// Admin: Soft delete Quote
const deleteQuote = async (req, res) => {
  try {
    const admin = await getValidAdmin(req.token);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found or inactive',
      });
    }

    const { id } = req.params;
    const quote = await Quote.findById(id);

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found',
      });
    }

    quote.status = 'Deleted';
    await quote.save();

    return res.json({
      success: true,
      message: 'Quote deleted successfully',
      result: quote,
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

// User/Admin: Get all active quotes
const getQuotesForUser = async (req, res) => {
  try {
    const token = req.token;
    if (!token?._id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const quotes = await Quote.find({ status: { $ne: 'Deleted' } })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Quotes fetched successfully',
      result: quotes,
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
  addQuote,
  getAllQuotesAdmin,
  getQuoteByIdAdmin,
  updateQuote,
  deleteQuote,
  getQuotesForUser,
};

