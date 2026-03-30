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
    subHeader: {
      type: String,
      default: '',
      trim: true,
    },
    overview: {
      type: String,
      default: '',
      trim: true,
    },
    whatsInside: {
      type: [String],
      default: [],
    },
    isThisForYou: {
      type: [String],
      default: [],
    },
    goalText: {
      type: String,
      default: '',
      trim: true,
    },
    quickStats: {
      level: { type: String, default: '' },
      duration: { type: String, default: '' },
      frequency: { type: String, default: '' },
      avgSessionMinutes: { type: Number, default: null },
      locationTag: { type: String, default: '' },
      necessaryEquipment: { type: [String], default: [] },
    },
    weekGrid: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // e.g. { "1": { "mon": "...", "tue": "..." }, ... }
    },
    exerciseLibrary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // e.g. { workoutA: [...], workoutB: [...], workoutC: [...] }
    },
    recoveryProtocol: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // e.g. { tue: {...}, thu: {...} }
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

