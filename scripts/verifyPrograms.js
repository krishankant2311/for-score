require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const rows = await Program.find({
    programCode: {
      $in: [
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
      ],
    },
    status: { $ne: 'Deleted' },
  })
    .select('programCode programName workoutSkillLevel')
    .sort({ programName: 1 })
    .lean();

  console.log(`Verified programs: ${rows.length}`);
  rows.forEach((r) => {
    console.log(`${r.programCode} | ${r.programName} | ${r.workoutSkillLevel}`);
  });

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Verify failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

