const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const Quote = mongoose.model('Quote', quoteSchema);

module.exports = Quote;

