const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      // required: true,
      trim: true,
    },
    email: {
      type: String,
      // required: true,
      // unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'Null'],
      default: 'Null',
    },
    age: {
      type: Number,
      default: "",
    },
    height: {
      type: Number,
      default: "",
    },
    weight: {
      type: Number,
      default: "",
    },
    workoutSkillLevel: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'NULL'],
      default: 'NULL',
    },
    workoutPreferences: {
      type: String,
      default: 'NULL',
      // comma-separated for multiple e.g. "CROSSFIT,HIIT,YOGA"
    },
    workoutDuration: {
      type: Number,
      default: "",
    },
    fitnessTarget: {
      type: String,
      enum: ['WEIGHTLOSS', 'MUSCLEGAIN', 'STRENGTH', 'GENRALFITNESS', 'NULL'],
      default: 'NULL',
    },
    targetweight: {
      type: Number,
      default: "",
    },
    // Goal Duration - How long to reach goal (8w, 12w, 16w, 24w)
    goalDuration: {
      type: String,
      enum: ['8w', '12w', '16w', '24w'],
      default: '12w',
    },
    // Workout Frequency - Days per week (3, 4, 5, 6)
    workoutFrequency: {
      type: Number,
      enum: [3, 4, 5, 6],
      default: 4,
    },
    // Last Workout - When did user last work out
    lastWorkout: {
      type: String,
      enum: ['last_week', 'last_month', 'last_6_months', 'never_or_over_a_year'],
      default: null,
    },
    // Training Location - Home or Gym
    trainingLocation: {
      type: String,
      default: "",
    },
    // Your fitness goal - target weight change per week (Lose 1 lb, Lose 0.5 lb, Maintain, Gain 0.5 lb, Gain 1 lb)
    weeklyWeightGoal: {
      type: String,
      enum: ['lose_1', 'lose_0_5', 'maintain', 'gain_0_5', 'gain_1'],
      default: null,
    },
    // Daily calorie adjustment in kcal (-500, -250, 0, 250, 500)
    calorieAdjustment: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ['Active', 'Blocked', 'Deleted', 'Pending'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
