const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
      default: 0,
    },
    carbs: {
      type: Number,
      default: 0,
    },
    fats: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      enum: ['Protein', 'Carbs', 'Vegetables', 'Fruit', 'Fats', 'Other'],
      default: 'Other',
    },
    mealType: {
      type: String,
      enum: ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Other'],
      default: 'Other',
    },
    servingSize: {
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

const Food = mongoose.model('Food', foodSchema);

module.exports = Food;

