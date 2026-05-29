const mongoose = require('mongoose');

const stretchSessionLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StretchProgram',
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
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

stretchSessionLogSchema.index({ userId: 1, date: -1 });
stretchSessionLogSchema.index({ userId: 1, programId: 1 });

const StretchSessionLog = mongoose.model('StretchSessionLog', stretchSessionLogSchema);

module.exports = StretchSessionLog;
