const mongoose = require('mongoose');

const workoutSetSchema = new mongoose.Schema(
  {
    setNumber: {
      type: Number,
      required: true,
    },
    weight: {
      type: Number,
      required: true,
    },
    reps: {
      type: Number,
      required: true,
    },
    previousWeight: {
      type: Number,
      default: null,
    },
    previousReps: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const workoutLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    exerciseName: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    sets: {
      type: [workoutSetSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

workoutLogSchema.index({ userId: 1, date: 1, exerciseName: 1 });

const WorkoutLog = mongoose.model('WorkoutLog', workoutLogSchema);

module.exports = WorkoutLog;

