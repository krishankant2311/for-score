const mongoose = require('mongoose');

const programSchema = new mongoose.Schema(
  {
    programName: {
      type: String,
      required: true,
      trim: true,
    },
    /** Legacy / recommendation matching; optional on create if goalText is set */
    primaryGoal: {
      type: String,
      default: '',
      trim: true,
    },
    locationTag: {
      type: String,
      default: '',
      trim: true,
    },
    workoutSkillLevel: {
      type: String,
      required: true,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Any', 'Beg / Int'],
    },
    workoutPreference: {
      type: String,
      default: '',
      trim: true,
    },
    /** Legacy string (e.g. "5"); kept for filters / older clients */
    frequency: {
      type: String,
      default: '',
      trim: true,
    },
    /** Quick stats (aligned with admin UI) */
    durationWeeks: {
      type: Number,
      default: null,
    },
    daysPerWeek: {
      type: Number,
      default: null,
    },
    avgSessionMinutes: {
      type: Number,
      default: null,
    },
    /** One item per line in UI; mirrors quickStats.necessaryEquipment when saving */
    equipment: {
      type: [String],
      default: [],
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
    /** Multiline in UI → parsed to lines in API */
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
      enum: ['Active', 'Inactive', 'Draft', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const Program = mongoose.model('Program', programSchema);

module.exports = Program;

