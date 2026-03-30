const mongoose = require('mongoose');

const mealItemSchema = new mongoose.Schema(
  {
    nutritionItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NutritionItem',
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
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

mealLogSchema.index({ userId: 1, date: 1, mealType: 1 });

const MealLog = mongoose.model('MealLog', mealLogSchema);

module.exports = MealLog;

