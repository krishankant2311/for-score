const mongoose = require('mongoose');

const MACRO_TYPES = ['protein', 'carb', 'fat'];

const nutritionCheatSheetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    servingSize: {
      type: String,
      required: true,
      trim: true,
    },
    macroType: {
      type: String,
      enum: MACRO_TYPES,
      required: true,
    },
    macroAmountGrams: {
      type: Number,
      required: true,
      min: 0,
    },
    calories: {
      type: Number,
      required: true,
      min: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
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

const NutritionCheatSheet = mongoose.model('NutritionCheatSheet', nutritionCheatSheetSchema);

module.exports = NutritionCheatSheet;
module.exports.MACRO_TYPES = MACRO_TYPES;
