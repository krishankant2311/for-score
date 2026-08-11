const fs = require('fs');
const path = require('path');
const Food = require('../model/foodModel');
const { Admin } = require('../model/adminModel');

const USDA_FOOD_SEED_ID = 'usda-sr-legacy';
const FOOD_NAME_MAX = 100;
const FOOD_NAME_PATTERN = /^[a-zA-Z0-9\s\-'.,()&]+$/;
const BATCH_SIZE = 500;

const sanitizeFoodNameForImport = (name) =>
  String(name ?? '')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9\s\-'.,()&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, FOOD_NAME_MAX);

const parseNumber = (raw) => {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

const mapUsdaCategory = (usdaCategory, macros) => {
  const cat = String(usdaCategory || '').toLowerCase();
  if (cat.includes('fruit')) return 'Fruit';
  if (cat.includes('vegetable')) return 'Vegetables';
  if (cat.includes('fats and oils')) return 'Fats';
  if (
    cat.includes('poultry') ||
    cat.includes('beef') ||
    cat.includes('pork') ||
    cat.includes('finfish') ||
    cat.includes('shellfish') ||
    cat.includes('lamb') ||
    cat.includes('veal') ||
    cat.includes('game') ||
    cat.includes('sausages')
  ) {
    return 'Protein';
  }
  if (cat.includes('legume')) return 'Protein';
  if (cat.includes('nut and seed')) return 'Fats';
  if (cat.includes('dairy and egg')) return 'Protein';
  if (
    cat.includes('cereal') ||
    cat.includes('pasta') ||
    cat.includes('baked') ||
    cat.includes('breakfast cereal') ||
    cat.includes('snacks') ||
    cat.includes('sweets') ||
    cat.includes('baby foods')
  ) {
    return 'Carbs';
  }

  const { protein, carbs, fats } = macros;
  if (protein >= 10 && protein >= carbs && protein >= fats) return 'Protein';
  if (fats >= 10 && fats >= protein && fats >= carbs) return 'Fats';
  if (carbs >= 10 && carbs >= protein) return 'Carbs';
  return 'Other';
};

const loadUsdaFoodRowsFromTsv = (tsvPath) => {
  const resolved = path.resolve(tsvPath);
  const raw = fs.readFileSync(resolved, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const docs = [];
  const seenFdc = new Set();

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split('\t');
    if (cols.length < 9) continue;

    const fdcId = parseNumber(cols[0]);
    if (!fdcId || seenFdc.has(fdcId)) continue;
    seenFdc.add(fdcId);

    const name = sanitizeFoodNameForImport(cols[1]);
    if (!name || !FOOD_NAME_PATTERN.test(name)) continue;

    const protein = parseNumber(cols[6]);
    const carbs = parseNumber(cols[7]);
    const fats = parseNumber(cols[8]);
    let calories = Math.round(parseNumber(cols[5]));
    if (!Number.isFinite(calories) || calories < 0) calories = 0;
    if (calories > 9999) calories = 9999;

    const servingDescription = String(cols[3] || '').trim();
    const servingGrams = parseNumber(cols[4]);
    const servingSize =
      servingDescription ||
      (servingGrams ? `${servingGrams} g` : '100 g');

    docs.push({
      fdcId,
      name,
      calories,
      protein,
      carbs,
      fats,
      category: mapUsdaCategory(cols[2], { protein, carbs, fats }),
      servingSize,
      mealType: 'Other',
      image: '',
      status: 'Active',
      seedSource: USDA_FOOD_SEED_ID,
    });
  }

  return docs;
};

/**
 * Replace USDA seed slice (CLI). Requires mongoose already connected.
 * @param {{ tsvPath?: string, dryRun?: boolean }} [options]
 */
async function replaceUsdaFoodSeed(options = {}) {
  const tsvPath =
    options.tsvPath || path.join(__dirname, '../../data/usdaFoods.tsv');
  const dryRun = Boolean(options.dryRun);

  const docs = loadUsdaFoodRowsFromTsv(tsvPath);
  if (!docs.length) {
    throw new Error(`No valid USDA food rows parsed from ${tsvPath}`);
  }

  if (dryRun) {
    return { deleted: 0, inserted: docs.length, dryRun: true };
  }

  const admin = await Admin.findOne({ status: { $ne: 'Deleted' } }).select('_id').lean();
  const createdByAdminId = admin?._id || null;

  const deleteResult = await Food.deleteMany({ seedSource: USDA_FOOD_SEED_ID });

  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE).map((doc) => ({
      ...doc,
      createdByAdminId,
      createdByUserId: null,
    }));
    await Food.insertMany(batch, { ordered: false });
    inserted += batch.length;
  }

  return {
    deleted: deleteResult.deletedCount || 0,
    inserted,
    dryRun: false,
  };
}

module.exports = {
  USDA_FOOD_SEED_ID,
  loadUsdaFoodRowsFromTsv,
  replaceUsdaFoodSeed,
  sanitizeFoodNameForImport,
  mapUsdaCategory,
};
