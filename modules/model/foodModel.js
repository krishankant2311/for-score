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
    servingGrams: {
      type: Number,
      default: null,
    },
    servingSizes: [
      {
        servingDescription: { type: String, default: '' },
        servingGrams: { type: Number, default: 0 },
        calories: { type: Number, default: 0 },
        protein: { type: Number, default: 0 },
        carbs: { type: Number, default: 0 },
        fats: { type: Number, default: 0 },
      },
    ],
    fiber: {
      type: Number,
      default: 0,
    },
    sugar: {
      type: Number,
      default: 0,
    },
    sodium: {
      type: Number,
      default: 0,
    },
    brand: {
      type: String,
      default: '',
      trim: true,
    },
    upc: {
      type: String,
      default: '',
      trim: true,
      index: true,
      sparse: true,
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
    /** e.g. usda-sr-legacy, usda-branded — bulk seeds only; admin manual adds leave empty */
    seedSource: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

foodSchema.index({ status: 1, name: 1 });
foodSchema.index({ status: 1, category: 1 });

const Food = mongoose.model('Food', foodSchema);

module.exports = Food;

