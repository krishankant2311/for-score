// One log per user per calendar day (workout "Log Body Weight" history).
const mongoose = require('mongoose');

const bodyWeightLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      default: 'lbs',
      enum: ['lbs'],
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

bodyWeightLogSchema.index({ userId: 1, date: 1 }, { unique: true });
bodyWeightLogSchema.index({ userId: 1, status: 1, date: -1 });

const BodyWeightLog = mongoose.model('BodyWeightLog', bodyWeightLogSchema);

module.exports = BodyWeightLog;
