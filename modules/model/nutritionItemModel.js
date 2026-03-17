const mongoose = require('mongoose');

const nutritionItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
      required: true,
    },
    mealType: {
      type: String,
      enum: ['Vegetarian', 'Non-Vegetarian', 'Vegan'],
      required: true,
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
    description: {
      type: String,
      required: true,
      trim: true,
    },
    alternateFood: {
      type: String,
      default: '',
      trim: true,
    },
    imagePath: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

const NutritionItem = mongoose.model('NutritionItem', nutritionItemSchema);

module.exports = NutritionItem;

