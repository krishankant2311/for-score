/**
 * Bulk-import client exercise video/thumbnail URLs into program exercise slots.
 * Run: cd Four_Score && node scripts/importExerciseMedia.js
 * Dry run: node scripts/importExerciseMedia.js --dry-run
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');
const { importExerciseMedia } = require('../modules/service/exerciseMediaImport');

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/four_score';

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const stats = await importExerciseMedia({ Program, dryRun });

  console.log(`Exercise media import ${dryRun ? '(dry run)' : 'complete'}`);
  console.log(`Catalog rows with media: ${stats.catalogRows}`);
  console.log(`Programs ${dryRun ? 'would update' : 'updated'}: ${stats.programUpdates}`);
  console.log(`Exercise slots ${dryRun ? 'would update' : 'updated'}: ${stats.slotUpdates}`);
  console.log(`Applied pairings: ${stats.applied.length}`);
  console.log(`Skipped (exercise not in program): ${stats.skippedNoExercise.length}`);
  console.log(`Skipped (program missing in DB): ${stats.skippedNoProgram.length}`);

  if (stats.unknownProgramLabels.length) {
    console.log('\nUnmapped program labels in sheet:');
    for (const label of stats.unknownProgramLabels) {
      console.log(`  - ${label}`);
    }
  }

  const byProgram = {};
  for (const row of stats.applied) {
    byProgram[row.programCode] = (byProgram[row.programCode] || 0) + 1;
  }
  console.log('\nMatches per program:');
  for (const [code, count] of Object.entries(byProgram).sort()) {
    console.log(`  ${code}: ${count}`);
  }

  if (stats.skippedNoExercise.length > 0 && stats.skippedNoExercise.length <= 30) {
    console.log('\nSample skipped (not in program):');
    for (const s of stats.skippedNoExercise.slice(0, 20)) {
      console.log(`  ${s.programCode} | ${s.exerciseName}`);
    }
  } else if (stats.skippedNoExercise.length > 30) {
    console.log(`\n(${stats.skippedNoExercise.length} exercise/program skips — sheet superset vs DB)`);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Exercise media import failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
