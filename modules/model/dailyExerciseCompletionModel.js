const mongoose = require('mongoose');

/** Per user per calendar day — which program exercise slots marked complete */
const dailyExerciseCompletionSchema = new mongoose.Schema(
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
    completedSlotKeys: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

dailyExerciseCompletionSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyExerciseCompletion', dailyExerciseCompletionSchema);
