const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema(
  {
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
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
      enum: [
        'Breakfast',
        'Morning Snack',
        'Lunch',
        'Evening Snack',
        'Snack',
        'Dinner',
        'Other',
      ],
      default: 'Other',
    },
    servingSize: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
    /** USDA FoodData Central id — used for bulk seed dedup */
    fdcId: {
      type: Number,
      default: null,
      index: true,
      sparse: true,
    },
    /** e.g. usda-sr-legacy — bulk seeds only; admin manual adds leave empty */
    seedSource: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

const Food = mongoose.model('Food', foodSchema);

module.exports = Food;

