const mongoose = require('mongoose');

const PLAN_ACCESS_MODULES = [
  'Fitness Programs',
  'Nutrition & Macros',
  'Recovery',
  'Progress Tracking',
  'Notifications',
  'Mission Log',
  'Today Nutrition',
];

const planSchema = new mongoose.Schema(
  {
    planName: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    tagline: {
      type: String,
      default: '',
      trim: true,
    },
    periodDays: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    features: {
      type: [String],
      default: [],
    },
    planAccess: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

planSchema.index({ status: 1, createdAt: -1 });
planSchema.index({ planName: 1 }, { unique: true });

const Plan = mongoose.model('Plan', planSchema);

module.exports = Plan;
module.exports.PLAN_ACCESS_MODULES = PLAN_ACCESS_MODULES;
