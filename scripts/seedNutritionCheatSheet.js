/**
 * Force re-seed UI nutrition cheat sheet (deletes prior seed rows, inserts fresh).
 * Run: cd Four_Score && node scripts/seedNutritionCheatSheet.js
 *
 * Normal use: just start the server — ensureNutritionCheatSheetSeed runs automatically.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const { replaceNutritionCheatSheetSeed } = require('../modules/service/nutritionCheatSheetSeed');

async function run() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/four_score';

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const n = await replaceNutritionCheatSheetSeed();
  console.log(`Nutrition cheat sheet seed done. Inserted ${n} rows.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Seed failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
