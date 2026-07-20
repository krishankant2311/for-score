const mongoose = require('mongoose');

const stretchMovementSchema = new mongoose.Schema(
  {
    sequenceOrder: { type: Number, required: true, min: 1 },
    sequenceLabel: { type: String, default: '', trim: true },
    movementName: { type: String, required: true, trim: true },
    targetArea: { type: String, default: '', trim: true },
    timeLabel: { type: String, default: '', trim: true },
  },
  { _id: false }
);

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
    intro: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: 'Recover',
      trim: true,
    },
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'All Levels'],
      default: 'All Levels',
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 999,
    },
    stretchCount: {
      type: Number,
      required: true,
      min: 1,
    },
    movements: {
      type: [stretchMovementSchema],
      default: [],
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
    seedSource: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

stretchProgramSchema.index({ status: 1, sortOrder: 1 });

const StretchProgram = mongoose.model('StretchProgram', stretchProgramSchema);

module.exports = StretchProgram;
