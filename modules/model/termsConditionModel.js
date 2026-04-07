const mongoose = require('mongoose');

const termsConditionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: '',
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    lastUpdated: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const TermsCondition = mongoose.model('TermsCondition', termsConditionSchema);

module.exports = TermsCondition;

