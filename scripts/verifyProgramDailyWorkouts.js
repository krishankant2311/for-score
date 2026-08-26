/**
 * Verify every program resolves exercises for Mon–Sun (week 1).
 * Run: node scripts/verifyProgramDailyWorkouts.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');
const {
  resolveTodaysExerciseSlots,
} = require('../modules/controller/todayWorkoutController');

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

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_OFFSETS = [0, 1, 2, 3, 4, 5, 6];
const WEEK_START = new Date('2026-08-17T12:00:00'); // Monday

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  const programs = await Program.find({
    programCode: { $in: PROGRAM_CODES },
    status: { $ne: 'Deleted' },
    isDeleted: { $ne: true },
  }).lean();

  const byCode = new Map(programs.map((p) => [p.programCode, p]));
  const issues = [];
  let programsOk = 0;

  console.log('Program daily workout verification (week 1)\n');

  for (const code of PROGRAM_CODES) {
    const program = byCode.get(code);
    if (!program) {
      issues.push({ code, day: '*', issue: 'program missing in DB' });
      console.log(`MISSING | ${code}`);
      continue;
    }

    const programIdStr = String(program._id);
    const startedAt = WEEK_START;
    let programHasIssue = false;
    const dayRows = [];

    DAY_KEYS.forEach((dayKey, idx) => {
      const refDate = addDays(WEEK_START, DAY_OFFSETS[idx]);
      const { slots, inferred, dayType } = resolveTodaysExerciseSlots(
        program,
        startedAt,
        refDate,
        programIdStr,
        dayKey
      );

      const token = inferred.scheduleToken || '-';
      const title = inferred.workoutTitle || '-';
      const count = slots.length;

      dayRows.push({
        day: dayKey,
        dayType,
        token,
        title,
        count,
      });

      if (dayType === 'workout' && count === 0) {
        programHasIssue = true;
        issues.push({
          code,
          day: dayKey,
          issue: `workout day "${token}" resolved 0 exercises`,
          title,
        });
      }
    });

    if (programHasIssue) {
      console.log(`FAIL  | ${code} | ${program.programName}`);
    } else {
      programsOk += 1;
      console.log(`OK    | ${code} | ${program.programName}`);
    }

    dayRows.forEach((row) => {
      const label = row.dayType === 'rest' ? 'rest' : row.dayType === 'recovery' ? 'recovery' : 'workout';
      const suffix =
        label === 'workout' ? `${row.count} ex` : label;
      console.log(
        `        ${row.day.toUpperCase().padEnd(3)} | ${label.padEnd(8)} | ${String(row.token).padEnd(12)} | ${suffix} | ${row.title}`
      );
    });
    console.log('');
  }

  console.log('--------------------------------------------------------------');
  if (issues.length) {
    console.log(`Issues: ${issues.length}`);
    issues.forEach((i) => {
      console.log(`  - ${i.code} ${i.day}: ${i.issue}${i.title ? ` (${i.title})` : ''}`);
    });
  } else {
    console.log('No workout-day resolution issues found.');
  }
  console.log(`Programs OK: ${programsOk}/${PROGRAM_CODES.length}`);

  await mongoose.disconnect();
  process.exit(issues.length ? 1 : 0);
})().catch(async (err) => {
  console.error('Verify failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
