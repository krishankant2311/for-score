const mongoose = require('mongoose');

const mealItemSchema = new mongoose.Schema(
  {
    foodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Food',
      default: null,
    },
    nutritionItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NutritionItem',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    calories: {
      type: Number,
      required: true,
    },
    protein: {
      type: Number,
      required: true,
    },
    carbs: {
      type: Number,
      required: true,
    },
    fats: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
    },
    mealTime: {
      type: String,
      default: '',
      trim: true,
    },
    servingSize: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const mealLogSchema = new mongoose.Schema(
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
    mealType: {
      type: String,
      enum: ['Breakfast', 'Morning Snack', 'Lunch', 'Evening Snack', 'Dinner', 'Snack', 'Other'],
      required: true,
    },
    items: {
      type: [mealItemSchema],
      default: [],
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

mealLogSchema.index({ userId: 1, date: 1, mealType: 1 });

/** Ensure completed meals always have a timestamp (fixes gaps from older clients/paths). */
mealLogSchema.pre('save', function ensureCompletedAt(next) {
  if (this.isCompleted === true && (this.completedAt == null || this.completedAt === '')) {
    this.completedAt = new Date();
  }
  if (this.isCompleted === false) {
    this.completedAt = null;
  }
  next();
});

const MealLog = mongoose.model('MealLog', mealLogSchema);

module.exports = MealLog;

