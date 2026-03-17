const mongoose = require('mongoose');

const programSchema = new mongoose.Schema(
  {
    programName: {
      type: String,
      required: true,
      trim: true,
    },
    primaryGoal: {
      type: String,
      required: true,
      trim: true,
    },
    locationTag: {
      type: String,
      required: true,
      trim: true,
    },
    workoutSkillLevel: {
      type: String,
      required: true,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
    },
    workoutPreference: {
      type: String,
      required: true,
      trim: true,
    },
    frequency: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Draft', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const Program = mongoose.model('Program', programSchema);

module.exports = Program;

