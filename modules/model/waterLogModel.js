// One row per user per day. `cups` is the cumulative count for that day so
// the dashboard can render "Water X / 8 cups". A simple cups-based unit
// keeps the API stable across cup-size preferences (8 oz default).
const mongoose = require('mongoose');

const waterLogSchema = new mongoose.Schema(
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
    cups: {
      type: Number,
      default: 0,
      min: 0,
    },
    target: {
      type: Number,
      default: 8,
      min: 1,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

waterLogSchema.index({ userId: 1, date: 1 }, { unique: true });

const WaterLog = mongoose.model('WaterLog', waterLogSchema);

module.exports = WaterLog;
