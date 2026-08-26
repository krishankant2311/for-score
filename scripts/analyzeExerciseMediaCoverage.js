/**
 * Compare program exercises in DB vs client sheet coverage + media fields.
 * Run: node scripts/analyzeExerciseMediaCoverage.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');

const PROGRAM_CODES = [
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

const CLIENT_PROGRAM_ALIASES = {
  'full body foundations': 'foundations_28_day',
  '8-wk intermediate strength': 'intermediate_strength_8_week',
  '8-wk elite strength': 'elite_mastery_8_week',
  'elite metabolic': 'elite_metabolic',
  'functional strength & mastery': 'functional_strength_mastery',
  'functional strength and mastery': 'functional_strength_mastery',
  'united frontier': 'united_frontier_crossfit',
  'crossfit: the united frontier': 'united_frontier_crossfit',
  'radiant forge': 'radiant_forge_prenatal',
  'prenatal: the radiant forge': 'radiant_forge_prenatal',
  'shred to stage': 'shred_to_stage_12_week',
  '12-week shred to stage': 'shred_to_stage_12_week',
  'shred & burn hiit': 'shred_burn_hiit',
  '15-min express': 'express_15_minute',
  '15-minute quick hits': 'express_15_minute',
  '28-day ignite': 'ignite_28_day',
  'low-impact cardio: 28-day ignite': 'ignite_28_day',
  'bodyweight basics': 'bodyweight_basics',
  'core & flow': 'core_flow',
  '28-day full body foundations': 'foundations_28_day',
};

const normalizeName = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const collectExercises = (program) => {
  const out = [];
  const libs = [
    program.exerciseLibrary,
    program.workouts,
  ];
  for (const lib of libs) {
    if (!lib || typeof lib !== 'object') continue;
    for (const key of Object.keys(lib)) {
      const arr = lib[key];
      if (!Array.isArray(arr)) continue;
      for (const ex of arr) {
        const name = typeof ex === 'string' ? ex : ex?.name;
        if (!name) continue;
        out.push({
          name: String(name).trim(),
          norm: normalizeName(name),
          video: typeof ex === 'object' ? String(ex.video_url || ex.videoUrl || '').trim() : '',
          thumb:
            typeof ex === 'object'
              ? String(ex.thumbnail_url || ex.thumbnailUrl || '').trim()
              : '',
        });
      }
    }
  }
  return out;
};

// Subset of client sheet rows (representative) — full sheet has ~200+ exercises
const CLIENT_ROWS = `Barbell Back Squat\tLower Body\tBarbell\t8-Wk Intermediate Strength; 8-Wk Elite Strength
Goblet Squat\tLower Body\tDumbbell\tFull Body Foundations; Shred & Burn HIIT; 15-Min Express
Thrusters\tFull Body\tDumbbell\t15-Min Express
Renegade Row\tUpper Body\tDumbbell\t15-Min Express
Push-Up\tUpper Body\tBodyweight\t15-Min Express
Mountain Climber\tConditioning\tBodyweight\t15-Min Express
Romanian Deadlift\tLower Body\tBarbell\tFull Body Foundations
Pull-Up\tUpper Body\tPull-Up Bar\t8-Wk Elite Strength
Burpee\tConditioning\tBodyweight\tShred & Burn HIIT; 15-Min Express
Cat-Cow\tMobility\tMat\tFull Body Foundations; Core & Flow`;

function parseClientRows(raw) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split('\t');
      const exerciseName = cols[0] || '';
      const programsUsedIn = cols[3] || '';
      const videoUrl = cols[5] || '';
      const thumbUrl = cols[8] || '';
      const programCodes = programsUsedIn
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => CLIENT_PROGRAM_ALIASES[p.toLowerCase()] || null)
        .filter(Boolean);
      return {
        exerciseName,
        norm: normalizeName(exerciseName),
        programCodes: [...new Set(programCodes)],
        videoUrl,
        thumbUrl,
      };
    });
}

function findBestMatch(clientNorm, dbByNorm, dbNames) {
  if (dbByNorm.has(clientNorm)) return dbByNorm.get(clientNorm);
  for (const [norm, rec] of dbByNorm.entries()) {
    if (norm.includes(clientNorm) || clientNorm.includes(norm)) return rec;
  }
  const tokens = clientNorm.split(' ').filter((t) => t.length > 2);
  for (const rec of dbNames) {
    const hit = tokens.filter((t) => rec.norm.includes(t)).length;
    if (hit >= Math.max(2, Math.ceil(tokens.length * 0.6))) return rec;
  }
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const programs = await Program.find({
    programCode: { $in: PROGRAM_CODES },
    status: { $ne: 'Deleted' },
  }).lean();

  let totalExercises = 0;
  let withVideo = 0;
  let withThumb = 0;
  const globalByNorm = new Map();
  const perProgram = {};

  for (const p of programs) {
    const items = collectExercises(p);
    const unique = new Map();
    for (const ex of items) {
      if (!unique.has(ex.norm)) unique.set(ex.norm, ex);
    }
    const list = [...unique.values()];
    perProgram[p.programCode] = {
      name: p.programName,
      count: list.length,
      withVideo: list.filter((x) => x.video).length,
      withThumb: list.filter((x) => x.thumb).length,
    };
    totalExercises += list.length;
    withVideo += list.filter((x) => x.video).length;
    withThumb += list.filter((x) => x.thumb).length;
    for (const ex of list) {
      if (!globalByNorm.has(ex.norm)) globalByNorm.set(ex.norm, ex);
    }
  }

  const dbNames = [...globalByNorm.values()];
  const clientSample = parseClientRows(CLIENT_ROWS);

  console.log('=== DB Exercise Media Coverage (all 13 programs) ===');
  console.log(`Unique exercise names (deduped per program libs): ${totalExercises}`);
  console.log(`With video_url set: ${withVideo}`);
  console.log(`With thumbnail_url set: ${withThumb}`);
  console.log('');
  console.log('Per program:');
  for (const code of PROGRAM_CODES) {
    const row = perProgram[code];
    if (!row) {
      console.log(`  MISSING | ${code}`);
      continue;
    }
    console.log(
      `  ${code.padEnd(34)} | ex=${String(row.count).padStart(3)} | video=${row.withVideo} | thumb=${row.withThumb}`
    );
  }

  console.log('\n=== Sample client-row fuzzy match (illustrative) ===');
  for (const c of clientSample) {
    const hit = findBestMatch(c.norm, globalByNorm, dbNames);
    console.log(
      `${hit ? 'MATCH' : 'MISS '} | client: ${c.exerciseName} -> ${hit ? hit.name : 'not found'}`
    );
  }

  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
