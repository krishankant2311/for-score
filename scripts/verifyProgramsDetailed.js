require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const codes = [
    'foundations_28_day',
    'intermediate_strength_8_week',
    'elite_mastery_8_week',
    'ignite_28_day',
    'shred_burn_hiit',
    'elite_metabolic',
    'bodyweight_basics',
    'core_flow',
    'functional_strength_mastery',
    'united_frontier_crossfit',
    'express_15_minute',
    'radiant_forge_prenatal',
    'shred_to_stage_12_week',
  ];

  const rows = await Program.find({ programCode: { $in: codes }, status: { $ne: 'Deleted' } })
    .select('programCode programName weekGrid exerciseLibrary recoveryProtocol')
    .lean();

  let ok = 0;
  rows.forEach((row) => {
    const hasWeekGrid = !!row.weekGrid && Object.keys(row.weekGrid).length > 0;
    const hasLibrary = !!row.exerciseLibrary && Object.keys(row.exerciseLibrary).length > 0;
    const hasRecovery = !!row.recoveryProtocol && Object.keys(row.recoveryProtocol).length > 0;
    const pass = hasWeekGrid && hasLibrary && hasRecovery;
    if (pass) ok += 1;
    console.log(`${pass ? 'OK' : 'MISS'} | ${row.programCode} | ${row.programName}`);
  });

  console.log(`Detailed verify: ${ok}/${codes.length} programs complete`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Detailed verify failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

