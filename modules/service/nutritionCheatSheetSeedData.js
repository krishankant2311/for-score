/** Matches UI cheat sheet; re-used by startup seed + scripts/seedNutritionCheatSheet.js */
const NUTRITION_CHEAT_SHEET_SEED_ID = 'ui_nutrition_cheat_sheet_v1';

const NUTRITION_CHEAT_SHEET_DEFAULT_ROWS = [
  { name: 'Chicken Breast', servingSize: '100g', macroType: 'protein', macroAmountGrams: 31, calories: 165, sortOrder: 0 },
  { name: 'Salmon', servingSize: '100g', macroType: 'protein', macroAmountGrams: 25, calories: 206, sortOrder: 1 },
  { name: 'Greek Yogurt', servingSize: '170g', macroType: 'protein', macroAmountGrams: 17, calories: 100, sortOrder: 2 },
  { name: 'Eggs', servingSize: '2 large', macroType: 'protein', macroAmountGrams: 12, calories: 140, sortOrder: 3 },
  { name: 'Lean Beef', servingSize: '100g', macroType: 'protein', macroAmountGrams: 26, calories: 250, sortOrder: 4 },
  { name: 'Tuna', servingSize: '100g', macroType: 'protein', macroAmountGrams: 30, calories: 132, sortOrder: 5 },
  { name: 'Cottage Cheese', servingSize: '100g', macroType: 'protein', macroAmountGrams: 11, calories: 98, sortOrder: 6 },
  { name: 'Protein Powder', servingSize: '1 scoop', macroType: 'protein', macroAmountGrams: 24, calories: 120, sortOrder: 7 },
  { name: 'Brown Rice', servingSize: '100g cooked', macroType: 'carb', macroAmountGrams: 23, calories: 111, sortOrder: 0 },
  { name: 'Sweet Potato', servingSize: '100g', macroType: 'carb', macroAmountGrams: 20, calories: 86, sortOrder: 1 },
  { name: 'Oatmeal', servingSize: '40g dry', macroType: 'carb', macroAmountGrams: 27, calories: 150, sortOrder: 2 },
  { name: 'Quinoa', servingSize: '100g cooked', macroType: 'carb', macroAmountGrams: 21, calories: 120, sortOrder: 3 },
  { name: 'Whole Wheat Bread', servingSize: '2 slices', macroType: 'carb', macroAmountGrams: 24, calories: 140, sortOrder: 4 },
  { name: 'Banana', servingSize: '1 medium', macroType: 'carb', macroAmountGrams: 27, calories: 105, sortOrder: 5 },
  { name: 'Pasta', servingSize: '100g cooked', macroType: 'carb', macroAmountGrams: 25, calories: 131, sortOrder: 6 },
  { name: 'White Rice', servingSize: '100g cooked', macroType: 'carb', macroAmountGrams: 28, calories: 130, sortOrder: 7 },
  { name: 'Avocado', servingSize: '100g', macroType: 'fat', macroAmountGrams: 15, calories: 160, sortOrder: 0 },
  { name: 'Almonds', servingSize: '28g (1oz)', macroType: 'fat', macroAmountGrams: 14, calories: 164, sortOrder: 1 },
  { name: 'Olive Oil', servingSize: '1 tbsp', macroType: 'fat', macroAmountGrams: 14, calories: 120, sortOrder: 2 },
  { name: 'Peanut Butter', servingSize: '2 tbsp', macroType: 'fat', macroAmountGrams: 16, calories: 190, sortOrder: 3 },
  { name: 'Salmon', servingSize: '100g', macroType: 'fat', macroAmountGrams: 13, calories: 208, sortOrder: 4 },
  { name: 'Cheese', servingSize: '28g', macroType: 'fat', macroAmountGrams: 9, calories: 113, sortOrder: 5 },
  { name: 'Cashews', servingSize: '28g', macroType: 'fat', macroAmountGrams: 12, calories: 157, sortOrder: 6 },
  { name: 'Coconut Oil', servingSize: '1 tbsp', macroType: 'fat', macroAmountGrams: 14, calories: 121, sortOrder: 7 },
];

module.exports = {
  NUTRITION_CHEAT_SHEET_SEED_ID,
  NUTRITION_CHEAT_SHEET_DEFAULT_ROWS,
};
