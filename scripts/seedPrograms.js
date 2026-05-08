require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');

const programs = [
  {
    programName: '28-Day Full Body Foundations',
    programCode: 'foundations_28_day',
    workoutSkillLevel: 'Beginner',
    primaryGoal: 'Weight Loss, General Fitness, Strength',
    workoutPreference: 'Weight Lifting',
    locationTag: 'Home Friendly',
    daysPerWeek: 5,
    durationWeeks: 4,
    avgSessionMinutes: 35,
    minSessionMinutes: 30,
    maxSessionMinutes: 45,
    isHomeFriendly: true,
    tags: ['foundations', 'beginner', 'strength', 'home'],
  },
  {
    programName: '8-Week Intermediate Strength',
    programCode: 'intermediate_strength_8_week',
    workoutSkillLevel: 'Intermediate',
    primaryGoal: 'General Fitness, Strength',
    workoutPreference: 'Weight Lifting',
    locationTag: 'Commercial Gym / Home Gym',
    daysPerWeek: 6,
    durationWeeks: 8,
    avgSessionMinutes: 50,
    minSessionMinutes: 45,
    maxSessionMinutes: 55,
    isGymRequired: true,
    tags: ['strength', 'intermediate', 'hypertrophy', 'power'],
  },
  {
    programName: 'Elite Mastery',
    programCode: 'elite_mastery_8_week',
    workoutSkillLevel: 'Advanced',
    primaryGoal: 'Total Body Strength, Muscle Density',
    workoutPreference: 'Weight Lifting',
    locationTag: 'Commercial Gym Required',
    daysPerWeek: 6,
    durationWeeks: 8,
    avgSessionMinutes: 55,
    minSessionMinutes: 45,
    maxSessionMinutes: 70,
    isGymRequired: true,
    tags: ['elite', 'advanced', 'strength', 'forge'],
  },
  {
    programName: 'The 28-Day Ignite',
    programCode: 'ignite_28_day',
    workoutSkillLevel: 'Beginner',
    primaryGoal: 'Weight Loss, Endurance',
    workoutPreference: 'HIIT',
    locationTag: 'Home Friendly',
    daysPerWeek: 6,
    durationWeeks: 4,
    avgSessionMinutes: 25,
    minSessionMinutes: 20,
    maxSessionMinutes: 30,
    isHomeFriendly: true,
    tags: ['ignite', 'beginner', 'metabolic', 'home'],
  },
  {
    programName: 'Shred & Burn HIIT',
    programCode: 'shred_burn_hiit',
    workoutSkillLevel: 'Intermediate',
    primaryGoal: 'Weight Loss, Endurance',
    workoutPreference: 'HIIT',
    locationTag: 'Home or Gym',
    daysPerWeek: 6,
    durationWeeks: 4,
    avgSessionMinutes: 35,
    minSessionMinutes: 25,
    maxSessionMinutes: 45,
    isHomeFriendly: true,
    tags: ['hiit', 'fat-loss', 'metabolic', 'hybrid'],
  },
  {
    programName: 'Elite Metabolic',
    programCode: 'elite_metabolic',
    workoutSkillLevel: 'Advanced',
    primaryGoal: 'Weight Loss, Conditioning',
    workoutPreference: 'HIIT',
    locationTag: 'Gym Required',
    daysPerWeek: 6,
    durationWeeks: 4,
    avgSessionMinutes: 55,
    minSessionMinutes: 45,
    maxSessionMinutes: 75,
    isGymRequired: true,
    tags: ['advanced', 'metcon', 'emom', 'amrap'],
  },
  {
    programName: 'Bodyweight Basics',
    programCode: 'bodyweight_basics',
    workoutSkillLevel: 'Beginner',
    primaryGoal: 'General Fitness, Strength',
    workoutPreference: 'Functional Movement',
    locationTag: 'Anywhere / No Equipment',
    daysPerWeek: 5,
    durationWeeks: 8,
    avgSessionMinutes: 30,
    minSessionMinutes: 20,
    maxSessionMinutes: 40,
    isHomeFriendly: true,
    tags: ['bodyweight', 'functional', 'no-equipment', 'beginner'],
  },
  {
    programName: 'Core & Flow',
    programCode: 'core_flow',
    workoutSkillLevel: 'Beg / Int',
    primaryGoal: 'General Fitness, Mobility',
    workoutPreference: 'Functional Movement',
    locationTag: 'Home Friendly / Gym',
    daysPerWeek: 5,
    durationWeeks: 8,
    avgSessionMinutes: 20,
    minSessionMinutes: 20,
    maxSessionMinutes: 25,
    isHomeFriendly: true,
    tags: ['core', 'mobility', 'recovery', 'flow'],
  },
  {
    programName: 'Functional Strength and Mastery',
    programCode: 'functional_strength_mastery',
    workoutSkillLevel: 'Advanced',
    primaryGoal: 'Strength, Movement Mastery',
    workoutPreference: 'Functional Movement',
    locationTag: 'Commercial Gym',
    daysPerWeek: 4,
    durationWeeks: 8,
    avgSessionMinutes: 60,
    minSessionMinutes: 45,
    maxSessionMinutes: 75,
    isGymRequired: true,
    tags: ['functional', 'advanced', 'compound', 'gym'],
  },
  {
    programName: 'The United Frontier',
    programCode: 'united_frontier_crossfit',
    workoutSkillLevel: 'Any',
    primaryGoal: 'General Physical Preparedness',
    workoutPreference: 'CROSSFIT',
    locationTag: 'Gym Required',
    daysPerWeek: 6,
    durationWeeks: 8,
    avgSessionMinutes: 55,
    minSessionMinutes: 40,
    maxSessionMinutes: 75,
    isGymRequired: true,
    tags: ['crossfit', 'wod', 'amrap', 'emom'],
  },
  {
    programName: 'The 15-Minute Express',
    programCode: 'express_15_minute',
    workoutSkillLevel: 'Any',
    primaryGoal: 'General Fitness, Consistency',
    workoutPreference: 'QUICKIES',
    locationTag: 'Anywhere',
    daysPerWeek: 5,
    durationWeeks: 4,
    avgSessionMinutes: 15,
    minSessionMinutes: 15,
    maxSessionMinutes: 15,
    isHomeFriendly: true,
    isQuickProgram: true,
    tags: ['quickies', 'express', 'short-workout', 'anywhere'],
  },
  {
    programName: 'The Radiant Forge',
    programCode: 'radiant_forge_prenatal',
    workoutSkillLevel: 'Beg / Int',
    primaryGoal: 'Prenatal/Postpartum Fitness',
    workoutPreference: 'PRENATAL/POSTPARTUM',
    locationTag: 'Home Friendly / Gym Recommended',
    daysPerWeek: 6,
    durationWeeks: 40,
    avgSessionMinutes: 35,
    minSessionMinutes: 20,
    maxSessionMinutes: 45,
    isHomeFriendly: true,
    isPrenatalProgram: true,
    tags: ['prenatal', 'postpartum', 'safety', 'mobility'],
  },
  {
    programName: '12-Week Shred to Stage',
    programCode: 'shred_to_stage_12_week',
    workoutSkillLevel: 'Advanced',
    primaryGoal: 'Physique, Weight Loss, Muscle Retention',
    workoutPreference: 'Weight Lifting',
    locationTag: 'Commercial Gym Required',
    daysPerWeek: 6,
    durationWeeks: 12,
    avgSessionMinutes: 75,
    minSessionMinutes: 60,
    maxSessionMinutes: 100,
    isGymRequired: true,
    tags: ['physique', 'advanced', 'bodybuilding', 'stage-prep'],
  },
];

const minimalStructure = {
  weekGrid: { note: 'Seed placeholder - detailed schedule can be updated via admin API.' },
  exerciseLibrary: { note: 'Seed placeholder - detailed exercise blocks pending full content import.' },
  recoveryProtocol: { note: 'Seed placeholder - detailed recovery flow pending full content import.' },
};

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI missing in environment');

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  let upserted = 0;
  for (const p of programs) {
    const doc = {
      ...minimalStructure,
      ...p,
      frequency: p.daysPerWeek != null ? String(p.daysPerWeek) : '',
      subHeader: p.programName,
      overview: `${p.programName} program seeded for recommendation engine and app listing.`,
      status: 'Active',
    };
    const result = await Program.updateOne({ programCode: p.programCode }, { $set: doc }, { upsert: true });
    if (result.upsertedCount || result.modifiedCount) upserted += 1;
  }

  const total = await Program.countDocuments({
    programCode: { $in: programs.map((p) => p.programCode) },
    status: { $ne: 'Deleted' },
  });

  console.log(`Seed complete. Updated/Inserted: ${upserted}. Total active tracked programs: ${total}.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Seed failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

