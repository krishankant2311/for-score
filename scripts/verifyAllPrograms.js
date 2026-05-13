// Verifies that all 13 master programs are present and structurally sound.
// Checks cadence/library matching, recovery payload presence, phase data, etc.
// Run: node scripts/verifyAllPrograms.js

require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');

const REQUIRED_CODES = [
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

const isRestOrRecovery = (token) =>
  /^rest$/i.test(String(token || '').trim()) ||
  /^recover(y|ies)?$/i.test(String(token || '').trim());

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// Mirror of todayWorkoutController.libraryLookup so verification proves
// the cadence → exerciseLibrary resolution actually works end-to-end.
const libraryLookup = (exerciseLibrary, token) => {
  if (!exerciseLibrary || typeof exerciseLibrary !== 'object') return null;
  const t = String(token || '').trim();
  if (!t) return null;
  if (Array.isArray(exerciseLibrary[t])) return exerciseLibrary[t];
  if (exerciseLibrary[t] != null) return exerciseLibrary[t];
  const slugT = slug(t);
  if (slugT && exerciseLibrary[slugT] != null) return exerciseLibrary[slugT];
  const lower = t.toLowerCase();
  for (const key of Object.keys(exerciseLibrary)) {
    if (String(key).toLowerCase() === lower) return exerciseLibrary[key];
  }
  for (const key of Object.keys(exerciseLibrary)) {
    const k = String(key).toLowerCase();
    if (k.length < 3) continue;
    if (lower.includes(k) || k.includes(lower)) return exerciseLibrary[key];
  }
  return null;
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const rows = await Program.find({
    programCode: { $in: REQUIRED_CODES },
    status: { $ne: 'Deleted' },
    isDeleted: { $ne: true },
  }).lean();

  const byCode = new Map(rows.map((r) => [r.programCode, r]));
  let okCount = 0;
  const missing = [];
  const issues = [];

  for (const code of REQUIRED_CODES) {
    const p = byCode.get(code);
    if (!p) {
      missing.push(code);
      issues.push(`MISSING | ${code}`);
      continue;
    }
    const checks = [];

    const requiredCopy = [
      'programName',
      'subHeader',
      'overview',
      'workoutSkillLevel',
      'workoutSkillType',
      'workoutPreference',
      'locationTag',
      'durationWeeks',
      'frequencyPerWeek',
      'avgSessionMinutes',
    ];
    requiredCopy.forEach((f) => {
      if (p[f] == null || p[f] === '') checks.push(`missing ${f}`);
    });

    if (!Array.isArray(p.primaryGoals) || !p.primaryGoals.length) {
      checks.push('primaryGoals[] empty');
    }
    if (!Array.isArray(p.equipmentList) || !p.equipmentList.length) {
      checks.push('equipmentList[] empty');
    }

    if (!p.weekGrid || typeof p.weekGrid !== 'object') {
      checks.push('weekGrid missing');
    } else if (!Array.isArray(p.weekGrid.cadence) || p.weekGrid.cadence.length !== 7) {
      checks.push('weekGrid.cadence must be a 7-token array');
    }

    if (!p.exerciseLibrary || typeof p.exerciseLibrary !== 'object' || !Object.keys(p.exerciseLibrary).length) {
      checks.push('exerciseLibrary empty');
    }

    // For every NON rest/recovery cadence token, libraryLookup must resolve.
    if (Array.isArray(p.weekGrid?.cadence)) {
      p.weekGrid.cadence.forEach((tok, idx) => {
        if (isRestOrRecovery(tok)) return;
        const hit = libraryLookup(p.exerciseLibrary, tok);
        if (!hit || (Array.isArray(hit) && !hit.length)) {
          checks.push(`cadence[${idx}] "${tok}" has no exerciseLibrary mapping`);
        }
      });
    }

    if (!p.recoveryProtocol || typeof p.recoveryProtocol !== 'object') {
      checks.push('recoveryProtocol missing');
    } else {
      const hasCardio = p.recoveryProtocol.cardio && typeof p.recoveryProtocol.cardio === 'object';
      const hasStretches = Array.isArray(p.recoveryProtocol.stretches) && p.recoveryProtocol.stretches.length;
      if (!hasCardio || !hasStretches) {
        checks.push('recoveryProtocol must have cardio{} and stretches[]');
      }
    }

    if (!p.phaseStructure || typeof p.phaseStructure !== 'object') {
      checks.push('phaseStructure missing');
    } else if (!Array.isArray(p.phaseStructure.phases) || !p.phaseStructure.phases.length) {
      checks.push('phaseStructure.phases[] empty');
    }

    if (!p.progressTracking || !p.engineSettings) {
      checks.push('progressTracking / engineSettings missing');
    }

    if (checks.length) {
      issues.push(`FAIL | ${code} -> ${checks.join('; ')}`);
    } else {
      okCount += 1;
      console.log(`OK   | ${code.padEnd(34)} | ${p.programName}`);
    }
  }

  if (missing.length) {
    console.log('--------------------------------------------------------------');
    console.log('Missing programs:');
    missing.forEach((m) => console.log('  -', m));
  }
  if (issues.filter((i) => !i.startsWith('MISSING')).length) {
    console.log('--------------------------------------------------------------');
    console.log('Structural issues:');
    issues.filter((i) => !i.startsWith('MISSING')).forEach((i) => console.log('  -', i));
  }

  console.log('--------------------------------------------------------------');
  console.log(`Result: ${okCount}/${REQUIRED_CODES.length} programs pass`);
  await mongoose.disconnect();
  process.exit(okCount === REQUIRED_CODES.length ? 0 : 1);
}

run().catch(async (err) => {
  console.error('Verify failed:', err.message);
  console.error(err.stack);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
