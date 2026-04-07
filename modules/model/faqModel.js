const mongoose = require('mongoose');

const FAQ_CATEGORIES = [
  'General',
  'Account',
  'Subscription',
  'Workout',
  'Nutrition',
  'Recovery',
];

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: FAQ_CATEGORIES,
      default: 'General',
    },
    /** Active / Inactive (UI); Deleted = soft-deleted */
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

faqSchema.index({ category: 1, status: 1, createdAt: -1 });

const Faq = mongoose.model('Faq', faqSchema);

module.exports = Faq;
module.exports.FAQ_CATEGORIES = FAQ_CATEGORIES;
