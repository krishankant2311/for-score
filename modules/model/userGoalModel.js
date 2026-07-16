// User Goals for the dashboard "Your Goals" card.
// Each goal has a current/target value with a unit (lbs, km, reps, etc.).
// One goal per user may be flagged `isPrimary: true` and is shown as the
// "Primary Target" header on the dashboard.
const mongoose = require('mongoose');

const userGoalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // High-level bucket used to render the icon + chip color on the dashboard.
    // Free-form string — the UI maps known values to icons and falls back to
    // "Custom" for anything else.
    category: {
      type: String,
      default: '',
      trim: true,
    },
    // Optional sub-label rendered under the title (e.g. "Weight Loss", "Endurance").
    subtitle: {
      type: String,
      default: '',
      trim: true,
    },
    startValue: {
      type: Number,
      default: 0,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    targetValue: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      default: '',
      trim: true,
    },
    // True for the single goal rendered at the top of the dashboard as
    // "PRIMARY TARGET" with Current / Target / To Go tiles.
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    targetDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    // 'user'           — manually added by the user from the dashboard.
    // 'system:weight'  — auto-managed primary goal synced from profile
    //                    (current weight + target weight). Re-synced whenever
    //                    those fields change, so we never duplicate it.
    source: {
      type: String,
      enum: ['user', 'system:weight'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

userGoalSchema.index({ userId: 1, status: 1, isPrimary: -1, createdAt: -1 });
userGoalSchema.index({ userId: 1, source: 1, status: 1 });

const UserGoal = mongoose.model('UserGoal', userGoalSchema);

module.exports = UserGoal;
