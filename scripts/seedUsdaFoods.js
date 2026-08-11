/**
 * Import client USDA food catalog into admin global foods.
 * Run: cd Four_Score && node scripts/seedUsdaFoods.js
 * Dry run: node scripts/seedUsdaFoods.js --dry-run
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const { replaceUsdaFoodSeed } = require('../modules/service/usdaFoodSeed');

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/four_score';

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const result = await replaceUsdaFoodSeed({ dryRun });
  if (result.dryRun) {
    console.log(`Dry run: would insert ${result.inserted} USDA foods.`);
  } else {
    console.log(
      `USDA food seed done. Removed ${result.deleted}, inserted ${result.inserted} rows.`
    );
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('USDA food seed failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
