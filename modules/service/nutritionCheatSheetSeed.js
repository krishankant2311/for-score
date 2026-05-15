const NutritionCheatSheet = require('../model/nutritionCheatSheetModel');
const { Admin } = require('../model/adminModel');
const {
  NUTRITION_CHEAT_SHEET_SEED_ID,
  NUTRITION_CHEAT_SHEET_DEFAULT_ROWS,
} = require('./nutritionCheatSheetSeedData');

/**
 * Inserts default cheat-sheet rows if none exist with seedSource (safe on every server boot).
 * @returns {{ inserted: number, skipped: boolean }}
 */
async function ensureNutritionCheatSheetSeed() {
  const existing = await NutritionCheatSheet.countDocuments({
    seedSource: NUTRITION_CHEAT_SHEET_SEED_ID,
  });

  const expected = NUTRITION_CHEAT_SHEET_DEFAULT_ROWS.length;
  if (existing >= expected) {
    return { inserted: 0, skipped: true };
  }

  const admin = await Admin.findOne({ status: { $ne: 'Deleted' } }).select('_id').lean();
  const createdBy = admin?._id || undefined;

  const docs = NUTRITION_CHEAT_SHEET_DEFAULT_ROWS.map((r) => ({
    ...r,
    status: 'Active',
    seedSource: NUTRITION_CHEAT_SHEET_SEED_ID,
    ...(createdBy ? { createdBy } : {}),
  }));

  // Empty DB or partial failed seed: replace only our seed slice so we never duplicate rows.
  if (existing > 0) {
    await NutritionCheatSheet.deleteMany({ seedSource: NUTRITION_CHEAT_SHEET_SEED_ID });
  }

  await NutritionCheatSheet.insertMany(docs);
  console.log(`Nutrition cheat sheet: inserted ${docs.length} default rows`);
  return { inserted: docs.length, skipped: false };
}

/**
 * Replace all rows from this seed (CLI script). Requires mongoose already connected.
 */
async function replaceNutritionCheatSheetSeed() {
  const admin = await Admin.findOne({ status: { $ne: 'Deleted' } }).select('_id').lean();
  const createdBy = admin?._id || undefined;

  await NutritionCheatSheet.deleteMany({ seedSource: NUTRITION_CHEAT_SHEET_SEED_ID });
  const docs = NUTRITION_CHEAT_SHEET_DEFAULT_ROWS.map((r) => ({
    ...r,
    status: 'Active',
    seedSource: NUTRITION_CHEAT_SHEET_SEED_ID,
    ...(createdBy ? { createdBy } : {}),
  }));
  await NutritionCheatSheet.insertMany(docs);
  return docs.length;
}

module.exports = {
  ensureNutritionCheatSheetSeed,
  replaceNutritionCheatSheetSeed,
  NUTRITION_CHEAT_SHEET_SEED_ID,
};
