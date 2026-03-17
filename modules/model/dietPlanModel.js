const mongoose = require('mongoose');

const dietPlanSchema = new mongoose.Schema(
  {
    mealType: {
      type: String,
      required: true,
      enum: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
    },
    foodItems: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Oatmeal, Banana, Almonds"
    },
    calories: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const DietPlan = mongoose.model('DietPlan', dietPlanSchema);

module.exports = DietPlan;
