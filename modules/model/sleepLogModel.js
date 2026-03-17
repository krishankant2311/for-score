const mongoose = require('mongoose');

const sleepLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
      // stored as start-of-day (00:00) in user's timezone assumption
    },
    startTime: {
      type: String,
      default: '',
      // e.g. "22:30"
    },
    endTime: {
      type: String,
      default: '',
      // e.g. "06:00"
    },
    totalHours: {
      type: Number,
      required: true,
    },
    quality: {
      type: String,
      enum: ['Poor', 'Fair', 'Good', 'Excellent'],
      default: 'Good',
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

sleepLogSchema.index({ userId: 1, date: 1 });

const SleepLog = mongoose.model('SleepLog', sleepLogSchema);

module.exports = SleepLog;

