const mongoose = require('mongoose');

const stretchProgramSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'All Levels'],
      default: 'Beginner',
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    stretchCount: {
      type: Number,
      required: true,
      min: 1,
    },
    iconKey: {
      type: String,
      default: 'stretch_default',
      trim: true,
    },
    mediaPath: {
      type: String,
      default: '',
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Draft', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

stretchProgramSchema.index({ status: 1, sortOrder: 1 });

const StretchProgram = mongoose.model('StretchProgram', stretchProgramSchema);

module.exports = StretchProgram;
