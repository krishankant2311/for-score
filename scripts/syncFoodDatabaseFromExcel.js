const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require(path.resolve(__dirname, '../../FOUR-Score-main/node_modules/exceljs'));
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Food = require('../modules/model/foodModel');

const parseNumber = (raw) => {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
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
    cat.includes('sausages') ||
    cat.includes('meat')
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
    cat.includes('baby foods') ||
    cat.includes('grain')
  ) {
    return 'Carbs';
  }

  const { protein, carbs, fats } = macros;
  if (protein >= 10 && protein >= carbs && protein >= fats) return 'Protein';
  if (fats >= 10 && fats >= protein && fats >= carbs) return 'Fats';
  if (carbs >= 10 && carbs >= protein && carbs >= fats) return 'Carbs';
  return 'Other';
};

async function syncFoods() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');

  const excelPath = path.resolve(__dirname, '../data/four_score_app_food_database.xlsx');
  console.log('Loading Excel workbook from:', excelPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  console.log('Workbook loaded successfully.');

  // 1. Parse Serving_Sizes sheet into Map<fdcId, Array>
  console.log('\n--- Step 1: Parsing Serving_Sizes ---');
  const servingSheet = workbook.getWorksheet('Serving_Sizes');
  const servingSizesByFdc = new Map();
  let servingCount = 0;

  servingSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const fdc = Number(row.getCell(1).value);
      if (fdc) {
        if (!servingSizesByFdc.has(fdc)) servingSizesByFdc.set(fdc, []);
        servingSizesByFdc.get(fdc).push({
          servingDescription: String(row.getCell(3).value || '').trim(),
          servingGrams: parseNumber(row.getCell(4).value),
          calories: Math.round(parseNumber(row.getCell(5).value)),
          protein: parseNumber(row.getCell(6).value),
          carbs: parseNumber(row.getCell(7).value),
          fats: parseNumber(row.getCell(8).value),
        });
        servingCount++;
      }
    }
  });
  console.log(`Parsed ${servingCount} serving rows across ${servingSizesByFdc.size} distinct FDC IDs.`);

  // 2. Process 'Foods' Sheet (SR Legacy Standard Catalog)
  console.log('\n--- Step 2: Syncing Foods Sheet (SR Legacy Catalog) ---');
  const foodsSheet = workbook.getWorksheet('Foods');
  const foodOps = [];
  let foodsProcessed = 0;

  foodsSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const fdcId = Number(row.getCell(1).value);
      const name = String(row.getCell(2).value || '').trim();
      if (!fdcId || !name) return;

      const rawCat = row.getCell(3).value;
      const servingDesc = String(row.getCell(4).value || '').trim();
      const servingGrams = parseNumber(row.getCell(5).value);
      const cal = Math.max(0, Math.round(parseNumber(row.getCell(6).value)));
      const protein = parseNumber(row.getCell(7).value);
      const carbs = parseNumber(row.getCell(8).value);
      const fats = parseNumber(row.getCell(9).value);

      const cal100 = Math.max(0, Math.round(parseNumber(row.getCell(10).value)));
      const protein100 = parseNumber(row.getCell(11).value);
      const carbs100 = parseNumber(row.getCell(12).value);
      const fats100 = parseNumber(row.getCell(13).value);

      const fiber = parseNumber(row.getCell(14).value);
      const sugar = parseNumber(row.getCell(15).value);
      const sodium = parseNumber(row.getCell(16).value);

      const servingSize = servingDesc || (servingGrams ? `${servingGrams} g` : '100 g');
      const sheetCategory = String(rawCat || '').trim() || 'Other';
      const extraServings = servingSizesByFdc.get(fdcId) || [];

      foodOps.push({
        updateOne: {
          filter: { fdcId },
          update: {
            $set: {
              name,
              servingSize,
              servingGrams: servingGrams || (servingDesc.match(/\b(\d+)\s*g\b/i) ? Number(servingDesc.match(/\b(\d+)\s*g\b/i)[1]) : null),
              servingSizes: extraServings,
              calories: cal > 9999 ? 9999 : cal,
              protein,
              carbs,
              fats,
              calories_per_serving: cal > 9999 ? 9999 : cal,
              protein_g_per_serving: protein,
              carbs_g_per_serving: carbs,
              fat_g_per_serving: fats,
              calories_per_100g: cal100,
              protein_g_per_100g: protein100,
              carbs_g_per_100g: carbs100,
              fat_g_per_100g: fats100,
              fiber,
              sugar,
              sodium,
              category: sheetCategory,
              seedSource: 'usda-sr-legacy',
              status: 'Active',
            },
            $setOnInsert: {
              createdByUserId: null,
              createdByAdminId: null,
              image: '',
              mealType: 'Other',
            },
          },
          upsert: true,
        },
      });
      foodsProcessed++;
    }
  });

  console.log(`Executing bulkWrite for ${foodOps.length} Foods rows...`);
  const BATCH_SIZE = 1000;
  for (let i = 0; i < foodOps.length; i += BATCH_SIZE) {
    const chunk = foodOps.slice(i, i + BATCH_SIZE);
    await Food.bulkWrite(chunk, { ordered: false });
    console.log(`Updated ${Math.min(i + BATCH_SIZE, foodOps.length)} / ${foodOps.length} foods`);
  }

  // 3. Process 'Branded_Packaged' Sheet
  console.log('\n--- Step 3: Syncing Branded_Packaged Sheet ---');
  const brandedSheet = workbook.getWorksheet('Branded_Packaged');
  const brandedOps = [];

  brandedSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const fdcId = Number(row.getCell(1).value);
      const brand = String(row.getCell(2).value || '').trim();
      const name = String(row.getCell(3).value || '').trim();
      if (!fdcId || !name) return;

      const rawCat = row.getCell(4).value;
      const servingDesc = String(row.getCell(5).value || '').trim();
      const servingGrams = parseNumber(row.getCell(6).value);
      const cal = Math.max(0, Math.round(parseNumber(row.getCell(7).value)));
      const protein = parseNumber(row.getCell(8).value);
      const carbs = parseNumber(row.getCell(9).value);
      const fats = parseNumber(row.getCell(10).value);
      const fiber = parseNumber(row.getCell(11).value);
      const sugar = parseNumber(row.getCell(12).value);
      const sodium = parseNumber(row.getCell(13).value);
      const upc = String(row.getCell(14).value || '').trim();

      const cal100 = servingGrams > 0 ? Math.round((cal / servingGrams) * 100) : cal;
      const protein100 = servingGrams > 0 ? Math.round((protein / servingGrams) * 100 * 100) / 100 : protein;
      const carbs100 = servingGrams > 0 ? Math.round((carbs / servingGrams) * 100 * 100) / 100 : carbs;
      const fats100 = servingGrams > 0 ? Math.round((fats / servingGrams) * 100 * 100) / 100 : fats;

      const servingSize = servingDesc || (servingGrams ? `${servingGrams} g` : '100 g');
      const sheetCategory = String(rawCat || '').trim() || 'Other';

      brandedOps.push({
        updateOne: {
          filter: { fdcId },
          update: {
            $set: {
              name,
              brand,
              upc: upc || '',
              servingSize,
              servingGrams: servingGrams || null,
              calories: cal > 9999 ? 9999 : cal,
              protein,
              carbs,
              fats,
              calories_per_serving: cal > 9999 ? 9999 : cal,
              protein_g_per_serving: protein,
              carbs_g_per_serving: carbs,
              fat_g_per_serving: fats,
              calories_per_100g: cal100,
              protein_g_per_100g: protein100,
              carbs_g_per_100g: carbs100,
              fat_g_per_100g: fats100,
              fiber,
              sugar,
              sodium,
              category: sheetCategory,
              seedSource: 'usda-branded',
              status: 'Active',
            },
            $setOnInsert: {
              createdByUserId: null,
              createdByAdminId: null,
              image: '',
              mealType: 'Other',
            },
          },
          upsert: true,
        },
      });
    }
  });

  console.log(`Executing bulkWrite for ${brandedOps.length} Branded rows...`);
  for (let i = 0; i < brandedOps.length; i += BATCH_SIZE) {
    const chunk = brandedOps.slice(i, i + BATCH_SIZE);
    await Food.bulkWrite(chunk, { ordered: false });
    console.log(`Synced ${Math.min(i + BATCH_SIZE, brandedOps.length)} / ${brandedOps.length} branded foods`);
  }

  // 4. Verify Final Database Counts
  console.log('\n--- Step 4: Verification ---');
  const totalInDb = await Food.countDocuments({});
  const activeInDb = await Food.countDocuments({ status: 'Active' });
  const srLegacyCount = await Food.countDocuments({ seedSource: 'usda-sr-legacy' });
  const brandedCount = await Food.countDocuments({ seedSource: 'usda-branded' });
  const hasServingGrams = await Food.countDocuments({ servingGrams: { $ne: null } });
  const hasServingSizesArr = await Food.countDocuments({ 'servingSizes.0': { $exists: true } });

  console.log('FINAL_STATS:' + JSON.stringify({
    totalInDb,
    activeInDb,
    srLegacyCount,
    brandedCount,
    hasServingGrams,
    hasServingSizesArr,
  }, null, 2));

  await mongoose.disconnect();
  console.log('Finished successfully!');
}

syncFoods().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
