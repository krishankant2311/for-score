/* eslint-disable max-lines */
// FOUR Score Fitness — Master Program Seeder
//
// Replaces every program document with fully schema-conformant data so
// the admin panel and the today-workout / dashboard APIs always render
// matching content. Upserts by `programCode` so existing user
// `activeProgramId` references are preserved.
//
// Run:  node scripts/seedAllPrograms.js
// Verify: node scripts/verifyAllPrograms.js

require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');

// ---------- Helpers --------------------------------------------------------

const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// Build one exercise object that today-workout-controller can parse.
// Pass {sets, reps, rest, role, tag, notes, alt, muscles, instructions, minutes, calories}.
const mkExercise = (name, opts = {}) => {
  const muscles = Array.isArray(opts.muscles) ? opts.muscles : [];
  const instructions = Array.isArray(opts.instructions) ? opts.instructions : [];
  return {
    slotKey: opts.slotKey || slug(name),
    name,
    tag: opts.tag || 'Primary Strength',
    role: opts.role || 'Primary Strength',
    target_sets: opts.sets ?? null,
    target_reps_range: opts.reps || '',
    tempo: opts.tempo || '',
    restPerExercise: opts.rest || '',
    alternative: opts.alt || '',
    notes: opts.notes || '',
    targetMusclesText: muscles.join(', '),
    target_muscles: muscles,
    instructionsText: instructions.join('\n'),
    instructions,
    difficulty_level: opts.difficulty || '',
    estimated_time: opts.minutes ?? null,
    estimated_calories: opts.calories ?? null,
    media_type: '',
    video_url: '',
    thumbnail_url: '',
    mediaUrls: [],
  };
};

// Week-by-week overload row for workoutsMeta (used by admin "Phase Grid" tab).
const mkOverload = (week, sets, reps, rest = '', note = '') => ({
  week,
  sets: String(sets),
  reps: String(reps),
  rest: String(rest),
  note: String(note),
});

const mkPhase = (name, startWeek, endWeek, goal, restPeriod = '') => ({
  name,
  startWeek,
  endWeek,
  goal,
  restPeriod,
});

// Build a workoutsMeta entry (format / interval / rest / rounds / estDuration + overload table)
const mkMeta = (opts = {}) => ({
  format: opts.format || 'Standard sets',
  workInterval: opts.workInterval || '',
  restBetweenSets: opts.restBetweenSets || '',
  rounds: opts.rounds || '',
  estDuration: opts.estDuration || '',
  levelNotes: opts.levelNotes || '',
  overload: Array.isArray(opts.overload) ? opts.overload : [],
});

const mkStretch = (name, detail = '') => ({ name, detail });

const mkRecoveryItem = (name, duration = '', target = '') => ({ name, duration, target });

const mkRecoveryBlock = (opts = {}) => ({
  type: opts.type || 'LISS Cardio',
  name: opts.name || '',
  dayAssignment: opts.dayAssignment || 'Recovery day',
  duration: opts.duration || '',
  intensity: opts.intensity || '',
  modality: opts.modality || '',
  format: opts.format || 'Single circuit',
  roundsP1: opts.roundsP1 || '',
  roundsP2: opts.roundsP2 || '',
  instruction: opts.instruction || '',
  items: Array.isArray(opts.items) ? opts.items : [],
});

// Mon-first cadence array of 7 tokens.
const cad = (mon, tue, wed, thu, fri, sat, sun) => [mon, tue, wed, thu, fri, sat, sun];

// One week of the admin "Schedule" table (also kept for back-compat).
const weekRow = (week, mon, tue, wed, thu, fri, sat, sun, weekend = '') => ({
  week,
  mon,
  tue,
  wed,
  thu,
  fri,
  sat,
  sun,
  weekend,
});

// ---------- Program 1: 28-Day Full Body Foundations ------------------------

const program1 = {
  programCode: 'foundations_28_day',
  programName: '28-Day Full Body Foundations',
  subHeader: 'Build your base. Master the moves. Start your journey.',
  overview:
    "Full Body Foundations is designed specifically for the beginner who wants a clear, guided path to strength and confidence. Over 4 weeks, users master the fundamental movements of fitness while building a sustainable habit. No drill-sergeant vibes — smart, effective programming that respects the starting point and scales with progress.",
  whatsInside:
    '3 Strength Days (Legs, Upper Body, Full Body) + 2 Active Recovery Days (LISS + Stretch). Weekly progressive overload from 2×10 to 3×15 while exercise list stays constant.',
  isThisForYou:
    "New to the gym (teaches the 'Big 6' movement patterns) • Coming back from a break (safe muscle re-activation) • Short on time (focused, effective sessions).",
  theGoal:
    "By day 28 the user moves better, has improved form, and has the consistency to progress to the next program.",
  missionStatement: '28 days of discipline to create a lifetime of momentum.',
  primaryGoal: 'Weight Loss, General Fitness, Strength',
  primaryGoals: ['Weight Loss', 'General Fitness', 'Strength'],
  workoutSkillLevel: 'Beginner',
  workoutSkillType: 'Weight Lifting',
  workoutPreference: 'Weight Lifting',

  durationWeeks: 4,
  frequencyPerWeek: 5,
  avgSessionMinutes: 35,
  frequencyCaption: '5 Days/Week (3 Strength + 2 Active Recovery)',
  frequency: '5',
  daysPerWeek: '5',

  locationTag: 'Home Friendly',
  equipment: 'Bodyweight primary; sturdy chair/bench for incline push-ups & box squats; yoga mat.',
  equipmentList: ['Bodyweight', 'Sturdy chair/bench', 'Yoga mat'],
  equipmentNote: 'No gym membership required.',
  noEquipmentRequired: true,

  implementationNote:
    'App iterates Sets/Reps based on the Week variable while keeping the exercise list constant for the 4-week block — progressive overload without coding 28 unique days.',

  phaseCount: 1,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification: '',
    phases: [mkPhase('The Foundation', 1, 4, 'Master the Big 6 movement patterns; build consistency', '60s')],
  },

  frequencyRules: {
    trainingDaysPerWeek: '3',
    recoveryDaysPerWeek: '2',
    restDaysPerWeek: '2',
    flexibleSchedule: false,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'Sets × Reps progression',
    secondaryMetric: 'Form mastery of the Big 6 patterns',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: false,
    habitTracker: true,
  },

  schedule: [
    weekRow(1, 'A', 'recovery', 'B', 'recovery', 'C', 'rest', 'rest'),
    weekRow(2, 'A', 'recovery', 'B', 'recovery', 'C', 'rest', 'rest'),
    weekRow(3, 'A', 'recovery', 'B', 'recovery', 'C', 'rest', 'rest'),
    weekRow(4, 'A', 'recovery', 'B', 'recovery', 'C', 'rest', 'rest'),
  ],

  weekGrid: {
    cadence: cad('A', 'recovery', 'B', 'recovery', 'C', 'rest', 'rest'),
    week1: { mon: '2x10', tue: 'LISS+Stretch', wed: '2x10', thu: 'LISS+Stretch', fri: '2x10', sat: 'rest', sun: 'rest' },
    week2: { mon: '3x10', tue: 'LISS+Stretch', wed: '3x10', thu: 'LISS+Stretch', fri: '3x10', sat: 'rest', sun: 'rest' },
    week3: { mon: '3x12', tue: 'LISS+Stretch', wed: '3x12', thu: 'LISS+Stretch', fri: '3x12', sat: 'rest', sun: 'rest' },
    week4: { mon: '3x15', tue: 'LISS+Stretch', wed: '3x15', thu: 'LISS+Stretch', fri: '3x15', sat: 'rest', sun: 'rest' },
  },

  workouts: {
    A: [
      mkExercise('Goblet Squat', { sets: 3, reps: 'See phase grid', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Quads', 'Glutes', 'Core'] }),
      mkExercise('Reverse Lunges', { sets: 3, reps: 'See phase grid', role: 'Primary Strength', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Glute Bridges', { sets: 3, reps: 'See phase grid', role: 'Primary Strength', muscles: ['Glutes', 'Hamstrings'] }),
      mkExercise('Lateral Lunges', { sets: 3, reps: 'See phase grid', role: 'Accessory', muscles: ['Adductors', 'Glutes'] }),
      mkExercise('Calf Raises', { sets: 3, reps: 'See phase grid', role: 'Accessory', muscles: ['Calves'] }),
      mkExercise('Dead Bug', { sets: 3, reps: 'See phase grid', role: 'Core', tag: 'Core', muscles: ['Core'] }),
    ],
    B: [
      mkExercise('Incline Push-ups', { sets: 3, reps: 'See phase grid', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Chest', 'Triceps', 'Shoulders'] }),
      mkExercise('Dumbbell Rows', { sets: 3, reps: 'See phase grid', role: 'Primary Strength', muscles: ['Back', 'Biceps'] }),
      mkExercise('Overhead DB Press', { sets: 3, reps: 'See phase grid', role: 'Primary Strength', muscles: ['Shoulders', 'Triceps'] }),
      mkExercise('Bicep Curls', { sets: 3, reps: 'See phase grid', role: 'Accessory', muscles: ['Biceps'] }),
      mkExercise('Tricep Extension', { sets: 3, reps: 'See phase grid', role: 'Accessory', muscles: ['Triceps'] }),
      mkExercise('Plank Tap', { sets: 3, reps: 'See phase grid', role: 'Core', tag: 'Core', muscles: ['Core', 'Shoulders'] }),
    ],
    C: [
      mkExercise('DB Thrusters', { sets: 3, reps: 'See phase grid', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Full Body'] }),
      mkExercise('Romanian Deadlifts', { sets: 3, reps: 'See phase grid', role: 'Primary Strength', muscles: ['Hamstrings', 'Glutes', 'Back'] }),
      mkExercise('Bird-Dogs', { sets: 3, reps: 'See phase grid', role: 'Primary Strength', muscles: ['Core', 'Glutes'] }),
      mkExercise('Mountain Climbers', { sets: 3, reps: 'See phase grid', role: 'Accessory', muscles: ['Core', 'Shoulders'] }),
      mkExercise('Superman Holds', { sets: 3, reps: 'See phase grid', role: 'Accessory', muscles: ['Lower Back', 'Glutes'] }),
      mkExercise('Russian Twists', { sets: 3, reps: 'See phase grid', role: 'Core', tag: 'Core', muscles: ['Obliques'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({
      format: 'Standard sets',
      restBetweenSets: '60s',
      estDuration: '35 minutes',
      overload: [
        mkOverload(1, 2, 10, '60s', 'Base'),
        mkOverload(2, 3, 10, '60s', 'Add set'),
        mkOverload(3, 3, 12, '60s', 'Add reps'),
        mkOverload(4, 3, 15, '60s', 'Peak volume'),
      ],
    }),
    B: mkMeta({
      format: 'Standard sets',
      restBetweenSets: '60s',
      estDuration: '35 minutes',
      overload: [
        mkOverload(1, 2, 10, '60s', 'Base'),
        mkOverload(2, 3, 10, '60s', 'Add set'),
        mkOverload(3, 3, 12, '60s', 'Add reps'),
        mkOverload(4, 3, 15, '60s', 'Peak volume'),
      ],
    }),
    C: mkMeta({
      format: 'Standard sets',
      restBetweenSets: '60s',
      estDuration: '35 minutes',
      overload: [
        mkOverload(1, 2, 10, '60s', 'Base'),
        mkOverload(2, 3, 10, '60s', 'Add set'),
        mkOverload(3, 3, 12, '60s', 'Add reps'),
        mkOverload(4, 3, 15, '60s', 'Peak volume'),
      ],
    }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Goblet Squat', { sets: 3, reps: 'See phase grid', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Reverse Lunges', { sets: 3, reps: 'See phase grid', role: 'Primary Strength' }),
      mkExercise('Glute Bridges', { sets: 3, reps: 'See phase grid', role: 'Primary Strength' }),
      mkExercise('Lateral Lunges', { sets: 3, reps: 'See phase grid', role: 'Accessory' }),
      mkExercise('Calf Raises', { sets: 3, reps: 'See phase grid', role: 'Accessory' }),
      mkExercise('Dead Bug', { sets: 3, reps: 'See phase grid', role: 'Core', tag: 'Core' }),
    ],
    B: [
      mkExercise('Incline Push-ups', { sets: 3, reps: 'See phase grid', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Dumbbell Rows', { sets: 3, reps: 'See phase grid', role: 'Primary Strength' }),
      mkExercise('Overhead DB Press', { sets: 3, reps: 'See phase grid', role: 'Primary Strength' }),
      mkExercise('Bicep Curls', { sets: 3, reps: 'See phase grid', role: 'Accessory' }),
      mkExercise('Tricep Extension', { sets: 3, reps: 'See phase grid', role: 'Accessory' }),
      mkExercise('Plank Tap', { sets: 3, reps: 'See phase grid', role: 'Core', tag: 'Core' }),
    ],
    C: [
      mkExercise('DB Thrusters', { sets: 3, reps: 'See phase grid', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Romanian Deadlifts', { sets: 3, reps: 'See phase grid', role: 'Primary Strength' }),
      mkExercise('Bird-Dogs', { sets: 3, reps: 'See phase grid', role: 'Primary Strength' }),
      mkExercise('Mountain Climbers', { sets: 3, reps: 'See phase grid', role: 'Accessory' }),
      mkExercise('Superman Holds', { sets: 3, reps: 'See phase grid', role: 'Accessory' }),
      mkExercise('Russian Twists', { sets: 3, reps: 'See phase grid', role: 'Core', tag: 'Core' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Standard Set/Rest'],
    uiFeatures: ['Phase Grid Overlay', 'Form Tutorial Cards'],
  },

  recovery: {
    lissMinutes: 20,
    lissPrompt: 'Keep heart rate high enough to breathe heavily but low enough to hold a conversation.',
    lissOptions: 'Brisk Walk, Incline Treadmill, Light Cycling, Elliptical',
    stretches: [
      mkStretch('Couch Stretch', '1 min per side • Hip Flexors'),
      mkStretch("Child's Pose", '1 min • Back / Shoulders'),
      mkStretch('Cat-Cow', '10 slow reps • Spine'),
      mkStretch('Doorway Chest Stretch', '1 min • Chest'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 20,
      coachPrompt:
        'Keep heart rate high enough to breathe heavily but low enough to hold a conversation.',
      activityOptions: ['Brisk Walk', 'Incline Treadmill', 'Light Cycling', 'Elliptical'],
      media_url: '',
    },
    stretches: [
      { name: 'Couch Stretch', detail: '1 min per side • Hip Flexors' },
      { name: "Child's Pose", detail: '1 min • Back / Shoulders' },
      { name: 'Cat-Cow', detail: '10 slow reps • Spine' },
      { name: 'Doorway Chest Stretch', detail: '1 min • Chest' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'LISS Cardio',
      name: 'Block 1 — LISS Cardio',
      dayAssignment: 'Tuesday & Thursday',
      duration: '20 minutes',
      intensity: 'Low',
      modality: 'Walk / Treadmill / Cycle / Elliptical',
      format: 'Single circuit',
      roundsP1: '1',
      instruction: 'Conversational pace; breathe heavy but able to talk.',
    }),
    mkRecoveryBlock({
      type: 'Mobility',
      name: 'Block 2 — The Big 4 Stretches',
      dayAssignment: 'Tuesday & Thursday',
      duration: '10-12 minutes',
      intensity: 'Low',
      modality: 'Floor / yoga mat',
      format: 'Single circuit',
      roundsP1: '1',
      items: [
        mkRecoveryItem('Couch Stretch', '1 min per side', 'Hip Flexors'),
        mkRecoveryItem("Child's Pose", '1 min', 'Back / Shoulders'),
        mkRecoveryItem('Cat-Cow', '10 slow reps', 'Spine'),
        mkRecoveryItem('Doorway Chest Stretch', '1 min', 'Chest'),
      ],
    }),
  ],

  restDayConfig: {
    type: 'Full rest (no activity)',
    message: 'Sleep, hydrate, prepare meals.',
    deepRecovery: false,
    outdoorActivity: false,
  },

  injuryPrevention: {
    notes: 'Focus on technique. Progress only when form is solid.',
    prenatalMode: false,
    weightGuard: false,
    deloadWeeks: false,
  },

  recoveryTips: [
    { day: 'Tuesday', text: 'LISS clears soreness so your strength day feels fresh.' },
    { day: 'Thursday', text: 'Mobility flows protect the joints — quality movement compounds.' },
  ],

  tags: ['foundations', 'beginner', 'strength', 'home'],
  isGymRequired: false,
  isHomeFriendly: true,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 30,
  maxSessionMinutes: 45,
  goalText: 'Move better, build consistency, and prepare for advanced programs.',
};

// ---------- Program 2: 8-Week Intermediate Strength ------------------------

const program2 = {
  programCode: 'intermediate_strength_8_week',
  programName: '8-Week Intermediate Strength',
  subHeader: 'Break through plateaus. Build lean muscle. Define your physique.',
  overview:
    "Designed for those who have mastered the basics. Moves away from full-body circuits into an Upper/Lower Split. Higher volume with phase-based training triggers new muscle growth and strength gains a beginner routine can't provide.",
  whatsInside:
    'Two-phase periodization: Phase 1 Hypertrophy (Wks 1-4) high volume to build size; Phase 2 Power (Wks 5-8) lower reps, heavier weight, raw strength.',
  isThisForYou:
    'Graduated from Foundations • Hit a plateau (periodization jumpstarts progress) • Wants muscle definition / toned look.',
  theGoal: 'Add lean muscle and unlock new strength PRs.',
  missionStatement: 'The engine is built — now horsepower.',
  primaryGoal: 'Weight Loss, General Fitness, Strength',
  primaryGoals: ['Weight Loss', 'General Fitness', 'Strength'],
  workoutSkillLevel: 'Intermediate',
  workoutSkillType: 'Weight Lifting',
  workoutPreference: 'Weight Lifting',

  durationWeeks: 8,
  frequencyPerWeek: 6,
  avgSessionMinutes: 50,
  frequencyCaption: '6 Days/Week (4 Strength + 2 Active Recovery)',
  frequency: '6',
  daysPerWeek: '6',

  locationTag: 'Gym Recommended',
  equipment: 'Dumbbells, Kettlebells, Adjustable Bench, Pull-up Bar / Lat Pulldown, Bands (optional).',
  equipmentList: ['Dumbbells', 'Kettlebells', 'Adjustable Bench', 'Pull-up Bar / Lat Pulldown', 'Resistance Bands'],
  equipmentNote: 'Gym recommended; minimal home setup workable.',
  noEquipmentRequired: false,

  implementationNote:
    'Phase Shift notification at end of Week 4: "Congrats on finishing the Hypertrophy Phase! You\'ve built the engine — now it\'s time to see how much horsepower it has. Prepare for heavier weights in Week 5!"',

  phaseCount: 2,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification:
      "Congrats on finishing the Hypertrophy Phase! You've built the engine — now it's time to see how much horsepower it has. Prepare for heavier weights in Week 5!",
    phases: [
      mkPhase('Hypertrophy (The Build)', 1, 4, 'Increase muscle size and work capacity', '60-90s'),
      mkPhase('Power (The Strength)', 5, 8, 'Increase weight & raw power', '2-3 min'),
    ],
  },

  frequencyRules: {
    trainingDaysPerWeek: '4',
    recoveryDaysPerWeek: '2',
    restDaysPerWeek: '1',
    flexibleSchedule: false,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'Weight progression on primary lifts',
    secondaryMetric: 'Sets × Reps progression',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: true,
    habitTracker: true,
  },

  schedule: [
    weekRow(1, 'A', 'B', 'recovery', 'C', 'D', 'recovery', 'rest'),
    weekRow(4, 'A', 'B', 'recovery', 'C', 'D', 'recovery', 'rest'),
    weekRow(5, 'A', 'B', 'recovery', 'C', 'D', 'recovery', 'rest'),
    weekRow(8, 'A', 'B', 'recovery', 'C', 'D', 'recovery', 'rest'),
  ],

  weekGrid: {
    cadence: cad('A', 'B', 'recovery', 'C', 'D', 'recovery', 'rest'),
    phase1: 'Higher volume, 60-90s rest',
    phase2: 'Lower reps, heavier loads, 2-3 min rest',
  },

  workouts: {
    A: [
      mkExercise('DB Bench Press', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Chest', 'Triceps'] }),
      mkExercise('Standing Overhead DB Press', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Primary Strength', muscles: ['Shoulders', 'Triceps'] }),
      mkExercise('Chest-Supported DB Row', { sets: 3, reps: '12 (P1) / 8-10 (P2)', role: 'Primary Strength', muscles: ['Back', 'Biceps'] }),
      mkExercise('Dips (Bodyweight or Bench)', { sets: 3, reps: 'Max / 8-10 (P2)', role: 'Accessory', muscles: ['Triceps', 'Chest'] }),
      mkExercise('Lateral Raises', { sets: 3, reps: '15 (P1) / 12 (P2)', role: 'Accessory', muscles: ['Shoulders'] }),
      mkExercise('Weighted Dead Bug', { sets: 3, reps: '10/side (P1) / 12/side (P2)', role: 'Core', tag: 'Core', muscles: ['Core'] }),
    ],
    B: [
      mkExercise('Barbell or DB Back Squat', { sets: 3, reps: '10 (P1) / 6-8 (P2)', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Walking Lunges', { sets: 3, reps: '12/leg (P1) / 8/leg (P2)', role: 'Primary Strength', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Leg Extensions', { sets: 3, reps: '15 (P1) / 10 (P2)', role: 'Accessory', muscles: ['Quads'] }),
      mkExercise('DB Step-Ups', { sets: 3, reps: '10/leg (P1) / 8/leg (P2)', role: 'Accessory', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Seated Calf Raises', { sets: 3, reps: '15 (P1) / 12 (P2)', role: 'Accessory', muscles: ['Calves'] }),
      mkExercise('Hanging Knee Raises', { sets: 3, reps: '12 (P1) / 15 (P2)', role: 'Core', tag: 'Core', muscles: ['Core'] }),
    ],
    C: [
      mkExercise('Lat Pulldowns', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Back', 'Biceps'] }),
      mkExercise('Bent-Over DB Row', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Primary Strength', muscles: ['Back', 'Biceps'] }),
      mkExercise('Incline DB Bench Press', { sets: 3, reps: '10 (P1) / 8 (P2)', role: 'Primary Strength', muscles: ['Upper Chest', 'Shoulders'] }),
      mkExercise('Face Pulls', { sets: 3, reps: '15 (P1) / 12 (P2)', role: 'Accessory', muscles: ['Rear Delts'] }),
      mkExercise('Hammer Curls', { sets: 3, reps: '12 (P1) / 8-10 (P2)', role: 'Accessory', muscles: ['Biceps', 'Forearms'] }),
      mkExercise('Weighted Russian Twists', { sets: 3, reps: '20 total (P1) / 24 total (P2)', role: 'Core', tag: 'Core', muscles: ['Obliques'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({
      format: 'Upper Body A (Push Focus)',
      restBetweenSets: '60-90s (P1) / 2-3 min (P2)',
      estDuration: '50 minutes',
      overload: [
        mkOverload(1, 3, 12, '60-90s', 'Hypertrophy'),
        mkOverload(2, 3, 12, '60-90s', 'Hypertrophy'),
        mkOverload(3, 3, 12, '60-90s', 'Hypertrophy'),
        mkOverload(4, 3, 12, '60-90s', 'Hypertrophy end'),
        mkOverload(5, 4, '6-8', '2-3 min', 'Power begins'),
        mkOverload(6, 4, '6-8', '2-3 min', 'Power'),
        mkOverload(7, 4, '6-8', '2-3 min', 'Power'),
        mkOverload(8, 4, '6-8', '2-3 min', 'Peak Power'),
      ],
    }),
    B: mkMeta({
      format: 'Lower Body A (Quad Focus)',
      restBetweenSets: '60-90s (P1) / 2-3 min (P2)',
      estDuration: '50 minutes',
      overload: [
        mkOverload(1, 3, 10, '60-90s'),
        mkOverload(2, 3, 10, '60-90s'),
        mkOverload(3, 3, 10, '60-90s'),
        mkOverload(4, 3, 10, '60-90s'),
        mkOverload(5, 4, '6-8', '2-3 min'),
        mkOverload(6, 4, '6-8', '2-3 min'),
        mkOverload(7, 4, '6-8', '2-3 min'),
        mkOverload(8, 4, '6-8', '2-3 min'),
      ],
    }),
    C: mkMeta({
      format: 'Upper Body B (Pull Focus)',
      restBetweenSets: '60-90s (P1) / 2-3 min (P2)',
      estDuration: '50 minutes',
      overload: [
        mkOverload(1, 3, 12, '60-90s'),
        mkOverload(2, 3, 12, '60-90s'),
        mkOverload(3, 3, 12, '60-90s'),
        mkOverload(4, 3, 12, '60-90s'),
        mkOverload(5, 4, '6-8', '2-3 min'),
        mkOverload(6, 4, '6-8', '2-3 min'),
        mkOverload(7, 4, '6-8', '2-3 min'),
        mkOverload(8, 4, '6-8', '2-3 min'),
      ],
    }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('DB Bench Press', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Standing Overhead DB Press', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Primary Strength' }),
      mkExercise('Chest-Supported DB Row', { sets: 3, reps: '12 (P1) / 8-10 (P2)', role: 'Primary Strength' }),
      mkExercise('Dips (Bodyweight or Bench)', { sets: 3, reps: 'Max / 8-10 (P2)', role: 'Accessory' }),
      mkExercise('Lateral Raises', { sets: 3, reps: '15 (P1) / 12 (P2)', role: 'Accessory' }),
      mkExercise('Weighted Dead Bug', { sets: 3, reps: '10/side (P1) / 12/side (P2)', role: 'Core', tag: 'Core' }),
    ],
    B: [
      mkExercise('Barbell or DB Back Squat', { sets: 3, reps: '10 (P1) / 6-8 (P2)', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Walking Lunges', { sets: 3, reps: '12/leg (P1) / 8/leg (P2)', role: 'Primary Strength' }),
      mkExercise('Leg Extensions', { sets: 3, reps: '15 (P1) / 10 (P2)', role: 'Accessory' }),
      mkExercise('DB Step-Ups', { sets: 3, reps: '10/leg (P1) / 8/leg (P2)', role: 'Accessory' }),
      mkExercise('Seated Calf Raises', { sets: 3, reps: '15 (P1) / 12 (P2)', role: 'Accessory' }),
      mkExercise('Hanging Knee Raises', { sets: 3, reps: '12 (P1) / 15 (P2)', role: 'Core', tag: 'Core' }),
    ],
    C: [
      mkExercise('Lat Pulldowns', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Bent-Over DB Row', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Primary Strength' }),
      mkExercise('Incline DB Bench Press', { sets: 3, reps: '10 (P1) / 8 (P2)', role: 'Primary Strength' }),
      mkExercise('Face Pulls', { sets: 3, reps: '15 (P1) / 12 (P2)', role: 'Accessory' }),
      mkExercise('Hammer Curls', { sets: 3, reps: '12 (P1) / 8-10 (P2)', role: 'Accessory' }),
      mkExercise('Weighted Russian Twists', { sets: 3, reps: '20 total (P1) / 24 total (P2)', role: 'Core', tag: 'Core' }),
    ],
    D: [
      mkExercise('DB Romanian Deadlifts', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('DB Hip Thrusts', { sets: 3, reps: '12 (P1) / 6-8 (P2)', role: 'Primary Strength' }),
      mkExercise('Lying Leg Curls', { sets: 3, reps: '15 (P1) / 10 (P2)', role: 'Accessory' }),
      mkExercise('Bulgarian Split Squats', { sets: 3, reps: '10/leg (P1) / 8/leg (P2)', role: 'Accessory' }),
      mkExercise('Standing Calf Raises', { sets: 3, reps: '15 (P1) / 12 (P2)', role: 'Accessory' }),
      mkExercise('Plank with Hip Dips', { sets: 3, reps: '45s (P1) / 60s (P2)', role: 'Core', tag: 'Core' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Standard Set/Rest', 'Phase Shift Notification'],
    uiFeatures: ['Phase 1/2 Overload Grid', 'PB Tracker', 'Phase Shift Toast'],
  },

  recovery: {
    lissMinutes: 20,
    lissPrompt: 'Walk/Bike/Row at conversational pace.',
    lissOptions: 'Walk, Cycle, Row, Incline Treadmill',
    stretches: [
      mkStretch("World's Greatest Stretch", '2 (P1) / 3 (P2) Rounds × 5/side'),
      mkStretch('90/90 Hip Switches', '2 (P1) / 3 (P2) Rounds × 10 total'),
      mkStretch('Cat-Cow', '2 (P1) / 3 (P2) Rounds × 10 reps'),
      mkStretch('Scapular Wall Slides', '2 (P1) / 3 (P2) Rounds × 12 reps'),
      mkStretch('Pigeon Pose', '2 (P1) / 3 (P2) Rounds × 60s/side'),
      mkStretch('Thoracic Bridge', '2 (P1) / 3 (P2) Rounds × 5/side'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 20,
      coachPrompt: 'LISS flushes metabolic waste so you can lift heavier tomorrow.',
      activityOptions: ['Walk', 'Bike', 'Row', 'Incline Treadmill'],
      media_url: '',
    },
    stretches: [
      { name: "World's Greatest Stretch", detail: '2 (P1) / 3 (P2) Rounds × 5/side' },
      { name: '90/90 Hip Switches', detail: '2 (P1) / 3 (P2) Rounds × 10 total' },
      { name: 'Cat-Cow', detail: '2 (P1) / 3 (P2) Rounds × 10 reps' },
      { name: 'Scapular Wall Slides', detail: '2 (P1) / 3 (P2) Rounds × 12 reps' },
      { name: 'Pigeon Pose', detail: '2 (P1) / 3 (P2) Rounds × 60s/side' },
      { name: 'Thoracic Bridge', detail: '2 (P1) / 3 (P2) Rounds × 5/side' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'LISS Cardio',
      name: 'LISS',
      dayAssignment: 'Wednesday & Saturday',
      duration: '20 min',
      intensity: 'Low',
      modality: 'Walk / Bike / Row',
      format: 'Single circuit',
      roundsP1: '1',
      roundsP2: '1',
    }),
    mkRecoveryBlock({
      type: 'Mobility Flow',
      name: 'Mobility Flow Circuit',
      dayAssignment: 'Wednesday & Saturday',
      duration: '15-20 min',
      intensity: 'Low',
      modality: 'Floor / yoga mat',
      format: 'Single circuit (Round 2 in P1, Round 3 in P2)',
      roundsP1: '2',
      roundsP2: '3',
      items: [
        mkRecoveryItem("World's Greatest Stretch", '5/side', 'Hips/T-spine'),
        mkRecoveryItem('90/90 Hip Switches', '10 total', 'Hips'),
        mkRecoveryItem('Cat-Cow', '10 reps', 'Spine'),
        mkRecoveryItem('Scapular Wall Slides', '12 reps', 'Shoulders'),
        mkRecoveryItem('Pigeon Pose', '60s/side', 'Hips/Glutes'),
        mkRecoveryItem('Thoracic Bridge', '5/side', 'T-spine'),
      ],
    }),
  ],

  restDayConfig: {
    type: 'Full rest (no activity)',
    message: 'Hydrate, sleep, prep meals for the week ahead.',
    deepRecovery: false,
    outdoorActivity: false,
  },

  injuryPrevention: {
    notes: 'Progressive overload only with spotless form. Mobility days protect joints.',
    prenatalMode: false,
    weightGuard: true,
    deloadWeeks: false,
  },

  recoveryTips: [
    { day: 'Wednesday', text: 'LISS cardio flushes metabolic waste so you can lift heavier tomorrow.' },
    { day: 'Saturday', text: 'Mobility is the oil for your joints — better movement, better recruitment.' },
  ],

  tags: ['strength', 'intermediate', 'hypertrophy', 'power', 'phase-based'],
  isGymRequired: true,
  isHomeFriendly: false,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 45,
  maxSessionMinutes: 55,
  goalText: 'Add lean muscle and unlock new strength PRs.',
};

// ---------- Program 3: 8-Week Elite Strength -------------------------------

const program3 = {
  programCode: 'elite_mastery_8_week',
  programName: '8-Week Elite Strength',
  subHeader: 'Elite Mastery: The Standard of Excellence',
  overview:
    'An advanced strength cycle for the athlete who has moved past the basics and seeks true physical refinement. A disciplined roadmap built on the Forge and Recover pillars with high-threshold primary lifts.',
  whatsInside:
    'Two-Phase Architecture: Phase 1 Foundation & Volume (Wks 1-4); Phase 2 Intensification & Peak (Wks 5-8). +2.5-5% weekly progression on primary lifts.',
  isThisForYou:
    'Trained athlete seeking refinement, structural balance, and elite strength under disciplined progression.',
  theGoal: 'Become elite — squat, deadlift, press numbers that prove mastery.',
  missionStatement: 'Integrity over ego.',
  primaryGoal: 'Weight Loss, Strength',
  primaryGoals: ['Weight Loss', 'Strength'],
  workoutSkillLevel: 'Advanced',
  workoutSkillType: 'Weight Lifting',
  workoutPreference: 'Weight Lifting',

  durationWeeks: 8,
  frequencyPerWeek: 6,
  avgSessionMinutes: 60,
  frequencyCaption: '6 Days/Week (4 Strength + 2 Active Recovery)',
  frequency: '6',
  daysPerWeek: '6',

  locationTag: 'Commercial Gym Required',
  equipment: 'Full Commercial Gym (Barbells, Squat Rack, Cables, Leg Press, Pull-up Bar).',
  equipmentList: ['Barbell + Plates', 'Squat Rack', 'Bench', 'Cables', 'Leg Press', 'Pull-up Bar', 'Dumbbells', 'Kettlebells'],
  equipmentNote: 'Commercial gym required.',
  noEquipmentRequired: false,

  implementationNote:
    'App prompts +2.5% to 5% weight increase on primary lifts each week, provided form remains spotless. Integrity over ego.',

  phaseCount: 2,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification: 'Foundation phase complete. Time to intensify — decrease reps, increase weight.',
    phases: [
      mkPhase('Foundation & Volume', 1, 4, 'Establish baseline, perfect mechanics, build work capacity', '90-180s'),
      mkPhase('Intensification & Peak', 5, 8, 'Raw power, lower reps, heavier load', '120-180s'),
    ],
  },

  frequencyRules: {
    trainingDaysPerWeek: '4',
    recoveryDaysPerWeek: '2',
    restDaysPerWeek: '1',
    flexibleSchedule: false,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'Weekly primary lift weight progression (+2.5-5%)',
    secondaryMetric: 'Form quality assessment',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: true,
    habitTracker: true,
  },

  schedule: [weekRow(1, 'A', 'B', 'recovery', 'C', 'D', 'recovery', 'rest')],

  weekGrid: {
    cadence: cad('A', 'B', 'recovery', 'C', 'D', 'recovery', 'rest'),
    progressionRule: '+2.5% to 5% weekly on primary lifts with form integrity',
    phase1: 'Volume foundation',
    phase2: 'Intensity and peak',
  },

  workouts: {
    A: [
      mkExercise('Barbell Back Squat', { sets: 4, reps: '8 (P1) / 6 (P2)', rest: '120s', role: 'Primary Lift', tag: 'Large Muscle', muscles: ['Quads', 'Glutes', 'Core'] }),
      mkExercise('Romanian Deadlift', { sets: 3, reps: '10 (P1) / 6 (P2)', rest: '90s', role: 'Accessory', muscles: ['Hamstrings', 'Glutes', 'Back'] }),
      mkExercise('Walking Lunges', { sets: 3, reps: '12 total', rest: '60s', role: 'Accessory', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Lying Leg Press', { sets: 3, reps: '12-15 (P1) / 8-10 (P2)', rest: '90s', role: 'Accessory', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Box Step Ups', { sets: 3, reps: '10/leg (P1) / 8/leg (P2)', rest: '60-120s', role: 'Accessory', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Calf Raises', { sets: 4, reps: '15-20 (P1) / 12 (P2)', rest: '60-120s', role: 'Accessory', muscles: ['Calves'] }),
    ],
    B: [
      mkExercise('Overhead Press', { sets: 4, reps: '8 (P1) / 6-8 (P2)', rest: '120s', role: 'Primary Lift', tag: 'Large Muscle', muscles: ['Shoulders', 'Triceps'] }),
      mkExercise('Bench Press', { sets: 3, reps: '10 (P1) / 6 (P2)', rest: '0s', role: 'Superset A1', tag: 'Large Muscle', muscles: ['Chest', 'Triceps'] }),
      mkExercise('Cable Chest Flys', { sets: 3, reps: '12-15 (P1) / 12 (P2)', rest: '90s', role: 'Superset A2', muscles: ['Chest'] }),
      mkExercise('Incline DB Press', { sets: 3, reps: '10-12 (P1) / 6-8 (P2)', rest: '90s', role: 'Accessory', muscles: ['Upper Chest', 'Shoulders'] }),
      mkExercise('Lateral Raises', { sets: 3, reps: '15-20 (P1) / 12-15 (P2)', rest: '60s', role: 'Accessory', muscles: ['Shoulders'] }),
      mkExercise('Push Ups', { sets: 3, reps: 'To Failure', rest: '60s', role: 'Accessory', muscles: ['Chest', 'Triceps'] }),
    ],
    C: [
      mkExercise('Deadlift', { sets: 4, reps: '5', rest: '180s', role: 'Primary Lift', tag: 'Large Muscle', muscles: ['Posterior Chain'] }),
      mkExercise('Good Mornings', { sets: 3, reps: '10', rest: '90s', role: 'Accessory', muscles: ['Hamstrings', 'Lower Back'] }),
      mkExercise('Walking Lunges', { sets: 3, reps: '12 total', rest: '60s', role: 'Accessory', muscles: ['Quads', 'Glutes'] }),
      mkExercise('DB Lateral Lunges', { sets: 3, reps: '10/leg (P1) / 8/leg (P2)', rest: '60-120s', role: 'Accessory', muscles: ['Adductors', 'Glutes'] }),
      mkExercise('Leg Press', { sets: 3, reps: '12 (P1) / 8-10 (P2)', rest: '90s', role: 'Accessory', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Hamstring Curls', { sets: 3, reps: '15 (P1) / 12 (P2)', rest: '60s', role: 'Accessory', muscles: ['Hamstrings'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({
      format: 'Lower Body (Squat Focus)',
      restBetweenSets: '60-120s',
      estDuration: '60 minutes',
      overload: [
        mkOverload(1, 4, 8, '120s', 'Build base'),
        mkOverload(2, 4, 8, '120s', '+2.5%'),
        mkOverload(3, 4, 8, '120s', '+2.5%'),
        mkOverload(4, 4, 8, '120s', 'Phase 1 peak'),
        mkOverload(5, 4, 6, '120s', 'Power begins'),
        mkOverload(6, 4, 6, '120s', '+5%'),
        mkOverload(7, 4, 6, '120s', '+5%'),
        mkOverload(8, 4, 6, '120s', 'Peak Power'),
      ],
    }),
    B: mkMeta({
      format: 'Upper Body (Push Focus, Supersets)',
      restBetweenSets: '0-120s (Superset / Primary)',
      estDuration: '60 minutes',
      overload: [
        mkOverload(1, 4, 8, '120s'),
        mkOverload(2, 4, 8, '120s'),
        mkOverload(3, 4, 8, '120s'),
        mkOverload(4, 4, 8, '120s'),
        mkOverload(5, 4, '6-8', '120s'),
        mkOverload(6, 4, '6-8', '120s'),
        mkOverload(7, 4, '6-8', '120s'),
        mkOverload(8, 4, '6-8', '120s'),
      ],
    }),
    C: mkMeta({
      format: 'Lower Body (Hinge Focus)',
      restBetweenSets: '60-180s',
      estDuration: '60 minutes',
      overload: [
        mkOverload(1, 4, 5, '180s'),
        mkOverload(2, 4, 5, '180s'),
        mkOverload(3, 4, 5, '180s'),
        mkOverload(4, 4, 5, '180s'),
        mkOverload(5, 4, 5, '180s'),
        mkOverload(6, 4, 5, '180s'),
        mkOverload(7, 4, 5, '180s'),
        mkOverload(8, 4, 5, '180s', 'Peak deadlift'),
      ],
    }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Barbell Back Squat', { sets: 4, reps: '8 (P1) / 6 (P2)', rest: '120s', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('Romanian Deadlift', { sets: 3, reps: '10 (P1) / 6 (P2)', rest: '90s', role: 'Accessory' }),
      mkExercise('Walking Lunges', { sets: 3, reps: '12 total', rest: '60s', role: 'Accessory' }),
      mkExercise('Lying Leg Press', { sets: 3, reps: '12-15 (P1) / 8-10 (P2)', rest: '90s', role: 'Accessory' }),
      mkExercise('Box Step Ups', { sets: 3, reps: '10/leg (P1) / 8/leg (P2)', rest: '60-120s', role: 'Accessory' }),
      mkExercise('Calf Raises', { sets: 4, reps: '15-20 (P1) / 12 (P2)', rest: '60-120s', role: 'Accessory' }),
    ],
    B: [
      mkExercise('Overhead Press', { sets: 4, reps: '8 (P1) / 6-8 (P2)', rest: '120s', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('Bench Press', { sets: 3, reps: '10 (P1) / 6 (P2)', rest: '0s', role: 'Superset A1', tag: 'Large Muscle' }),
      mkExercise('Cable Chest Flys', { sets: 3, reps: '12-15 (P1) / 12 (P2)', rest: '90s', role: 'Superset A2' }),
      mkExercise('Incline DB Press', { sets: 3, reps: '10-12 (P1) / 6-8 (P2)', rest: '90s', role: 'Accessory' }),
      mkExercise('Lateral Raises', { sets: 3, reps: '15-20 (P1) / 12-15 (P2)', rest: '60s', role: 'Accessory' }),
      mkExercise('Push Ups', { sets: 3, reps: 'To Failure', rest: '60s', role: 'Accessory' }),
    ],
    C: [
      mkExercise('Deadlift', { sets: 4, reps: '5', rest: '180s', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('Good Mornings', { sets: 3, reps: '10', rest: '90s', role: 'Accessory' }),
      mkExercise('Walking Lunges', { sets: 3, reps: '12 total', rest: '60s', role: 'Accessory' }),
      mkExercise('DB Lateral Lunges', { sets: 3, reps: '10/leg (P1) / 8/leg (P2)', rest: '60-120s', role: 'Accessory' }),
      mkExercise('Leg Press', { sets: 3, reps: '12 (P1) / 8-10 (P2)', rest: '90s', role: 'Accessory' }),
      mkExercise('Hamstring Curls', { sets: 3, reps: '15 (P1) / 12 (P2)', rest: '60s', role: 'Accessory' }),
    ],
    D: [
      mkExercise('Barbell Row', { sets: 4, reps: '8', rest: '120s', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('Lat Pulldowns', { sets: 3, reps: '12 (P1) / 10 (P2)', rest: '90s', role: 'Accessory' }),
      mkExercise('Cable Seated Rows', { sets: 3, reps: '12 (P1) / 10 (P2)', rest: '90s', role: 'Accessory' }),
      mkExercise('Pull-Ups', { sets: 3, reps: 'To Failure', rest: '90s', role: 'Accessory' }),
      mkExercise('Cable Pushdowns', { sets: 3, reps: '15 (P1) / 10 (P2)', rest: '60-90s', role: 'Accessory' }),
      mkExercise('Face Pulls', { sets: 3, reps: '15 (P1) / 10 (P2)', rest: '60-90s', role: 'Accessory' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Standard Set/Rest', 'Long Primary Lift Rest'],
    uiFeatures: ['Phase Grid', 'Weekly +2.5-5% Prompt', 'PB Tracker', 'Form Integrity Check'],
  },

  recovery: {
    lissMinutes: 40,
    lissPrompt: 'Steady state, 30-45 min, conversational pace.',
    lissOptions: 'Walk, Bike, Row',
    stretches: [
      mkStretch("World's Greatest Stretch"),
      mkStretch('90/90 Hip Switches'),
      mkStretch('Cat-Cow'),
      mkStretch('Scapular Wall Slides'),
      mkStretch('Pigeon Pose'),
      mkStretch('Thoracic Bridge'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 40,
      coachPrompt: 'Steady-state aerobic work supports recovery between heavy days.',
      activityOptions: ['Walk', 'Bike', 'Row'],
      media_url: '',
    },
    stretches: [
      { name: "World's Greatest Stretch", detail: '5/side' },
      { name: '90/90 Hip Switches', detail: '10 total' },
      { name: 'Cat-Cow', detail: '10 reps' },
      { name: 'Scapular Wall Slides', detail: '12 reps' },
      { name: 'Pigeon Pose', detail: '60s/side' },
      { name: 'Thoracic Bridge', detail: '5/side' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'LISS Cardio',
      name: 'Active Mobility — LISS',
      dayAssignment: 'Wednesday & Saturday',
      duration: '30-45 min',
      intensity: 'Low',
      modality: 'Walk / Bike / Row',
      format: 'Single circuit',
      roundsP1: '1',
    }),
    mkRecoveryBlock({
      type: 'Mobility Flow',
      name: 'Elite Mobility Flow',
      dayAssignment: 'Wednesday & Saturday',
      duration: '15-20 min',
      intensity: 'Low',
      modality: 'Floor / Mat',
      format: 'Single circuit',
      roundsP1: '2',
      items: [
        mkRecoveryItem("World's Greatest Stretch", '5/side', 'Hips/T-spine'),
        mkRecoveryItem('90/90 Hip Switches', '10 total', 'Hips'),
        mkRecoveryItem('Cat-Cow', '10 reps', 'Spine'),
        mkRecoveryItem('Scapular Wall Slides', '12 reps', 'Shoulders'),
        mkRecoveryItem('Pigeon Pose', '60s/side', 'Hips/Glutes'),
        mkRecoveryItem('Thoracic Bridge', '5/side', 'T-spine'),
      ],
    }),
  ],

  restDayConfig: {
    type: 'Full rest (no activity)',
    message: 'Sleep, hydrate, prepare meals.',
    deepRecovery: true,
    outdoorActivity: false,
  },

  injuryPrevention: {
    notes: 'Cap progression at +2.5-5% per week. Form must remain spotless before adding weight.',
    prenatalMode: false,
    weightGuard: true,
    deloadWeeks: true,
  },

  recoveryTips: [
    { day: 'Wednesday', text: 'Aerobic base is the foundation that lets you peak on heavy days.' },
    { day: 'Saturday', text: 'Mobility unlocks force production — joints that move well lift more.' },
  ],

  tags: ['elite', 'advanced', 'strength', 'forge', 'periodization'],
  isGymRequired: true,
  isHomeFriendly: false,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 45,
  maxSessionMinutes: 70,
  goalText: 'Master strength — primary lifts at elite numbers under disciplined progression.',
};

// ---------- Program 4: Low-Impact Cardio — 28-Day Ignite -------------------

const program4 = {
  programCode: 'ignite_28_day',
  programName: 'Low-Impact Cardio: 28-Day Ignite',
  subHeader: 'Four Weeks of Intentional Movement, Metabolic Priming, and Habit Mastery',
  overview:
    "Accelerated foundational program designed to kickstart weight loss through a minimum-effective-dose approach. Proves you don't need hours of cardio — just a plan.",
  whatsInside:
    '3 Strength Days (20-min circuit) + 3 LISS Cardio Days + 1 Active Recovery. Weekly progression in rounds + rest time.',
  isThisForYou: 'Beginners; reset-the-routine seekers; busy people who need a focused 20-min plan.',
  theGoal: 'Kickstart fat loss with minimum effective dose and build daily habits.',
  missionStatement: '28 days of discipline to create a lifetime of momentum.',
  primaryGoal: 'Weight Loss, General Fitness, Endurance',
  primaryGoals: ['Weight Loss', 'General Fitness', 'Endurance'],
  workoutSkillLevel: 'Beginner',
  workoutSkillType: 'HIIT',
  workoutPreference: 'HIIT',

  durationWeeks: 4,
  frequencyPerWeek: 7,
  avgSessionMinutes: 25,
  frequencyCaption: '3 Strength + 3 Cardio + 1 Active Recovery',
  frequency: '7',
  daysPerWeek: '7',

  locationTag: 'Home Friendly',
  equipment: 'Bodyweight, stable elevated surface (table/counter), yoga mat.',
  equipmentList: ['Bodyweight', 'Elevated surface (table/counter)', 'Yoga mat'],
  equipmentNote: 'No gym required.',
  noEquipmentRequired: true,

  implementationNote:
    'Track 4 daily success metrics: protein at every meal, 7000+ steps, 2-3L water, complete circuit on scheduled days.',

  phaseCount: 1,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification: '',
    phases: [mkPhase('Ignite', 1, 4, 'Build the habit, light the metabolic spark', '10-15s')],
  },

  frequencyRules: {
    trainingDaysPerWeek: '3',
    recoveryDaysPerWeek: '1',
    restDaysPerWeek: '0',
    flexibleSchedule: false,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'Daily success habits + circuit rounds',
    secondaryMetric: 'Step count + water + protein adherence',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: false,
    habitTracker: true,
  },

  schedule: [weekRow(1, 'A', 'cardio', 'A', 'cardio', 'A', 'cardio', 'recovery')],

  weekGrid: {
    cadence: cad('A', 'cardio', 'A', 'cardio', 'A', 'cardio', 'recovery'),
    week1: 'The Blueprint — 3 rounds, 15s rest',
    week2: 'The Push — 3 rounds, 15s rest, beat rep count',
    week3: 'The Burn — 3 rounds, 10s rest',
    week4: 'The Peak — 4 rounds, 10s rest',
  },

  workouts: {
    A: [
      mkExercise('Bodyweight Squat', { sets: 3, reps: '45s work / 15s rest', role: 'Large Muscle', tag: 'Large Muscle', alt: 'Box Squat (sit to chair)', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Incline Push-Up', { sets: 3, reps: '45s work / 15s rest', role: 'Primary Strength', alt: 'Knee Push-Up', muscles: ['Chest', 'Triceps'] }),
      mkExercise('Alternating Reverse Lunge', { sets: 3, reps: '45s work / 15s rest', role: 'Primary Strength', alt: 'Assisted Lunge (hold wall/chair)', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Plank', { sets: 3, reps: '45s hold', role: 'Core', tag: 'Core', alt: 'Kneeling Plank', muscles: ['Core'] }),
      mkExercise('Bird-Dog', { sets: 3, reps: '45s alternating', role: 'Core', tag: 'Core', muscles: ['Core', 'Glutes'] }),
    ],
    B: [],
    C: [],
  },

  workoutsMeta: {
    A: mkMeta({
      format: '45s work / variable rest',
      workInterval: '45s',
      restBetweenSets: '15s (W1-W2) / 10s (W3-W4)',
      rounds: '3 (W1-W3) / 4 (W4)',
      estDuration: '20 minutes',
      overload: [
        mkOverload(1, '3 rounds', '45s', '15s', 'The Blueprint'),
        mkOverload(2, '3 rounds', '45s', '15s', 'The Push — beat last week reps'),
        mkOverload(3, '3 rounds', '45s', '10s', 'The Burn'),
        mkOverload(4, '4 rounds', '45s', '10s', 'The Peak'),
      ],
    }),
    B: mkMeta({}),
    C: mkMeta({}),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Bodyweight Squat', { sets: 3, reps: '45s work / 15s rest', role: 'Large Muscle', tag: 'Large Muscle', alt: 'Box Squat' }),
      mkExercise('Incline Push-Up', { sets: 3, reps: '45s work / 15s rest', role: 'Primary Strength', alt: 'Knee Push-Up' }),
      mkExercise('Alternating Reverse Lunge', { sets: 3, reps: '45s work / 15s rest', role: 'Primary Strength', alt: 'Assisted Lunge' }),
      mkExercise('Plank', { sets: 3, reps: '45s hold', role: 'Core', tag: 'Core', alt: 'Kneeling Plank' }),
      mkExercise('Bird-Dog', { sets: 3, reps: '45s alternating', role: 'Core', tag: 'Core' }),
    ],
    cardio: [
      mkExercise('Brisk Walk (LISS)', { sets: 1, reps: '30 minutes', role: 'Cardio', tag: 'Cardio', notes: 'Goal: 7,000 steps' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Interval Timer (work/rest)'],
    uiFeatures: ['Daily Habits Tracker', 'Step Counter Integration', 'Water Tracker', 'Protein Reminder'],
  },

  recovery: {
    lissMinutes: 30,
    lissPrompt: 'Brisk walk — keep heart rate elevated but still conversational.',
    lissOptions: 'Brisk Walking outdoors or treadmill',
    stretches: [
      mkStretch('Light Full Body Stretch', 'On Sunday — 10-15 minutes'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 15,
      coachPrompt: 'Light Sunday movement — stretch or leisure walk. Recovery and preparation for the week ahead.',
      activityOptions: ['Light stretching', 'Leisure walk', 'Easy mobility'],
      media_url: '',
    },
    stretches: [
      { name: 'Hamstring Stretch', detail: '45s/side' },
      { name: 'Hip Flexor Stretch', detail: '45s/side' },
      { name: 'Chest Opener', detail: '45s' },
      { name: 'Spinal Twist', detail: '45s/side' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'LISS Cardio',
      name: 'Movement & NEAT',
      dayAssignment: 'Tuesday / Thursday / Saturday',
      duration: '30 min',
      intensity: 'Low',
      modality: 'Brisk Walking',
      format: 'Single circuit',
      roundsP1: '1',
      instruction: 'Goal: 7,000+ steps total for the day.',
    }),
    mkRecoveryBlock({
      type: 'Active Recovery',
      name: 'Sunday Active Recovery',
      dayAssignment: 'Sunday',
      duration: '15 min',
      intensity: 'Very Low',
      modality: 'Stretch / leisure walk',
      format: 'Single circuit',
      roundsP1: '1',
    }),
  ],

  restDayConfig: {
    type: 'Active recovery (light stretch/walk)',
    message: 'Recovery and prep for the week ahead.',
    deepRecovery: false,
    outdoorActivity: true,
  },

  injuryPrevention: {
    notes: 'Low-impact, beginner-safe. Form-first cues throughout.',
    prenatalMode: false,
    weightGuard: false,
    deloadWeeks: false,
  },

  recoveryTips: [
    { day: 'Daily', text: 'Protein at every major meal anchors metabolism.' },
    { day: 'Daily', text: '7,000+ steps lifts your baseline NEAT and accelerates fat loss.' },
    { day: 'Daily', text: '2-3 liters of water — hydration is half the work.' },
  ],

  tags: ['ignite', 'beginner', 'metabolic', 'home', 'low-impact'],
  isGymRequired: false,
  isHomeFriendly: true,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 20,
  maxSessionMinutes: 30,
  goalText: 'Light the metabolic spark and build daily habits in 28 days.',
};

// ---------- Program 5: Shred & Burn HIIT -----------------------------------

const program5 = {
  programCode: 'shred_burn_hiit',
  programName: 'Shred & Burn HIIT',
  subHeader: 'High-Intensity, High-Result: The 4-Week Metabolic Overdrive',
  overview:
    '2:1 work-to-rest, explosive compound moves, weekly density progression. Designed to torch calories and build athletic capacity.',
  whatsInside:
    '3 HIIT days (Lower / Upper+Core / Full Body) + LISS + Mobility + Outdoor activity. Rounds and rest evolve weekly.',
  isThisForYou: 'Intermediate trainees seeking fast fat loss without sacrificing strength.',
  theGoal: 'Maximize calorie burn, build athletic capacity, and shed body fat.',
  missionStatement: 'Comfort is the enemy of growth.',
  primaryGoal: 'Weight Loss, General Fitness, Endurance',
  primaryGoals: ['Weight Loss', 'General Fitness', 'Endurance'],
  workoutSkillLevel: 'Intermediate',
  workoutSkillType: 'HIIT',
  workoutPreference: 'HIIT',

  durationWeeks: 4,
  frequencyPerWeek: 6,
  avgSessionMinutes: 45,
  frequencyCaption: '3 HIIT + LISS + Mobility + Outdoor + Rest',
  frequency: '6',
  daysPerWeek: '6',

  locationTag: 'Home Friendly / No Equipment',
  equipment: 'One set of Dumbbells or a Kettlebell, timer (in-app), small space for plyos.',
  equipmentList: ['Dumbbells or Kettlebell', 'Timer (in-app)', 'Floor space'],
  equipmentNote: 'No gym required.',
  noEquipmentRequired: false,

  implementationNote:
    'Week 3: change rest from 20s → 15s in all HIIT blocks. Week 4: increase rounds from 4 → 5. Add "Finisher" (2 min max-effort) at end of every session in Week 4.',

  phaseCount: 1,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification: '',
    phases: [mkPhase('Shred & Burn', 1, 4, 'Progressive HIIT density and round volume', '15-20s')],
  },

  frequencyRules: {
    trainingDaysPerWeek: '3',
    recoveryDaysPerWeek: '2',
    restDaysPerWeek: '1',
    flexibleSchedule: false,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'Rounds completed + rep counts per round',
    secondaryMetric: 'LISS time / outdoor activity duration',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: true,
    habitTracker: true,
  },

  schedule: [weekRow(1, 'A', 'cardio', 'B', 'recovery', 'C', 'outdoor', 'rest')],

  weekGrid: {
    cadence: cad('A', 'cardio', 'B', 'recovery', 'C', 'outdoor', 'rest'),
    progression: {
      week1: 'The Threshold — find max effort pace',
      week2: 'The Volume Up — add 5th round',
      week3: 'The Sprint — rest 20s → 15s, work 45s',
      week4: 'The Peak — add 2-min finisher',
    },
  },

  workouts: {
    A: [
      mkExercise('Goblet Squat', { sets: 4, reps: '40s work / 20s rest', role: 'Large Muscle', tag: 'Large Muscle', alt: 'KB Goblet Squat', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Lateral Lunge', { sets: 4, reps: '40s work / 20s rest', role: 'Primary Strength', alt: 'DB Lateral Lunge', muscles: ['Adductors', 'Glutes'] }),
      mkExercise('Jump Squat', { sets: 4, reps: '40s work / 20s rest', role: 'Power', alt: 'Air Squat (low impact)', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Glute Bridge March', { sets: 4, reps: '40s work / 20s rest', role: 'Accessory', muscles: ['Glutes', 'Core'] }),
      mkExercise('Skaters', { sets: 4, reps: '40s work / 20s rest', role: 'Power', muscles: ['Glutes', 'Adductors'] }),
    ],
    B: [
      mkExercise('Push-Up', { sets: 4, reps: '40s work / 20s rest', role: 'Large Muscle', tag: 'Large Muscle', alt: 'Incline Push-up', muscles: ['Chest', 'Triceps'] }),
      mkExercise('Renegade Row', { sets: 4, reps: '40s work / 20s rest', role: 'Primary Strength', muscles: ['Back', 'Core'] }),
      mkExercise('Mountain Climbers', { sets: 4, reps: '40s work / 20s rest', role: 'Conditioning', muscles: ['Core', 'Shoulders'] }),
      mkExercise('Overhead Press', { sets: 4, reps: '40s work / 20s rest', role: 'Primary Strength', muscles: ['Shoulders', 'Triceps'] }),
      mkExercise('Burpees', { sets: 4, reps: '40s work / 20s rest', role: 'Conditioning', alt: 'Step-back Burpee (no jump)', muscles: ['Full Body'] }),
    ],
    C: [
      mkExercise('DB Thruster', { sets: 4, reps: '40s work / 20s rest', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Full Body'] }),
      mkExercise('Reverse Lunge to Knee Drive', { sets: 4, reps: '40s alternating', role: 'Primary Strength', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Plank Jacks', { sets: 4, reps: '40s work / 20s rest', role: 'Core', tag: 'Core', muscles: ['Core', 'Shoulders'] }),
      mkExercise('Kettlebell Swing', { sets: 4, reps: '40s work / 20s rest', role: 'Power', alt: 'DB Swing', muscles: ['Posterior Chain'] }),
      mkExercise('Bicycle Crunches', { sets: 4, reps: '40s slow & controlled', role: 'Core', tag: 'Core', muscles: ['Obliques'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({
      format: 'HIIT 40:20',
      workInterval: '40s',
      restBetweenSets: '20s (W1-W2) / 15s (W3-W4)',
      rounds: '4 (W1-W3) / 5 (W4)',
      estDuration: '40-60 minutes',
      overload: [
        mkOverload(1, 4, '40s', '20s', 'The Threshold'),
        mkOverload(2, 5, '40s', '20s', 'The Volume Up'),
        mkOverload(3, 4, '45s', '15s', 'The Sprint'),
        mkOverload(4, 5, '45s', '15s', 'The Peak + 2-min finisher'),
      ],
    }),
    B: mkMeta({
      format: 'HIIT 40:20',
      workInterval: '40s',
      restBetweenSets: '20s (W1-W2) / 15s (W3-W4)',
      rounds: '4 / 5',
      estDuration: '40-60 minutes',
      overload: [
        mkOverload(1, 4, '40s', '20s'),
        mkOverload(2, 5, '40s', '20s'),
        mkOverload(3, 4, '45s', '15s'),
        mkOverload(4, 5, '45s', '15s'),
      ],
    }),
    C: mkMeta({
      format: 'HIIT 40:20 — Full Body Burn',
      workInterval: '40s',
      restBetweenSets: '20s / 15s',
      rounds: '4 / 5',
      estDuration: '40-60 minutes',
      overload: [
        mkOverload(1, 4, '40s', '20s'),
        mkOverload(2, 5, '40s', '20s'),
        mkOverload(3, 4, '45s', '15s'),
        mkOverload(4, 5, '45s', '15s'),
      ],
    }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Goblet Squat', { sets: 4, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Lateral Lunge', { sets: 4, reps: '40s/20s', role: 'Primary Strength' }),
      mkExercise('Jump Squat', { sets: 4, reps: '40s/20s', role: 'Power' }),
      mkExercise('Glute Bridge March', { sets: 4, reps: '40s/20s', role: 'Accessory' }),
      mkExercise('Skaters', { sets: 4, reps: '40s/20s', role: 'Power' }),
    ],
    B: [
      mkExercise('Push-Up', { sets: 4, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Renegade Row', { sets: 4, reps: '40s/20s', role: 'Primary Strength' }),
      mkExercise('Mountain Climbers', { sets: 4, reps: '40s/20s', role: 'Conditioning' }),
      mkExercise('Overhead Press', { sets: 4, reps: '40s/20s', role: 'Primary Strength' }),
      mkExercise('Burpees', { sets: 4, reps: '40s/20s', role: 'Conditioning' }),
    ],
    C: [
      mkExercise('DB Thruster', { sets: 4, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Reverse Lunge to Knee Drive', { sets: 4, reps: '40s alternating', role: 'Primary Strength' }),
      mkExercise('Plank Jacks', { sets: 4, reps: '40s/20s', role: 'Core', tag: 'Core' }),
      mkExercise('Kettlebell Swing', { sets: 4, reps: '40s/20s', role: 'Power' }),
      mkExercise('Bicycle Crunches', { sets: 4, reps: '40s slow', role: 'Core', tag: 'Core' }),
    ],
    cardio: [mkExercise('Brisk Walk (LISS)', { sets: 1, reps: '30-45 min', role: 'Cardio', tag: 'Cardio' })],
    outdoor: [mkExercise('Outdoor Hike / Bike / Walk', { sets: 1, reps: '60 min', role: 'Cardio', tag: 'Cardio' })],
  },

  engineSettings: {
    timerTypes: ['Interval Timer 40:20', 'Round Timer', 'Finisher Stopwatch'],
    uiFeatures: ['Rep Count per Round', 'Finisher Block (W4)', 'Outdoor Activity Logger'],
  },

  recovery: {
    lissMinutes: 60,
    lissPrompt: 'Tuesday: 30-45 min brisk walk for fat oxidation. Saturday: 60 min outdoor (Unite Day).',
    lissOptions: 'Walk, Hike, Bike',
    stretches: [
      mkStretch('Cat-Cow', '60s'),
      mkStretch("World's Greatest Stretch", '60s/side'),
      mkStretch('90/90 Hip Switches', '60s'),
      mkStretch("Child's Pose to Cobra", '60s'),
      mkStretch('Thoracic Thread-the-Needle', '60s/side'),
      mkStretch('Deep Squat Hold', '60s'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 30,
      coachPrompt: 'LISS — 30 to 45 min brisk walk. Light enough to recover, hard enough to burn.',
      activityOptions: ['Brisk Walk', 'Light Cycle', 'Easy Row'],
      media_url: '',
    },
    stretches: [
      { name: 'Cat-Cow', detail: '60s' },
      { name: "World's Greatest Stretch", detail: '60s/side' },
      { name: '90/90 Hip Switches', detail: '60s' },
      { name: "Child's Pose to Cobra", detail: '60s' },
      { name: 'Thoracic Thread-the-Needle', detail: '60s/side' },
      { name: 'Deep Squat Hold', detail: '60s' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'LISS Cardio',
      name: 'Tuesday LISS + Core',
      dayAssignment: 'Tuesday',
      duration: '45 min walk + 3 min plank circuit',
      intensity: 'Low',
      modality: 'Walk',
      format: 'LISS + circuit',
      roundsP1: '3 × 1-min plank',
    }),
    mkRecoveryBlock({
      type: 'Mobility Flow',
      name: 'Restore & Reset',
      dayAssignment: 'Thursday',
      duration: '12 min',
      intensity: 'Low',
      modality: 'Mat',
      format: 'Single circuit',
      roundsP1: '2',
      items: [
        mkRecoveryItem('Cat-Cow', '60s'),
        mkRecoveryItem("World's Greatest Stretch", '60s/side'),
        mkRecoveryItem('90/90 Hip Switches', '60s'),
        mkRecoveryItem("Child's Pose to Cobra", '60s'),
        mkRecoveryItem('Thoracic Thread-the-Needle', '60s/side'),
        mkRecoveryItem('Deep Squat Hold', '60s'),
      ],
    }),
    mkRecoveryBlock({
      type: 'Outdoor Activity',
      name: 'Unite Day',
      dayAssignment: 'Saturday',
      duration: '60 min',
      intensity: 'Moderate',
      modality: 'Hike / Walk / Bike',
      format: 'Single session',
      roundsP1: '1',
    }),
  ],

  restDayConfig: {
    type: 'Full rest + meal prep',
    message: 'Recover and stock the kitchen for the week.',
    deepRecovery: false,
    outdoorActivity: false,
  },

  injuryPrevention: {
    notes: 'Plyo alternatives provided (Air Squat for Jump Squat, Step-back Burpee). Listen to joints.',
    prenatalMode: false,
    weightGuard: false,
    deloadWeeks: false,
  },

  recoveryTips: [
    { day: 'Thursday', text: 'Mobility on Thursday is as important as Monday squats — Forge then Recover.' },
  ],

  tags: ['hiit', 'fat-loss', 'metabolic', 'home', 'intermediate'],
  isGymRequired: false,
  isHomeFriendly: true,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 25,
  maxSessionMinutes: 60,
  goalText: 'Torch fat, build athletic capacity, push past comfort.',
};

// ---------- Program 6: Elite Metabolic -------------------------------------

const program6 = {
  programCode: 'elite_metabolic',
  programName: 'Elite Metabolic',
  subHeader: 'Precision Training for the High-Performance Physique',
  overview:
    'Most demanding fat-loss block: Advanced MetCon, complex movement patterns, EMOM and AMRAP — built for the athlete who treats training like a job.',
  whatsInside:
    'The Power Engine, Upper Push/Pull, Active Recovery, Chain MetCon EMOM, AMRAP Challenger, Outdoor Venture, Deep Recover.',
  isThisForYou: 'Advanced athletes who want maximum body recomposition and elite work capacity.',
  theGoal: 'Strip fat without losing performance; test mental and physical limits.',
  missionStatement: "The elite don't just train when they feel like it; they train because their goals require it.",
  primaryGoal: 'Weight Loss, Endurance',
  primaryGoals: ['Weight Loss', 'Endurance'],
  workoutSkillLevel: 'Advanced',
  workoutSkillType: 'HIIT',
  workoutPreference: 'HIIT',

  durationWeeks: 4,
  frequencyPerWeek: 7,
  avgSessionMinutes: 60,
  frequencyCaption: '4 Strength/MetCon + Active Recovery + Outdoor + Deep Recover',
  frequency: '7',
  daysPerWeek: '7',

  locationTag: 'Commercial Gym / Outdoor',
  equipment: 'Full DB Set, KBs, Pull-up Bar, Rower/Bike/Track, Barbell, Box.',
  equipmentList: ['Full DB Set', 'Kettlebells', 'Pull-up Bar', 'Rower or Bike or 400m Track', 'Barbell', 'Plyo Box'],
  equipmentNote: 'Commercial gym recommended.',
  noEquipmentRequired: false,

  implementationNote:
    'Week 1: baseline. Week 2: add finishers after each strength block. Week 3: supersets/tri-sets, minimize rest. Week 4: Challenger week.',

  phaseCount: 1,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification: '',
    phases: [mkPhase('Elite Metabolic', 1, 4, 'Maximize fat loss while preserving performance', '60-90s')],
  },

  frequencyRules: {
    trainingDaysPerWeek: '4',
    recoveryDaysPerWeek: '2',
    restDaysPerWeek: '1',
    flexibleSchedule: false,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'AMRAP rounds + EMOM completion + heavy lift PRs',
    secondaryMetric: 'Zone 2 HR adherence',
    photoCheckIn: false,
    leaderboard: true,
    pbTracker: true,
    habitTracker: true,
  },

  schedule: [weekRow(1, 'A', 'B', 'recovery', 'C', 'D', 'outdoor', 'recovery')],

  weekGrid: {
    cadence: cad('A', 'B', 'recovery', 'C', 'D', 'outdoor', 'recovery'),
    weekly: {
      week1: 'The Baseline',
      week2: 'The Density Shift — add finishers',
      week3: 'The Redline — supersets/tri-sets',
      week4: 'The Peak — Challenger week',
    },
  },

  workouts: {
    A: [
      mkExercise('Barbell Back Squat', { sets: 5, reps: '5', rest: '90s', role: 'Primary Lift', tag: 'Large Muscle', alt: 'Weighted Goblet Squat', muscles: ['Quads', 'Glutes'] }),
      mkExercise('400m Run', { sets: 4, reps: '1 round', rest: '90s', role: 'Power MetCon', alt: '1 min Max Effort Rower/Bike', muscles: ['Cardio'] }),
      mkExercise('Kettlebell Swing', { sets: 4, reps: '20', role: 'Power MetCon', muscles: ['Posterior Chain'] }),
      mkExercise('Box Jump', { sets: 4, reps: '15', role: 'Power MetCon', alt: 'Tuck Jump', muscles: ['Quads', 'Glutes'] }),
    ],
    B: [
      mkExercise('Barbell Overhead Press', { sets: 4, reps: '8-10', rest: '60s', role: 'Superset A1', tag: 'Large Muscle', alt: 'DB Overhead Press', muscles: ['Shoulders', 'Triceps'] }),
      mkExercise('Pull-Up', { sets: 4, reps: '8-10', rest: '60s', role: 'Superset A2', alt: 'Lat Pulldown', muscles: ['Back', 'Biceps'] }),
      mkExercise('DB Incline Bench Press', { sets: 4, reps: '10-12', rest: '60s', role: 'Superset B1', alt: 'Barbell', muscles: ['Upper Chest'] }),
      mkExercise('Single-Arm DB Row', { sets: 4, reps: '10-12/side', rest: '60s', role: 'Superset B2', muscles: ['Back', 'Biceps'] }),
      mkExercise('Hand-Release Push-Up', { sets: 1, reps: '10-1 ladder', role: 'Metabolic Ladder', muscles: ['Chest', 'Triceps'] }),
      mkExercise('Alternating DB Snatch', { sets: 1, reps: '10-1 ladder', role: 'Metabolic Ladder', muscles: ['Full Body'] }),
      mkExercise('V-Up', { sets: 1, reps: '10-1 ladder', role: 'Metabolic Ladder', muscles: ['Core'] }),
    ],
    C: [
      mkExercise('DB Romanian Deadlift', { sets: 4, reps: '12 (EMOM min 1)', role: 'EMOM', tag: 'Large Muscle', muscles: ['Posterior Chain'] }),
      mkExercise('DB Renegade Row', { sets: 4, reps: '15 (EMOM min 2)', role: 'EMOM', muscles: ['Back', 'Core'] }),
      mkExercise('Kettlebell Swing', { sets: 4, reps: '15 (EMOM min 3)', role: 'EMOM', muscles: ['Posterior Chain'] }),
      mkExercise('Burpees', { sets: 4, reps: '15 (EMOM min 4)', role: 'EMOM', muscles: ['Full Body'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({
      format: 'Strength (5×5) + Power MetCon (4 rounds for time)',
      restBetweenSets: '90s strength / 90s between rounds',
      estDuration: '60-75 minutes',
      rounds: '4',
      overload: [
        mkOverload(1, 5, 5, '90s', 'Baseline 5×5'),
        mkOverload(2, 5, 5, '90s', 'Add finisher'),
        mkOverload(3, 5, 5, '60-75s', 'Reduce rest'),
        mkOverload(4, 5, 5, '60s', 'Challenger week'),
      ],
    }),
    B: mkMeta({
      format: 'Supersets + Metabolic Ladder',
      restBetweenSets: '60s',
      rounds: '4 supersets + 1 ladder',
      estDuration: '60 minutes',
      overload: [
        mkOverload(1, 4, '8-12', '60s', 'Baseline'),
        mkOverload(2, 4, '8-12', '60s', 'Add finisher'),
        mkOverload(3, 4, '8-12', '45s', 'Tighten rest'),
        mkOverload(4, 4, '8-12', '45s', 'Challenger'),
      ],
    }),
    C: mkMeta({
      format: 'EMOM 20',
      workInterval: '1 minute per movement',
      rounds: '4 cycles',
      estDuration: '20 minutes',
      overload: [
        mkOverload(1, 4, 'EMOM 20', '', 'Baseline'),
        mkOverload(2, 4, 'EMOM 20 + finisher'),
        mkOverload(3, 4, 'EMOM 20 increased reps'),
        mkOverload(4, 4, 'EMOM 20 Challenger reps'),
      ],
    }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Barbell Back Squat', { sets: 5, reps: '5', rest: '90s', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('400m Run', { sets: 4, reps: '1 round', role: 'Power MetCon' }),
      mkExercise('Kettlebell Swing', { sets: 4, reps: '20', role: 'Power MetCon' }),
      mkExercise('Box Jump', { sets: 4, reps: '15', role: 'Power MetCon' }),
    ],
    B: [
      mkExercise('Barbell Overhead Press', { sets: 4, reps: '8-10', rest: '60s', role: 'Superset A1' }),
      mkExercise('Pull-Up', { sets: 4, reps: '8-10', rest: '60s', role: 'Superset A2' }),
      mkExercise('DB Incline Bench Press', { sets: 4, reps: '10-12', rest: '60s', role: 'Superset B1' }),
      mkExercise('Single-Arm DB Row', { sets: 4, reps: '10-12/side', rest: '60s', role: 'Superset B2' }),
      mkExercise('Hand-Release Push-Up', { sets: 1, reps: '10-1 ladder', role: 'Metabolic Ladder' }),
      mkExercise('Alternating DB Snatch', { sets: 1, reps: '10-1 ladder', role: 'Metabolic Ladder' }),
      mkExercise('V-Up', { sets: 1, reps: '10-1 ladder', role: 'Metabolic Ladder' }),
    ],
    C: [
      mkExercise('DB Romanian Deadlift', { sets: 4, reps: '12 EMOM', role: 'EMOM' }),
      mkExercise('DB Renegade Row', { sets: 4, reps: '15 EMOM', role: 'EMOM' }),
      mkExercise('Kettlebell Swing', { sets: 4, reps: '15 EMOM', role: 'EMOM' }),
      mkExercise('Burpees', { sets: 4, reps: '15 EMOM', role: 'EMOM' }),
    ],
    D: [
      mkExercise('DB Thruster', { sets: 1, reps: '10 (AMRAP block)', role: 'AMRAP' }),
      mkExercise('Pull-Up', { sets: 1, reps: '10 (AMRAP block)', role: 'AMRAP', alt: 'Heavy DB Row' }),
      mkExercise('Push-Up', { sets: 1, reps: '10 (AMRAP block)', role: 'AMRAP' }),
      mkExercise('DB Weighted Walking Lunge', { sets: 1, reps: '10 total (AMRAP block)', role: 'AMRAP' }),
      mkExercise('Bear Crawl', { sets: 1, reps: '100ft or 30s', role: 'AMRAP' }),
    ],
    outdoor: [
      mkExercise('Trail Run / Rucking', { sets: 1, reps: '60+ minutes', role: 'Outdoor' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Stopwatch (For Time)', 'EMOM Interval', 'AMRAP Countdown 20min', 'Zone 2 HR'],
    uiFeatures: ['Rounds + Reps Logger', 'Heart Rate Zone Display', 'Leaderboard'],
  },

  recovery: {
    lissMinutes: 60,
    lissPrompt: 'Wednesday: Zone 2 (60-70% max HR) — 45-60 min. Sunday: soft tissue + contrast.',
    lissOptions: 'Incline Walk, Rower, Cycle',
    stretches: [
      mkStretch('Foam Rolling', 'Full body, 10 min'),
      mkStretch('Diaphragmatic Breathing', '5 min'),
      mkStretch('Hip Flexor + Pec Stretch', '5 min'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 50,
      coachPrompt: 'Wednesday Zone 2 — sustainable HR 60-70% max for 45-60 minutes. Engine maintenance.',
      activityOptions: ['Incline Walk', 'Rower', 'Cycle'],
      media_url: '',
    },
    stretches: [
      { name: 'Soft Tissue Work', detail: 'Foam roll / lacrosse ball — 10 minutes' },
      { name: 'Contrast Shower', detail: 'Hot/cold — 5 minutes' },
      { name: 'Diaphragmatic Breathing', detail: '5 minutes' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'Zone 2',
      name: 'Active Recovery',
      dayAssignment: 'Wednesday',
      duration: '45-60 min',
      intensity: 'Zone 2 (60-70% max HR)',
      modality: 'Incline Walk / Row / Cycle',
      format: 'Steady state',
      roundsP1: '1',
    }),
    mkRecoveryBlock({
      type: 'Deep Recover',
      name: 'Deep Recover Sunday',
      dayAssignment: 'Sunday',
      duration: '20 min',
      intensity: 'Very Low',
      modality: 'Mat + shower',
      format: 'Single circuit',
      roundsP1: '1',
      items: [
        mkRecoveryItem('Foam rolling', '10 min', 'Full body'),
        mkRecoveryItem('Contrast shower', '5 min', 'Nervous system'),
        mkRecoveryItem('Diaphragmatic breathing', '5 min', 'Parasympathetic'),
      ],
    }),
    mkRecoveryBlock({
      type: 'Outdoor Activity',
      name: 'Unite & Venture',
      dayAssignment: 'Saturday',
      duration: '60+ min',
      intensity: 'High',
      modality: 'Trail Run / Rucking',
      format: 'Single session',
      roundsP1: '1',
    }),
  ],

  restDayConfig: {
    type: 'Deep recover (soft tissue + breathing)',
    message: 'Soft tissue, contrast, breathing.',
    deepRecovery: true,
    outdoorActivity: false,
  },

  injuryPrevention: {
    notes: 'High intensity demands strict mobility care. Zone 2 protects the engine.',
    prenatalMode: false,
    weightGuard: false,
    deloadWeeks: false,
  },

  recoveryTips: [
    { day: 'Wednesday', text: 'Zone 2 is engine maintenance — it makes Friday faster.' },
    { day: 'Sunday', text: 'Contrast + breathing flips you into parasympathetic so you actually rebuild.' },
  ],

  tags: ['advanced', 'metcon', 'emom', 'amrap', 'zone2'],
  isGymRequired: true,
  isHomeFriendly: false,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 45,
  maxSessionMinutes: 75,
  goalText: 'Elite fat loss without losing edge — body recomposition for performance athletes.',
};

// ---------- Program 7: Bodyweight Basics -----------------------------------

const program7 = {
  programCode: 'bodyweight_basics',
  programName: 'Bodyweight Basics',
  subHeader: 'Master Your Machine. No Equipment Required.',
  overview:
    "Strips away the weight room to focus on calisthenic strength, structural integrity, and total-body control. Uses tempo control and high-density circuits.",
  whatsInside:
    '5 sessions: Upper Foundation, Lower Pillars, Mobility Flow, EMOM 20, Core & Midline.',
  isThisForYou: 'Travelers, home-workout enthusiasts, athletes refining movement mechanics.',
  theGoal: 'Build calisthenic strength and movement quality without equipment.',
  missionStatement: 'Your body is your most important piece of equipment.',
  primaryGoal: 'Weight Loss, Strength, General Fitness',
  primaryGoals: ['Weight Loss', 'Strength', 'General Fitness'],
  workoutSkillLevel: 'Beginner',
  workoutSkillType: 'Functional Movement',
  workoutPreference: 'Functional Movement',

  durationWeeks: 8,
  frequencyPerWeek: 5,
  avgSessionMinutes: 30,
  frequencyCaption: '3 or 4 Days/Week — Adjustable',
  frequency: '5',
  daysPerWeek: '5',

  locationTag: 'Home Friendly / No Equipment',
  equipment: 'Zero (optional: chair or bench).',
  equipmentList: ['Bodyweight', 'Chair or bench (optional)'],
  equipmentNote: 'Travel-friendly.',
  noEquipmentRequired: true,

  implementationNote:
    'Difficulty comes from Tempo (slowing reps) and High Volume. Track total reps per session. UI requires a Tempo Visualizer (e.g., expanding circle).',

  phaseCount: 1,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification: '',
    phases: [mkPhase('Master Your Machine', 1, 8, 'Tempo and volume mastery', '30-60s')],
  },

  frequencyRules: {
    trainingDaysPerWeek: '4',
    recoveryDaysPerWeek: '1',
    restDaysPerWeek: '2',
    flexibleSchedule: true,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'Total reps per session (beat last week)',
    secondaryMetric: 'Tempo consistency',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: true,
    habitTracker: true,
  },

  schedule: [weekRow(1, 'A', 'B', 'recovery', 'C', 'D', 'rest', 'rest')],

  weekGrid: {
    cadence: cad('A', 'B', 'recovery', 'C', 'D', 'rest', 'rest'),
    monday: 'Upper Foundation (Push/Pull)',
    tuesday: 'Lower Body Pillars',
    wednesday: 'Mobility Flow',
    thursday: 'EMOM 20',
    friday: 'Core & Midline',
  },

  workouts: {
    A: [
      mkExercise('Tempo Push-Ups', { sets: 4, reps: '10-12 (3s down, 1s hold, explode up)', tempo: '3-1-X-0', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Chest', 'Triceps'] }),
      mkExercise('Incline Bench Dips', { sets: 4, reps: '15', role: 'Primary Strength', alt: 'Floor dip', muscles: ['Triceps'] }),
      mkExercise('Pike Push-ups', { sets: 3, reps: '10', role: 'Primary Strength', muscles: ['Shoulders'] }),
      mkExercise('Superman Holds', { sets: 3, reps: '45s', role: 'Accessory', muscles: ['Lower Back', 'Glutes'] }),
      mkExercise('Plank Shoulder Taps', { sets: 3, reps: '20 total', role: 'Core', tag: 'Core', muscles: ['Core', 'Shoulders'] }),
    ],
    B: [
      mkExercise('Alternating Reverse Lunges', { sets: 4, reps: '20 total', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Bulgarian Split Squats', { sets: 4, reps: '10/side', role: 'Primary Strength', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Air Squats', { sets: 3, reps: '25', role: 'Accessory', muscles: ['Quads'] }),
      mkExercise('Glute Bridges', { sets: 3, reps: '20', role: 'Accessory', muscles: ['Glutes'] }),
      mkExercise('Wall Sit', { sets: 3, reps: '60s', role: 'Conditioning', muscles: ['Quads'] }),
    ],
    C: [
      mkExercise('Air Squats', { sets: 1, reps: '15 (EMOM min 1)', role: 'EMOM', muscles: ['Quads'] }),
      mkExercise('Push-Ups', { sets: 1, reps: '10 (EMOM min 2)', role: 'EMOM', muscles: ['Chest'] }),
      mkExercise('Burpees', { sets: 1, reps: '12 (EMOM min 3)', role: 'EMOM', alt: 'No push-up version', muscles: ['Full Body'] }),
      mkExercise('Bicycle Crunches', { sets: 1, reps: '20 (EMOM min 4)', role: 'EMOM', muscles: ['Obliques'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({
      format: 'Slow-Mo Strength + Endurance Density',
      restBetweenSets: '45s',
      estDuration: '30 minutes',
      overload: [
        mkOverload(1, 4, '10-12 tempo', '45s', 'Find tempo'),
        mkOverload(2, 4, '12 tempo', '45s', 'Add reps'),
        mkOverload(3, 4, '12 tempo', '30s', 'Tighter rest'),
        mkOverload(4, 4, '15 tempo', '30s', 'Peak volume'),
      ],
    }),
    B: mkMeta({
      format: 'Leg Volume + The Burn',
      restBetweenSets: '45s',
      estDuration: '30 minutes',
      overload: [
        mkOverload(1, 4, '20 total lunges', '45s'),
        mkOverload(2, 4, '20 total + 12/side BSS', '45s'),
        mkOverload(3, 4, '24 total + 12/side BSS', '30s'),
        mkOverload(4, 4, '24 total + 15/side BSS', '30s'),
      ],
    }),
    C: mkMeta({
      format: 'EMOM 20',
      workInterval: '1 min',
      rounds: '4 cycles',
      estDuration: '20 minutes',
      overload: [
        mkOverload(1, 4, 'EMOM 20'),
        mkOverload(2, 4, 'EMOM 20 +2 reps each'),
        mkOverload(3, 4, 'EMOM 20 +3 reps each'),
        mkOverload(4, 4, 'EMOM 20 challenger'),
      ],
    }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Tempo Push-Ups', { sets: 4, reps: '10-12 tempo', tempo: '3-1-X-0', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Incline Bench Dips', { sets: 4, reps: '15', role: 'Primary Strength' }),
      mkExercise('Pike Push-ups', { sets: 3, reps: '10', role: 'Primary Strength' }),
      mkExercise('Superman Holds', { sets: 3, reps: '45s', role: 'Accessory' }),
      mkExercise('Plank Shoulder Taps', { sets: 3, reps: '20 total', role: 'Core', tag: 'Core' }),
    ],
    B: [
      mkExercise('Alternating Reverse Lunges', { sets: 4, reps: '20 total', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Bulgarian Split Squats', { sets: 4, reps: '10/side', role: 'Primary Strength' }),
      mkExercise('Air Squats', { sets: 3, reps: '25', role: 'Accessory' }),
      mkExercise('Glute Bridges', { sets: 3, reps: '20', role: 'Accessory' }),
      mkExercise('Wall Sit', { sets: 3, reps: '60s', role: 'Conditioning' }),
    ],
    C: [
      mkExercise('Air Squats (EMOM)', { sets: 1, reps: '15/min', role: 'EMOM' }),
      mkExercise('Push-Ups (EMOM)', { sets: 1, reps: '10/min', role: 'EMOM' }),
      mkExercise('Burpees (EMOM)', { sets: 1, reps: '12/min', role: 'EMOM' }),
      mkExercise('Bicycle Crunches (EMOM)', { sets: 1, reps: '20/min', role: 'EMOM' }),
    ],
    D: [
      mkExercise('Hollow Body Hold', { sets: 4, reps: '30s', role: 'Core', tag: 'Core' }),
      mkExercise('Side Plank', { sets: 4, reps: '30s/side', role: 'Core', tag: 'Core' }),
      mkExercise('Bird-Dog', { sets: 4, reps: '16 total', role: 'Core', tag: 'Core' }),
      mkExercise('Mountain Climbers', { sets: 5, reps: '45s', role: 'Conditioning' }),
      mkExercise('Plank', { sets: 5, reps: 'To Failure (log time)', role: 'Core', tag: 'Core' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Tempo Visualizer', 'EMOM Interval', 'Stopwatch (Plank to failure)'],
    uiFeatures: ['Total Reps Tracker', 'Last Session Comparison ("Beat 45 push-ups")'],
  },

  recovery: {
    lissMinutes: 15,
    lissPrompt: '15-minute full body flow.',
    lissOptions: 'Floor Flow',
    stretches: [
      mkStretch('Cat-Cow'),
      mkStretch('Downward Dog'),
      mkStretch("World's Greatest Stretch"),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 15,
      coachPrompt: '15-minute full body flow — joints, then movement, then breathing.',
      activityOptions: ['Floor flow', 'Optional easy walk'],
      media_url: '',
    },
    stretches: [
      { name: 'Cat-Cow', detail: '60s' },
      { name: 'Downward Dog', detail: '60s' },
      { name: "World's Greatest Stretch", detail: '5/side' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'Mobility Flow',
      name: 'Full Body Flow',
      dayAssignment: 'Wednesday',
      duration: '15 min',
      intensity: 'Low',
      modality: 'Floor',
      format: 'Single circuit',
      roundsP1: '1',
      items: [
        mkRecoveryItem('Cat-Cow', '60s'),
        mkRecoveryItem('Downward Dog', '60s'),
        mkRecoveryItem("World's Greatest Stretch", '5/side'),
      ],
    }),
  ],

  restDayConfig: {
    type: 'Full rest',
    message: 'Hydrate, walk if you feel like it.',
    deepRecovery: false,
    outdoorActivity: true,
  },

  injuryPrevention: {
    notes: 'Bodyweight is lower-impact. Tempo control protects joints.',
    prenatalMode: false,
    weightGuard: false,
    deloadWeeks: false,
  },

  recoveryTips: [
    { day: 'Wednesday', text: 'Flow is part of training — it keeps you supple for harder reps.' },
  ],

  tags: ['bodyweight', 'functional', 'no-equipment', 'beginner', 'tempo'],
  isGymRequired: false,
  isHomeFriendly: true,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 20,
  maxSessionMinutes: 40,
  goalText: 'Master the machine that travels with you.',
};

// ---------- Program 8: Core & Flow -----------------------------------------

const program8 = {
  programCode: 'core_flow',
  programName: 'Core & Flow',
  subHeader: 'Stability in the Center. Fluidity in Motion.',
  overview:
    'Bridges the gap between high-intensity training and longevity. True core integration paired with rhythmic mobility flows.',
  whatsInside:
    'Core Integrity, Dynamic Flow, Deep Reset days — usable as standalone program or supplement.',
  isThisForYou: 'Anyone who wants 360-degree core and longevity-grade mobility.',
  theGoal: 'Build a resilient mid-line and supple joints.',
  missionStatement: 'True strength is not rigid; it is adaptable.',
  primaryGoal: 'General Fitness, Mobility',
  primaryGoals: ['General Fitness', 'Mobility'],
  workoutSkillLevel: 'Beg / Int',
  workoutSkillType: 'Functional Movement',
  workoutPreference: 'Functional Movement',

  durationWeeks: 8,
  frequencyPerWeek: 5,
  avgSessionMinutes: 20,
  frequencyCaption: 'Any (5 Days structured)',
  frequency: '5',
  daysPerWeek: '5',

  locationTag: 'Home Friendly / Commercial Gym',
  equipment: 'Yoga Mat, Floor Space, optional light dumbbells or yoga block.',
  equipmentList: ['Yoga Mat', 'Light Dumbbells (optional)', 'Yoga Block (optional)'],
  equipmentNote: 'Travel-friendly.',
  noEquipmentRequired: true,

  implementationNote:
    'Pre-session prompts: Bracing Breath on core days, "Move Like Water" on flow days, 4-7-8 breath on Deep Reset day.',

  phaseCount: 1,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification: '',
    phases: [mkPhase('Core & Flow', 1, 8, 'Stability + mobility maintenance', '30s')],
  },

  frequencyRules: {
    trainingDaysPerWeek: '4',
    recoveryDaysPerWeek: '1',
    restDaysPerWeek: '2',
    flexibleSchedule: true,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'Core engagement quality (1-10 self-score)',
    secondaryMetric: 'Reset reflection ("Grounded/Sleepy/Light/Tense")',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: false,
    habitTracker: true,
  },

  schedule: [weekRow(1, 'A', 'B', 'recovery', 'A', 'B', 'rest', 'rest')],

  weekGrid: {
    cadence: cad('A', 'B', 'recovery', 'A', 'B', 'rest', 'rest'),
    monday: 'Core Integrity',
    tuesday: 'Dynamic Flow',
    wednesday: 'Deep Reset',
    thursday: 'Core Integrity',
    friday: 'Dynamic Flow',
  },

  workouts: {
    A: [
      mkExercise('360 Diaphragmatic Breathing', { sets: 3, reps: '60s', role: 'Core', tag: 'Core', muscles: ['Diaphragm'] }),
      mkExercise('Deadbugs (Slow Tempo)', { sets: 3, reps: '12 total alternating', tempo: '3-1-3-1', role: 'Core', tag: 'Core', muscles: ['Core'] }),
      mkExercise('Bird-Dog ISO-Hold', { sets: 3, reps: '5/side (hold 5s each)', role: 'Core', tag: 'Core', muscles: ['Core', 'Glutes'] }),
      mkExercise('Modified Side Plank', { sets: 3, reps: '30s/side', role: 'Core', tag: 'Core', muscles: ['Obliques'] }),
      mkExercise('Bear Crawl Hold', { sets: 3, reps: '45s', role: 'Core', tag: 'Core', muscles: ['Core', 'Shoulders'] }),
      mkExercise('Glute Bridge with Core March', { sets: 3, reps: '16 total marches', role: 'Accessory', muscles: ['Glutes', 'Core'] }),
      mkExercise("Child's Pose into Cobra Flow", { sets: 1, reps: '2 minutes flow', role: 'Mobility', muscles: ['Spine'] }),
    ],
    B: [
      mkExercise('Cat-Cow with Barrel Rolls', { sets: 2, reps: '60s', role: 'Mobility', muscles: ['Spine'] }),
      mkExercise("World's Greatest Stretch (Slow)", { sets: 2, reps: '6/side', role: 'Mobility', muscles: ['Hips', 'T-spine'] }),
      mkExercise('90/90 Hip Switches', { sets: 3, reps: '10 total', role: 'Mobility', muscles: ['Hips'] }),
      mkExercise('Scapular Push-ups', { sets: 3, reps: '12', role: 'Mobility', muscles: ['Shoulders'] }),
      mkExercise('Adductor Rock-backs', { sets: 3, reps: '10/side', role: 'Mobility', muscles: ['Adductors', 'Hips'] }),
      mkExercise('Thread the Needle', { sets: 1, reps: '60s/side', role: 'Mobility', muscles: ['Shoulders', 'T-spine'] }),
    ],
    C: [
      mkExercise("Supported Child's Pose", { sets: 1, reps: '3 min', role: 'Reset', muscles: ['Back'] }),
      mkExercise('Pigeon Pose (Right Side)', { sets: 1, reps: '3 min', role: 'Reset', muscles: ['Hips'] }),
      mkExercise('Pigeon Pose (Left Side)', { sets: 1, reps: '3 min', role: 'Reset', muscles: ['Hips'] }),
      mkExercise('Puppy Pose (Melting Heart)', { sets: 1, reps: '3 min', role: 'Reset', muscles: ['Shoulders', 'Back'] }),
      mkExercise('Legs Up The Wall', { sets: 1, reps: '5 min', role: 'Reset', muscles: ['Recovery'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({ format: 'Core Integrity — Bracing Breath', estDuration: '20 minutes', restBetweenSets: '30s', overload: [mkOverload(1, 3, 'Foundation rounds'), mkOverload(2, 3, 'Add tempo'), mkOverload(3, 4, 'Add round'), mkOverload(4, 4, 'Peak')] }),
    B: mkMeta({ format: 'Dynamic Flow — Move Like Water', estDuration: '20 minutes', restBetweenSets: 'continuous', overload: [mkOverload(1, 2, 'Foundation'), mkOverload(2, 3, 'Add round'), mkOverload(3, 3, 'Add hold time'), mkOverload(4, 3, 'Peak fluency')] }),
    C: mkMeta({ format: 'Deep Reset — 4-7-8 Breath', estDuration: '20 minutes', restBetweenSets: 'continuous (held positions)', overload: [mkOverload(1, 1, '3 min holds'), mkOverload(2, 1, '3 min holds'), mkOverload(3, 1, '3 min holds'), mkOverload(4, 1, '3 min holds')] }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('360 Diaphragmatic Breathing', { sets: 3, reps: '60s', role: 'Core', tag: 'Core' }),
      mkExercise('Deadbugs (Slow Tempo)', { sets: 3, reps: '12 total', role: 'Core', tag: 'Core' }),
      mkExercise('Bird-Dog ISO-Hold', { sets: 3, reps: '5/side, hold 5s', role: 'Core', tag: 'Core' }),
      mkExercise('Modified Side Plank', { sets: 3, reps: '30s/side', role: 'Core', tag: 'Core' }),
      mkExercise('Bear Crawl Hold', { sets: 3, reps: '45s', role: 'Core', tag: 'Core' }),
      mkExercise('Glute Bridge with Core March', { sets: 3, reps: '16 total', role: 'Accessory' }),
      mkExercise("Child's Pose into Cobra Flow", { sets: 1, reps: '2 min', role: 'Mobility' }),
    ],
    B: [
      mkExercise('Cat-Cow with Barrel Rolls', { sets: 2, reps: '60s', role: 'Mobility' }),
      mkExercise("World's Greatest Stretch", { sets: 2, reps: '6/side', role: 'Mobility' }),
      mkExercise('90/90 Hip Switches', { sets: 3, reps: '10 total', role: 'Mobility' }),
      mkExercise('Scapular Push-ups', { sets: 3, reps: '12', role: 'Mobility' }),
      mkExercise('Adductor Rock-backs', { sets: 3, reps: '10/side', role: 'Mobility' }),
      mkExercise('Thread the Needle', { sets: 1, reps: '60s/side', role: 'Mobility' }),
    ],
    C: [
      mkExercise("Supported Child's Pose", { sets: 1, reps: '3 min', role: 'Reset' }),
      mkExercise('Pigeon Pose Right', { sets: 1, reps: '3 min', role: 'Reset' }),
      mkExercise('Pigeon Pose Left', { sets: 1, reps: '3 min', role: 'Reset' }),
      mkExercise('Puppy Pose', { sets: 1, reps: '3 min', role: 'Reset' }),
      mkExercise('Legs Up The Wall', { sets: 1, reps: '5 min', role: 'Reset' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Stopwatch', 'Static Hold Timer', '4-7-8 Breath Pacer'],
    uiFeatures: ['Bracing Breath Overlay', 'Move Like Water Cue', 'Post-Reset Reflection ("Grounded/Sleepy/Light/Tense")'],
  },

  recovery: {
    lissMinutes: 0,
    lissPrompt: 'Program itself is recovery-focused.',
    lissOptions: '',
    stretches: [
      mkStretch("Supported Child's Pose", '3 min'),
      mkStretch('Pigeon Pose', '3 min/side'),
      mkStretch('Legs Up the Wall', '5 min'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 0,
      coachPrompt: 'Deep Reset Day — 4-7-8 breathing tells your brain it is safe to relax.',
      activityOptions: ['Optional easy walk', 'Stay still and breathe'],
      media_url: '',
    },
    stretches: [
      { name: "Supported Child's Pose", detail: '3 min' },
      { name: 'Pigeon Pose Right', detail: '3 min' },
      { name: 'Pigeon Pose Left', detail: '3 min' },
      { name: 'Puppy Pose', detail: '3 min' },
      { name: 'Legs Up the Wall', detail: '5 min' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'Deep Reset',
      name: 'Nervous System Care',
      dayAssignment: 'Wednesday',
      duration: '20 min',
      intensity: 'Very Low',
      modality: 'Floor + bolsters',
      format: 'Held positions',
      roundsP1: '1 (each held 3 min)',
      items: [
        mkRecoveryItem("Supported Child's Pose", '3 min', 'Back'),
        mkRecoveryItem('Pigeon Pose R/L', '3 min each', 'Hips'),
        mkRecoveryItem('Puppy Pose', '3 min', 'Shoulders/Back'),
        mkRecoveryItem('Legs Up the Wall', '5 min', 'Lymph/Recovery'),
      ],
    }),
  ],

  restDayConfig: {
    type: 'Active Recovery (program is itself a recovery tool)',
    message: 'Take an extra Deep Reset session if needed.',
    deepRecovery: true,
    outdoorActivity: true,
  },

  injuryPrevention: {
    notes: 'Form-check prompts: lower back on floor, neutral spine, ribs knit.',
    prenatalMode: false,
    weightGuard: false,
    deloadWeeks: false,
  },

  recoveryTips: [
    { day: 'Wednesday', text: '4-7-8 breath flips you into parasympathetic — that is where growth happens.' },
  ],

  tags: ['core', 'mobility', 'recovery', 'flow', 'breathwork'],
  isGymRequired: false,
  isHomeFriendly: true,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 20,
  maxSessionMinutes: 25,
  goalText: 'Build a resilient mid-line and supple joints.',
};

// ---------- Program 9: Functional Strength and Mastery --------------------

const program9 = {
  programCode: 'functional_strength_mastery',
  programName: 'Functional Strength and Mastery',
  subHeader: 'Bridge raw strength and athletic fluidity.',
  overview:
    'Designed for those who have built a solid baseline and want to integrate high-skill functional movements with traditional gym loading.',
  whatsInside:
    '4-Day rotation: Posterior Power & Midline, Vertical Press & Overhead Mobility, Explosive Extension & Unilateral, Full Body Integration.',
  isThisForYou: 'Advanced athletes seeking carryover from raw strength to athletic fluidity.',
  theGoal: 'Become structurally balanced, explosive, and mobility-rich.',
  missionStatement: 'A bridge between raw strength and athletic fluidity.',
  primaryGoal: 'Strength',
  primaryGoals: ['Strength', 'Movement Mastery'],
  workoutSkillLevel: 'Advanced',
  workoutSkillType: 'Functional Movement',
  workoutPreference: 'Functional Movement',

  durationWeeks: 8,
  frequencyPerWeek: 4,
  avgSessionMinutes: 60,
  frequencyCaption: '4 Days/Week — repeat with progressive overload',
  frequency: '4',
  daysPerWeek: '4',

  locationTag: 'Commercial Gym',
  equipment: 'Barbell, Squat Rack, Dumbbells/Kettlebells, Pull-up Station.',
  equipmentList: ['Barbell', 'Squat Rack', 'Dumbbells', 'Kettlebells', 'Pull-up Station'],
  equipmentNote: 'Commercial gym required.',
  noEquipmentRequired: false,

  implementationNote:
    'Same workouts repeat 8 weeks — lift heavier each week (progressive overload). Handstand/Cossack Squat double as recovery within sessions.',

  phaseCount: 1,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification: '',
    phases: [mkPhase('Functional Mastery', 1, 8, 'Progressive overload week over week', '90-180s')],
  },

  frequencyRules: {
    trainingDaysPerWeek: '4',
    recoveryDaysPerWeek: '0',
    restDaysPerWeek: '3',
    flexibleSchedule: true,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'Heavy lifts weight progression',
    secondaryMetric: 'Skill milestones (handstand hold time, Turkish get-up load)',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: true,
    habitTracker: false,
  },

  schedule: [weekRow(1, 'A', 'rest', 'B', 'rest', 'C', 'D', 'rest')],

  weekGrid: {
    cadence: cad('A', 'rest', 'B', 'rest', 'C', 'D', 'rest'),
    day1: 'Posterior Power & Midline',
    day2: 'Vertical Press & Overhead Mobility',
    day3: 'Explosive Extension & Unilateral',
    day4: 'Full Body Integration',
  },

  workouts: {
    A: [
      mkExercise('Deadlift (Conventional or Sumo)', { sets: 5, reps: '5', role: 'Primary Lift', tag: 'Large Muscle', muscles: ['Posterior Chain'] }),
      mkExercise('Weighted Pull-Ups', { sets: 4, reps: '6-8', role: 'Primary Strength', muscles: ['Back', 'Biceps'] }),
      mkExercise('Dual KB Front Rack Lunge', { sets: 3, reps: '10/side', role: 'Accessory', muscles: ['Quads', 'Core'] }),
      mkExercise('Hanging Leg Raises', { sets: 4, reps: '12-15', role: 'Core', tag: 'Core', muscles: ['Core'] }),
      mkExercise("Farmer's Carry", { sets: 4, reps: '40m', role: 'Carry', muscles: ['Grip', 'Core'] }),
    ],
    B: [
      mkExercise('Overhead Press (Barbell)', { sets: 5, reps: '5', role: 'Primary Lift', tag: 'Large Muscle', muscles: ['Shoulders', 'Triceps'] }),
      mkExercise('Dip (Weighted or Rings)', { sets: 4, reps: '8-10', role: 'Primary Strength', muscles: ['Chest', 'Triceps'] }),
      mkExercise('Goblet Cossack Squat', { sets: 3, reps: '8/side', role: 'Mobility/Strength', muscles: ['Hips', 'Adductors'] }),
      mkExercise('Face Pulls', { sets: 4, reps: '15-20', role: 'Accessory', muscles: ['Rear Delts'] }),
      mkExercise('Handstand Hold or Walk', { sets: 4, reps: '30-45s', role: 'Skill', muscles: ['Shoulders', 'Core'] }),
    ],
    C: [
      mkExercise('Power Clean or Snatch', { sets: 5, reps: '3', role: 'Primary Lift', tag: 'Large Muscle', muscles: ['Full Body'] }),
      mkExercise('Bulgarian Split Squats', { sets: 4, reps: '8/side', role: 'Primary Strength', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Single-Arm Dumbbell Row', { sets: 4, reps: '10/side', role: 'Accessory', muscles: ['Back', 'Biceps'] }),
      mkExercise('Romanian Deadlift (Barbell)', { sets: 3, reps: '10-12', role: 'Accessory', muscles: ['Hamstrings', 'Glutes'] }),
      mkExercise('Planks with Weight Plate', { sets: 3, reps: '60s', role: 'Core', tag: 'Core', muscles: ['Core'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({ format: 'Strength + Carries', restBetweenSets: '90-180s', estDuration: '60 min', overload: Array.from({ length: 8 }, (_, i) => mkOverload(i + 1, 5, 5, '180s', `Add 2.5-5% to Deadlift`)) }),
    B: mkMeta({ format: 'Vertical Press + Skill', restBetweenSets: '90-180s', estDuration: '60 min', overload: Array.from({ length: 8 }, (_, i) => mkOverload(i + 1, 5, 5, '180s', `Add 2.5-5% to OH Press`)) }),
    C: mkMeta({ format: 'Olympic + Unilateral', restBetweenSets: '120s', estDuration: '60 min', overload: Array.from({ length: 8 }, (_, i) => mkOverload(i + 1, 5, 3, '180s', `Add 2.5-5% to Clean/Snatch`)) }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Deadlift', { sets: 5, reps: '5', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('Weighted Pull-Ups', { sets: 4, reps: '6-8', role: 'Primary Strength' }),
      mkExercise('Dual KB Front Rack Lunge', { sets: 3, reps: '10/side', role: 'Accessory' }),
      mkExercise('Hanging Leg Raises', { sets: 4, reps: '12-15', role: 'Core', tag: 'Core' }),
      mkExercise("Farmer's Carry", { sets: 4, reps: '40m', role: 'Carry' }),
    ],
    B: [
      mkExercise('Overhead Press', { sets: 5, reps: '5', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('Weighted Dip', { sets: 4, reps: '8-10', role: 'Primary Strength' }),
      mkExercise('Goblet Cossack Squat', { sets: 3, reps: '8/side', role: 'Mobility/Strength' }),
      mkExercise('Face Pulls', { sets: 4, reps: '15-20', role: 'Accessory' }),
      mkExercise('Handstand Hold / Walk', { sets: 4, reps: '30-45s', role: 'Skill' }),
    ],
    C: [
      mkExercise('Power Clean / Snatch', { sets: 5, reps: '3', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('Bulgarian Split Squats', { sets: 4, reps: '8/side', role: 'Primary Strength' }),
      mkExercise('Single-Arm DB Row', { sets: 4, reps: '10/side', role: 'Accessory' }),
      mkExercise('Barbell RDL', { sets: 3, reps: '10-12', role: 'Accessory' }),
      mkExercise('Weighted Plank', { sets: 3, reps: '60s', role: 'Core', tag: 'Core' }),
    ],
    D: [
      mkExercise('Front Squat', { sets: 5, reps: '5', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('Incline DB Bench Press', { sets: 4, reps: '8-10', role: 'Primary Strength' }),
      mkExercise('Tempo Chin-Ups', { sets: 3, reps: 'To Failure (3s descent)', tempo: '3-0-X-0', role: 'Skill' }),
      mkExercise('Turkish Get-Up', { sets: 3, reps: '5/side', role: 'Skill' }),
      mkExercise('Sled Push / Drag', { sets: 4, reps: '30m', role: 'Conditioning' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Long Primary Rest', 'Stopwatch'],
    uiFeatures: ['Skill Milestone Tracker', 'Weekly +2.5-5% Prompt'],
  },

  recovery: {
    lissMinutes: 20,
    lissPrompt: 'Rest day mobility: foam roll, walk, breathing.',
    lissOptions: 'Walk, Bike',
    stretches: [
      mkStretch('Foam Roll Quads / Lats / T-spine'),
      mkStretch('Box Breathing'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 20,
      coachPrompt: 'Within-session recovery (Cossack Squat, Handstand) doubles as mobility. Add easy walk on rest days.',
      activityOptions: ['Easy walk', 'Foam roll', 'Box breathing'],
      media_url: '',
    },
    stretches: [
      { name: 'Foam Roll Quads', detail: '60s' },
      { name: 'Foam Roll Lats', detail: '60s' },
      { name: 'Foam Roll T-spine', detail: '60s' },
      { name: 'Box Breathing', detail: '4-4-4-4 × 10 rounds' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'Active Recovery',
      name: 'Rest Day Mobility',
      dayAssignment: 'Between sessions',
      duration: '20 min',
      intensity: 'Low',
      modality: 'Foam roll + breathing',
      format: 'Single circuit',
      roundsP1: '1',
    }),
  ],

  restDayConfig: {
    type: 'Full rest with optional easy walk',
    message: 'Big lifts demand big recovery.',
    deepRecovery: true,
    outdoorActivity: true,
  },

  injuryPrevention: {
    notes: 'Handstand and Cossack double as mobility. Olympic lifts demand spotless form.',
    prenatalMode: false,
    weightGuard: true,
    deloadWeeks: true,
  },

  recoveryTips: [
    { day: 'Any', text: 'Sleep is the heaviest lift. Aim 7-9 hours.' },
  ],

  tags: ['functional', 'advanced', 'compound', 'gym', 'olympic'],
  isGymRequired: true,
  isHomeFriendly: false,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 45,
  maxSessionMinutes: 75,
  goalText: 'Bridge raw strength and athletic fluidity.',
};

// ---------- Program 10: Crossfit — The United Frontier ---------------------

const program10 = {
  programCode: 'united_frontier_crossfit',
  programName: 'Crossfit: The United Frontier',
  subHeader: 'General Physical Preparedness for the Modern Patriot',
  overview:
    'CrossFit-style program combining Olympic weightlifting, gymnastics, and high-intensity MetCon. For athletes who thrive on variety and challenge.',
  whatsInside:
    'Heavy Compound + WOD Mondays; Gymnastics + AMRAP Tuesdays; Active Recovery Wednesdays; Olympic + For-Time Thursdays; Hero Grit Chipper Fridays; Saturday Community WODs.',
  isThisForYou: 'CrossFit-style athletes who want benchmarks, leaderboards, and PRs.',
  theGoal: 'Be ready for anything.',
  missionStatement: 'Ready for anything.',
  primaryGoal: 'General Physical Preparedness',
  primaryGoals: ['Strength', 'Endurance', 'General Fitness'],
  workoutSkillLevel: 'Any',
  workoutSkillType: 'CrossFit',
  workoutPreference: 'CROSSFIT',

  durationWeeks: 8,
  frequencyPerWeek: 6,
  avgSessionMinutes: 60,
  frequencyCaption: '4 Days + 1 Community Day + 1 Active Recovery',
  frequency: '6',
  daysPerWeek: '6',

  locationTag: 'Commercial Gym Required',
  equipment: 'Barbell + Bumpers, Pull-up Bar / Rings, KBs, DBs, Wall Ball, Jump Rope, Rower or Bike.',
  equipmentList: ['Barbell + Bumper Plates', 'Pull-up Bar / Gymnastic Rings', 'Kettlebells', 'Dumbbells', 'Wall Ball', 'Jump Rope', 'Concept2 Rower or Echo Bike'],
  equipmentNote: 'Commercial gym / CrossFit affiliate recommended.',
  noEquipmentRequired: false,

  implementationNote:
    'Scoring & Leaderboards required: time, reps/rounds, weight inputs. Track PBs for benchmark workouts. Timer types: AMRAP countdown, For-Time stopwatch, EMOM interval beep.',

  phaseCount: 1,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification: '',
    phases: [mkPhase('General Physical Preparedness', 1, 8, 'Variety + benchmarks', '60-180s')],
  },

  frequencyRules: {
    trainingDaysPerWeek: '5',
    recoveryDaysPerWeek: '1',
    restDaysPerWeek: '1',
    flexibleSchedule: false,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'WOD time / rounds / weight (PB tracking)',
    secondaryMetric: 'Skill milestones (HSPU, double unders)',
    photoCheckIn: false,
    leaderboard: true,
    pbTracker: true,
    habitTracker: false,
  },

  schedule: [weekRow(1, 'A', 'B', 'recovery', 'C', 'D', 'community', 'rest')],

  weekGrid: {
    cadence: cad('A', 'B', 'recovery', 'C', 'D', 'community', 'rest'),
    monday: 'Heavy Compound + "Frontier 21" WOD',
    tuesday: 'Gymnastics Skill + 20-min AMRAP',
    wednesday: 'Active Recovery — 2000m Row + Mobility',
    thursday: 'Olympic Lift + Sprint Finish For Time',
    friday: 'Bench + Endurance Chipper',
    saturday: 'Community Frontier WOD',
  },

  workouts: {
    A: [
      mkExercise('Back Squat', { sets: 5, reps: '5 @ 75-80%', rest: '120s', role: 'Primary Lift', tag: 'Large Muscle', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Thrusters', { sets: 1, reps: '21-15-9 (For Time)', role: 'WOD', notes: 'M 95 lb / W 65 lb', muscles: ['Full Body'] }),
      mkExercise('Pull-ups', { sets: 1, reps: '21-15-9', role: 'WOD', alt: 'Ring Rows', muscles: ['Back', 'Biceps'] }),
      mkExercise('Burpees over Bar', { sets: 1, reps: '21-15-9', role: 'WOD', muscles: ['Full Body'] }),
    ],
    B: [
      mkExercise('HSPU Progressions / Pike Push-ups', { sets: 10, reps: '8 (EMOM 10 min)', role: 'Skill EMOM', muscles: ['Shoulders'] }),
      mkExercise('400m Run', { sets: 1, reps: 'Round (AMRAP 20 min)', role: 'AMRAP', muscles: ['Cardio'] }),
      mkExercise('Box Jumps', { sets: 1, reps: 'Round (AMRAP)', role: 'AMRAP', notes: 'M 24" / W 20"', muscles: ['Quads'] }),
      mkExercise('Kettlebell Swings', { sets: 1, reps: 'Round (AMRAP)', role: 'AMRAP', notes: 'M 53 lb / W 35 lb', muscles: ['Posterior Chain'] }),
      mkExercise('Toes-to-Bar', { sets: 1, reps: 'Round (AMRAP)', role: 'AMRAP', alt: 'Knee-to-Chest', muscles: ['Core'] }),
    ],
    C: [
      mkExercise('Power Clean', { sets: 4, reps: '3 (heavy 3RM)', rest: '180s', role: 'Primary Lift', tag: 'Large Muscle', muscles: ['Full Body'] }),
      mkExercise('Deadlifts', { sets: 5, reps: '8 (For Time)', role: 'WOD', notes: 'M 185 / W 125', muscles: ['Posterior Chain'] }),
      mkExercise('Double Unders', { sets: 5, reps: '30', role: 'WOD', alt: '60 Single Unders', muscles: ['Cardio'] }),
      mkExercise('Wall Ball Shots', { sets: 5, reps: '12', role: 'WOD', notes: 'M 20 / W 14', muscles: ['Quads', 'Shoulders'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({ format: 'Strength + 21-15-9 For Time', restBetweenSets: '120s strength', estDuration: '60-75 min', overload: Array.from({ length: 8 }, (_, i) => mkOverload(i + 1, 5, 5, '120s', 'Back Squat 75-80%')) }),
    B: mkMeta({ format: 'Skill EMOM + 20-min AMRAP', estDuration: '60-75 min', rounds: 'Skill 10 / AMRAP 20', overload: Array.from({ length: 8 }, (_, i) => mkOverload(i + 1, 10, 'EMOM 8', '', 'Build skill rounds')) }),
    C: mkMeta({ format: 'Olympic Build + 5 Rounds For Time', restBetweenSets: '180s primary / 0 WOD', estDuration: '60 min', rounds: '5 (15-min cap)', overload: Array.from({ length: 8 }, (_, i) => mkOverload(i + 1, 4, 3, '180s', 'Build to heavy 3RM')) }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Back Squat', { sets: 5, reps: '5', rest: '120s', role: 'Primary Lift' }),
      mkExercise('Thrusters', { sets: 1, reps: '21-15-9', role: 'WOD' }),
      mkExercise('Pull-ups', { sets: 1, reps: '21-15-9', role: 'WOD' }),
      mkExercise('Burpees over Bar', { sets: 1, reps: '21-15-9', role: 'WOD' }),
    ],
    B: [
      mkExercise('HSPU Progressions', { sets: 10, reps: '8 EMOM', role: 'Skill EMOM' }),
      mkExercise('400m Run', { sets: 1, reps: 'AMRAP round', role: 'AMRAP' }),
      mkExercise('Box Jumps', { sets: 1, reps: 'AMRAP round', role: 'AMRAP' }),
      mkExercise('Kettlebell Swings', { sets: 1, reps: 'AMRAP round', role: 'AMRAP' }),
      mkExercise('Toes-to-Bar', { sets: 1, reps: 'AMRAP round', role: 'AMRAP' }),
    ],
    C: [
      mkExercise('Power Clean', { sets: 4, reps: '3', rest: '180s', role: 'Primary Lift' }),
      mkExercise('Deadlifts', { sets: 5, reps: '8', role: 'WOD' }),
      mkExercise('Double Unders', { sets: 5, reps: '30', role: 'WOD' }),
      mkExercise('Wall Ball Shots', { sets: 5, reps: '12', role: 'WOD' }),
    ],
    D: [
      mkExercise('Bench Press', { sets: 4, reps: '8', rest: '120s', role: 'Primary Lift' }),
      mkExercise('Air Squats', { sets: 1, reps: '50', role: 'Chipper' }),
      mkExercise('Sit-ups', { sets: 1, reps: '40', role: 'Chipper' }),
      mkExercise('Hand-release Push-ups', { sets: 1, reps: '30', role: 'Chipper' }),
      mkExercise('Pull-ups', { sets: 1, reps: '20', role: 'Chipper' }),
      mkExercise('Clean & Jerks', { sets: 1, reps: '10', role: 'Chipper', notes: 'M 135 / W 95' }),
    ],
    community: [
      mkExercise('Community Frontier WOD', { sets: 1, reps: 'Team-based or long-form', role: 'Community', notes: 'Format varies; logged via leaderboard' }),
    ],
  },

  engineSettings: {
    timerTypes: ['AMRAP Countdown', 'Stopwatch (For Time)', 'EMOM Interval'],
    uiFeatures: ['Time / Reps / Weight Inputs', 'PB History', 'Leaderboard'],
  },

  recovery: {
    lissMinutes: 30,
    lissPrompt: 'Wednesday Active Restoration — 2000m row steady + 15 min mobility (ankles + shoulders).',
    lissOptions: 'Rower, Walk',
    stretches: [
      mkStretch('Ankle Mobility'),
      mkStretch('Shoulder Mobility'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 15,
      coachPrompt: 'Wednesday Active Recovery — 2000m row steady pace.',
      activityOptions: ['Rower (2000m)', 'Walk'],
      media_url: '',
    },
    stretches: [
      { name: 'Ankle Mobility — Wall Knee Drives', detail: '10/side' },
      { name: 'Shoulder Mobility — Pass-throughs', detail: '15' },
      { name: 'Hip Flexor Stretch', detail: '60s/side' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'Active Recovery',
      name: 'Wednesday Restoration',
      dayAssignment: 'Wednesday',
      duration: '30 min',
      intensity: 'Low',
      modality: 'Rower + Mobility',
      format: 'Steady + circuit',
      roundsP1: '1',
      items: [
        mkRecoveryItem('2000m Row', '~10 min', 'Cardio'),
        mkRecoveryItem('Ankle Mobility', '5 min', 'Ankles'),
        mkRecoveryItem('Shoulder Mobility', '5 min', 'Shoulders'),
        mkRecoveryItem('Hip Flexor Stretch', '5 min', 'Hips'),
      ],
    }),
    mkRecoveryBlock({
      type: 'Community',
      name: 'Saturday Frontier WOD',
      dayAssignment: 'Saturday',
      duration: '60 min',
      intensity: 'High',
      modality: 'Team-based',
      format: 'Single session',
      roundsP1: '1',
    }),
  ],

  restDayConfig: {
    type: 'Full rest',
    message: 'Sleep + nutrition lock in the gains.',
    deepRecovery: false,
    outdoorActivity: false,
  },

  injuryPrevention: {
    notes: 'Olympic lifts require coaching. Scale to ability. Skill before load.',
    prenatalMode: false,
    weightGuard: false,
    deloadWeeks: false,
  },

  recoveryTips: [
    { day: 'Wednesday', text: 'Active recovery beats lying still — flush the system.' },
  ],

  tags: ['crossfit', 'wod', 'amrap', 'emom', 'benchmark', 'leaderboard'],
  isGymRequired: true,
  isHomeFriendly: false,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 40,
  maxSessionMinutes: 75,
  goalText: 'Be ready for anything — benchmarks, PRs, and athletic capacity.',
};

// ---------- Program 11: 15-Minute Quick Hits -------------------------------

const program11 = {
  programCode: 'express_15_minute',
  programName: '15-Minute Quick Hits',
  subHeader: 'Zero Excuses. Maximum Intent.',
  overview:
    'Break-glass-in-emergency workout library for busy parents, travelers, professionals. High-density 15-min sessions to maintain muscle + metabolism + mental clarity.',
  whatsInside:
    '5 standalone modules: Full Body Ignite, Posterior Power, Upper Body Sculpt, Lower Body Burn, Core & Conditioning. 40s work / 20s rest × 3 Rounds.',
  isThisForYou: 'Anyone short on time — works home, hotel, or gym.',
  theGoal: 'Maintain consistency on the busiest days.',
  missionStatement: 'Zero excuses. Maximum intent.',
  primaryGoal: 'General Fitness, Consistency',
  primaryGoals: ['General Fitness', 'Consistency', 'Maintenance'],
  workoutSkillLevel: 'Any',
  workoutSkillType: 'QUICKIES',
  workoutPreference: 'QUICKIES',

  durationWeeks: 4,
  frequencyPerWeek: 5,
  avgSessionMinutes: 15,
  frequencyCaption: 'Any — standalone library, no fixed schedule',
  frequency: '5',
  daysPerWeek: 'Any',

  locationTag: 'Anywhere (Home, Hotel, Gym)',
  equipment: 'Dumbbells OR Resistance Bands (toggle in app).',
  equipmentList: ['Dumbbells', 'Resistance Bands'],
  equipmentNote: 'Equipment toggle: app shows DB-specific or Band-specific cues.',
  noEquipmentRequired: false,

  implementationNote:
    'Standalone library — not calendar-based. Show prominently on dashboard with high-contrast icon (lightning bolt / stopwatch).',

  phaseCount: 1,
  phaseStructure: {
    transitionTrigger: 'Not phased — library',
    changeNotification: '',
    phases: [mkPhase('Quick Hits', 1, 4, 'Maintain consistency', '20s')],
  },

  frequencyRules: {
    trainingDaysPerWeek: 'Any',
    recoveryDaysPerWeek: 'Any',
    restDaysPerWeek: 'Any',
    flexibleSchedule: true,
    libraryMode: true,
  },

  progressTracking: {
    primaryMetric: 'Total Quick Hits completed per week',
    secondaryMetric: 'Round rep counts per module',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: false,
    habitTracker: true,
  },

  schedule: [weekRow(1, 'A', 'B', 'C', 'D', 'E', 'rest', 'rest')],

  weekGrid: {
    cadence: cad('A', 'B', 'C', 'D', 'E', 'rest', 'rest'),
    note: 'Library mode — user picks any module on any day. Cadence shown is a sample rotation.',
    module1: 'Full Body Ignite',
    module2: 'Posterior Power',
    module3: 'Upper Body Sculpt',
    module4: 'Lower Body Burn',
    module5: 'Core & Conditioning',
  },

  workouts: {
    A: [
      mkExercise('Thrusters', { sets: 3, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle', alt: 'Banded Thruster', muscles: ['Full Body'] }),
      mkExercise('Renegade Rows', { sets: 3, reps: '40s/20s', role: 'Primary Strength', alt: 'Banded Seated Row', muscles: ['Back', 'Core'] }),
      mkExercise('Reverse Lunges', { sets: 3, reps: '40s/20s', role: 'Primary Strength', alt: 'Banded Reverse Lunge', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Push-ups', { sets: 3, reps: '40s/20s', role: 'Primary Strength', alt: 'Band-resisted Push-up', muscles: ['Chest', 'Triceps'] }),
      mkExercise('Mountain Climbers', { sets: 3, reps: '40s/20s', role: 'Conditioning', muscles: ['Core', 'Shoulders'] }),
    ],
    B: [
      mkExercise('Romanian Deadlifts', { sets: 3, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle', alt: 'Banded RDL', muscles: ['Hamstrings', 'Glutes'] }),
      mkExercise('Single-Arm Rows', { sets: 3, reps: '40s/20s', role: 'Primary Strength', alt: 'Banded Row', muscles: ['Back'] }),
      mkExercise('Glute Bridges', { sets: 3, reps: '40s/20s', role: 'Accessory', alt: 'Band-resisted', muscles: ['Glutes'] }),
      mkExercise('Superman Extensions', { sets: 3, reps: '40s/20s', role: 'Accessory', muscles: ['Lower Back'] }),
      mkExercise('Kettlebell Swings', { sets: 3, reps: '40s/20s', role: 'Conditioning', alt: 'DB or Banded Swing', muscles: ['Posterior Chain'] }),
    ],
    C: [
      mkExercise('Overhead Press', { sets: 3, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle', alt: 'Banded OH Press', muscles: ['Shoulders'] }),
      mkExercise('Bicep Curls', { sets: 3, reps: '40s/20s', role: 'Accessory', alt: 'Banded Curl', muscles: ['Biceps'] }),
      mkExercise('Tricep Kickbacks', { sets: 3, reps: '40s/20s', role: 'Accessory', alt: 'Banded Kickback', muscles: ['Triceps'] }),
      mkExercise('Lateral Raises', { sets: 3, reps: '40s/20s', role: 'Accessory', alt: 'Banded Lateral', muscles: ['Shoulders'] }),
      mkExercise('Plank to Push-up', { sets: 3, reps: '40s/20s', role: 'Core', tag: 'Core', muscles: ['Core', 'Chest'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({ format: 'HIIT 40:20 × 3 Rounds', workInterval: '40s', restBetweenSets: '20s', rounds: '3', estDuration: '15 min' }),
    B: mkMeta({ format: 'HIIT 40:20 × 3 Rounds', workInterval: '40s', restBetweenSets: '20s', rounds: '3', estDuration: '15 min' }),
    C: mkMeta({ format: 'HIIT 40:20 × 3 Rounds', workInterval: '40s', restBetweenSets: '20s', rounds: '3', estDuration: '15 min' }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Thrusters', { sets: 3, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Renegade Rows', { sets: 3, reps: '40s/20s', role: 'Primary Strength' }),
      mkExercise('Reverse Lunges', { sets: 3, reps: '40s/20s', role: 'Primary Strength' }),
      mkExercise('Push-ups', { sets: 3, reps: '40s/20s', role: 'Primary Strength' }),
      mkExercise('Mountain Climbers', { sets: 3, reps: '40s/20s', role: 'Conditioning' }),
    ],
    B: [
      mkExercise('Romanian Deadlifts', { sets: 3, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Single-Arm Rows', { sets: 3, reps: '40s/20s', role: 'Primary Strength' }),
      mkExercise('Glute Bridges', { sets: 3, reps: '40s/20s', role: 'Accessory' }),
      mkExercise('Superman Extensions', { sets: 3, reps: '40s/20s', role: 'Accessory' }),
      mkExercise('Kettlebell Swings', { sets: 3, reps: '40s/20s', role: 'Conditioning' }),
    ],
    C: [
      mkExercise('Overhead Press', { sets: 3, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Bicep Curls', { sets: 3, reps: '40s/20s', role: 'Accessory' }),
      mkExercise('Tricep Kickbacks', { sets: 3, reps: '40s/20s', role: 'Accessory' }),
      mkExercise('Lateral Raises', { sets: 3, reps: '40s/20s', role: 'Accessory' }),
      mkExercise('Plank to Push-up', { sets: 3, reps: '40s/20s', role: 'Core', tag: 'Core' }),
    ],
    D: [
      mkExercise('Goblet Squats', { sets: 3, reps: '40s/20s', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Lateral Lunges', { sets: 3, reps: '40s/20s', role: 'Primary Strength' }),
      mkExercise('Split Squats (Right)', { sets: 3, reps: '40s', role: 'Primary Strength' }),
      mkExercise('Split Squats (Left)', { sets: 3, reps: '40s', role: 'Primary Strength' }),
      mkExercise('Jump Squats', { sets: 3, reps: '40s/20s', role: 'Power', alt: 'Air Squats (low impact)' }),
    ],
    E: [
      mkExercise('Dumbbell Snatches', { sets: 3, reps: '40s/20s', role: 'Power', alt: 'Banded Woodchopper' }),
      mkExercise('Bicycle Crunches', { sets: 3, reps: '40s/20s', role: 'Core', tag: 'Core' }),
      mkExercise('Burpees', { sets: 3, reps: '40s/20s', role: 'Conditioning', alt: 'Step-back Burpees' }),
      mkExercise('Russian Twists', { sets: 3, reps: '40s/20s', role: 'Core', tag: 'Core' }),
      mkExercise('High Knees', { sets: 3, reps: '40s/20s', role: 'Conditioning' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Interval Timer 40:20', 'Round Counter'],
    uiFeatures: ['Library Picker', 'Equipment Toggle (DB / Bands)', 'Lightning-bolt Dashboard Icon'],
  },

  recovery: {
    lissMinutes: 0,
    lissPrompt: 'The Quick Hit itself lowers cortisol and provides mental reset.',
    lissOptions: 'Walk after the session if you can',
    stretches: [],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 0,
      coachPrompt: 'No dedicated recovery — the Quick Hit is the recovery from a chaotic day.',
      activityOptions: ['Optional 10 min walk after'],
      media_url: '',
    },
    stretches: [
      { name: 'Optional cool-down stretches', detail: 'Pick 2-3 stretches that target what you just trained' },
    ],
  },

  recoveryBlocks: [],

  restDayConfig: {
    type: 'Active recovery / off-day',
    message: 'Take a walk; come back fresh.',
    deepRecovery: false,
    outdoorActivity: true,
  },

  injuryPrevention: {
    notes: 'High density on short clock — keep form sharp, scale weights down if rushed.',
    prenatalMode: false,
    weightGuard: false,
    deloadWeeks: false,
  },

  recoveryTips: [
    { day: 'Any', text: 'A 15-min Quick Hit lowers cortisol — that "Win" feeling is real recovery.' },
  ],

  tags: ['quickies', 'express', 'short-workout', 'anywhere', 'library'],
  isGymRequired: false,
  isHomeFriendly: true,
  isQuickProgram: true,
  isPrenatalProgram: false,
  minSessionMinutes: 15,
  maxSessionMinutes: 15,
  goalText: 'Maintain consistency in 15 minutes — anywhere, anytime.',
};

// ---------- Program 12: Prenatal — The Radiant Forge -----------------------

const program12 = {
  programCode: 'radiant_forge_prenatal',
  programName: 'Prenatal: The Radiant Forge',
  subHeader: 'Strength for Two: A Guided Path through Pregnancy and Beyond',
  overview:
    'Three-phase prenatal program supporting users from positive test through final weeks. Focus on functional strength for changing center of gravity, pelvic floor health, and mindful recovery.',
  whatsInside:
    'Phase 1 (Wks 1-12): maintain baseline. Phase 2 (Wks 13-27): postural strength. Phase 3 (Wks 28-40): labor-ready mobility + functional comfort.',
  isThisForYou: 'Pregnant users seeking safe, effective movement through all trimesters.',
  theGoal: 'Stay strong, mobile, and confident through pregnancy and into postpartum.',
  missionStatement: 'Strength for two.',
  primaryGoal: 'Prenatal / Postpartum Fitness',
  primaryGoals: ['Prenatal', 'Postpartum', 'Safety'],
  workoutSkillLevel: 'Beg / Int',
  workoutSkillType: 'Prenatal / Postpartum',
  workoutPreference: 'PRENATAL/POSTPARTUM',

  durationWeeks: 40,
  frequencyPerWeek: 6,
  avgSessionMinutes: 35,
  frequencyCaption: '4 strength + 1 mobility + 1 outdoor + 1 rest',
  frequency: '6',
  daysPerWeek: '6',

  locationTag: 'Home Friendly',
  equipment: 'Light-to-moderate Dumbbells, sturdy chair/bench, optional bands, yoga mat.',
  equipmentList: ['Dumbbells (light-moderate)', 'Chair/Bench', 'Resistance Bands (optional)', 'Yoga Mat'],
  equipmentNote: 'Home setup is sufficient. Trap bar / lat pulldown if available for Phase 3.',
  noEquipmentRequired: false,

  implementationNote:
    'Safety logic: Supine alternatives in Phase 2 & 3, Phase auto-switch by due date (week 13 / 28), Dumbbell swap option for all Barbell movements, Rest timers +30s in Phase 3, daily diaphragmatic breathing prompt.',

  phaseCount: 3,
  phaseStructure: {
    transitionTrigger: "Auto-switch by user's Due Date input",
    changeNotification:
      'Welcome to the next phase — your body has changed and so has the protocol. Safety alternatives are now active.',
    phases: [
      mkPhase('Phase 1: First Trimester', 1, 12, 'Maintain baseline; establish breath-to-core', '90s'),
      mkPhase('Phase 2: Second Trimester', 13, 27, 'Postural strength + pelvic stability', '90-120s'),
      mkPhase('Phase 3: Third Trimester', 28, 40, 'Labor-ready mobility + functional comfort', '120-150s (+30s vs P1)'),
    ],
  },

  frequencyRules: {
    trainingDaysPerWeek: '4',
    recoveryDaysPerWeek: '2',
    restDaysPerWeek: '1',
    flexibleSchedule: true,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'RPE 6-7 adherence (conversation pace)',
    secondaryMetric: 'Diaphragmatic breathing daily check-in',
    photoCheckIn: false,
    leaderboard: false,
    pbTracker: false,
    habitTracker: true,
  },

  schedule: [weekRow(1, 'A', 'B', 'recovery', 'C', 'D', 'outdoor', 'rest')],

  weekGrid: {
    cadence: cad('A', 'B', 'recovery', 'C', 'D', 'outdoor', 'rest'),
    monday: 'Lower Body Strength',
    tuesday: 'Upper Body Strength',
    wednesday: 'Recover & Flow',
    thursday: 'Full Body Power',
    friday: 'Core & Cardio',
    saturday: 'Unite & Venture (outdoor)',
    sunday: 'Deep Rest',
  },

  workouts: {
    A: [
      mkExercise('Barbell or DB Back Squat', { sets: 4, reps: '8-10', rest: '90s', role: 'Primary Lift', tag: 'Large Muscle', alt: 'Box Squat (P2) / Sumo DB Squat (P3)', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Weighted Walking Lunges', { sets: 3, reps: '20 steps', role: 'Accessory', alt: 'Step-ups (P2) / Low Box Step-ups (P3)', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Kettlebell Swings', { sets: 3, reps: '15', role: 'Power', alt: 'Glute Bridges (P2) / Banded Monster Walks (P3)', muscles: ['Posterior Chain'] }),
      mkExercise('Wall Sit', { sets: 3, reps: '45s', role: 'Conditioning', alt: 'Farmer Carry (P2) / Supported Deep Squat Hold (P3)', muscles: ['Quads'] }),
    ],
    B: [
      mkExercise('Seated DB Overhead Press', { sets: 4, reps: '10', role: 'Primary Strength', tag: 'Large Muscle', alt: 'Arnold Press (P2) / Incline DB Chest Press (P3)', muscles: ['Shoulders'] }),
      mkExercise('DB Single Arm Row', { sets: 4, reps: '10/side', role: 'Primary Strength', alt: 'Lat Pulldown (P2) / Seated Cable Row (P3)', muscles: ['Back'] }),
      mkExercise('Incline Push-ups', { sets: 3, reps: '12', role: 'Accessory', alt: 'Bench Dips (P2) / Wall Push-ups (P3)', muscles: ['Chest'] }),
      mkExercise('Face Pulls', { sets: 3, reps: '15', role: 'Accessory', alt: 'High-to-Low Cable Rows (P3)', muscles: ['Rear Delts'] }),
      mkExercise('Battle Ropes', { sets: 3, reps: '45s', role: 'Conditioning', alt: 'Hammer Curls (P3)', muscles: ['Cardio'] }),
    ],
    C: [
      mkExercise('Conventional Deadlift', { sets: 4, reps: '8', rest: '120s', role: 'Primary Lift', tag: 'Large Muscle', alt: 'Sumo Deadlift (P2) / Elevated Trap Bar Deadlift (P3)', muscles: ['Posterior Chain'] }),
      mkExercise('DB Thrusters', { sets: 3, reps: '12', role: 'Power', alt: 'KB Swings (P2) / DB Suitcase Squats (P3)', muscles: ['Full Body'] }),
      mkExercise('Renegade Rows', { sets: 3, reps: '10 total', role: 'Power', alt: 'DB Snatch (P2) / Seated Lat Pulldown (P3)', muscles: ['Back', 'Core'] }),
      mkExercise('Box Step-ups', { sets: 3, reps: '12 total', role: 'Power', alt: 'DB Suitcase Carry (P2) / Standing Wall Sit 45s (P3)', muscles: ['Quads'] }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({
      format: 'Lower Body — Squat & Lunge for Pelvic Support',
      restBetweenSets: '90s (P1) / 90s (P2) / 120s (P3)',
      estDuration: '35 min',
      overload: [
        mkOverload(1, 4, '8-10', '90s', 'Phase 1 baseline'),
        mkOverload(13, 4, '10', '90s', 'Phase 2 — box squat swap'),
        mkOverload(28, 4, '10', '120s', 'Phase 3 — labor prep, +30s rest'),
      ],
    }),
    B: mkMeta({
      format: 'Upper Body — Push/Pull for Posture',
      restBetweenSets: '90s (P1) / 90s (P2) / 120s (P3)',
      estDuration: '35 min',
      overload: [
        mkOverload(1, 4, '10', '90s'),
        mkOverload(13, 4, '10-12', '90s'),
        mkOverload(28, 4, '10-12', '120s'),
      ],
    }),
    C: mkMeta({
      format: 'Full Body Power — Functional Conditioning',
      restBetweenSets: '120s (P1) / 120s (P2) / 150s (P3)',
      estDuration: '35 min',
      overload: [
        mkOverload(1, 4, '8', '120s'),
        mkOverload(13, 4, '8', '120s'),
        mkOverload(28, 4, '8', '150s'),
      ],
    }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Back Squat (P1) / Box Squat (P2) / Sumo DB Squat (P3)', { sets: 4, reps: '8-10', rest: '90s', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('Walking Lunges (P1) / Step-ups (P2) / Low Box Step-ups (P3)', { sets: 3, reps: '20 steps', role: 'Accessory' }),
      mkExercise('KB Swings (P1) / Glute Bridges (P2) / Monster Walks (P3)', { sets: 3, reps: '15', role: 'Power' }),
      mkExercise('Wall Sit (P1) / Farmer Carry (P2) / Supported Deep Squat Hold (P3)', { sets: 3, reps: '45s / 40m / 60s', role: 'Conditioning' }),
    ],
    B: [
      mkExercise('Seated DB OH Press (P1) / Arnold Press (P2) / Incline DB Press (P3)', { sets: 4, reps: '10', role: 'Primary Strength', tag: 'Large Muscle' }),
      mkExercise('DB Single Arm Row (P1) / Lat Pulldown (P2) / Seated Cable Row (P3)', { sets: 4, reps: '10-12/side', role: 'Primary Strength' }),
      mkExercise('Incline Push-ups (P1) / Bench Dips (P2) / Wall Push-ups (P3)', { sets: 3, reps: '12-15', role: 'Accessory' }),
      mkExercise('Face Pulls (P1) / Assisted Pull-ups (P2) / High-to-Low Rows (P3)', { sets: 3, reps: '15', role: 'Accessory' }),
      mkExercise('Battle Ropes / Hammer Curls (P3)', { sets: 3, reps: '45s / 12', role: 'Conditioning' }),
    ],
    C: [
      mkExercise('Deadlift (P1) / Sumo DL (P2) / Trap Bar DL (P3)', { sets: 4, reps: '8', rest: '120-150s', role: 'Primary Lift', tag: 'Large Muscle' }),
      mkExercise('DB Thrusters (P1) / KB Swings (P2) / DB Suitcase Squats (P3)', { sets: 3, reps: '12-15', role: 'Power' }),
      mkExercise('Renegade Rows (P1) / DB Snatch (P2) / Seated Lat Pulldown (P3)', { sets: 3, reps: '10-15', role: 'Power' }),
      mkExercise('Box Step-ups (P1) / DB Suitcase Carry (P2) / Standing Wall Sit (P3)', { sets: 3, reps: '12 / 40m / 45s', role: 'Power' }),
    ],
    D: [
      mkExercise('25 min Moderate Cardio (P1) / 30 min LISS Nasal (P2) / 30 min Brisk Walk (P3)', { sets: 1, reps: 'Time per phase', role: 'Cardio', tag: 'Cardio' }),
      mkExercise('Pallof Press (P1) / Side Plank (P2) / Standing Pallof Press (P3)', { sets: 3, reps: '12/side or 30s/side', role: 'Core', tag: 'Core' }),
      mkExercise('Deadbugs (P1) / Bird-Dog Slow (P2) / Modified Bird-Dog with Bench (P3)', { sets: 3, reps: '12-16 total', role: 'Core', tag: 'Core' }),
      mkExercise('Forearm Plank (P1) / Bear Crawl (P2) / Pelvic Tilts (P3)', { sets: 3, reps: '45s / 30s / 15', role: 'Core', tag: 'Core' }),
    ],
    outdoor: [
      mkExercise('Outdoor Walk / Community Walk', { sets: 1, reps: '30-60 min', role: 'Outdoor' }),
    ],
  },

  page2: {
    phaseName: 'Phase 2 — Second Trimester (Weeks 13-27)',
    safetySwaps: [
      'Box Squat replaces Back Squat — anti-pressure',
      'Standing Arnold Press for shoulder posture',
      'Sumo Deadlift narrower stance',
    ],
  },

  page3: {
    phaseName: 'Phase 3 — Third Trimester (Weeks 28-40)',
    safetySwaps: [
      'Sumo DB Squat replaces barbell',
      'Incline DB Chest Press replaces flat',
      'Elevated Trap Bar Deadlift reduces ROM',
      'Wall Push-ups instead of floor push-ups',
      'All rest timers auto-increased by 30s',
    ],
  },

  engineSettings: {
    timerTypes: ['Standard Set/Rest (auto +30s in P3)', 'Daily Breathing Prompt'],
    uiFeatures: ['Phase Auto-Switch by Due Date', 'Supine Alternative Auto-Swap', 'RPE 6-7 Slider', 'Diaphragmatic Breathing Reminder'],
  },

  recovery: {
    lissMinutes: 25,
    lissPrompt: '25-30 min nasal-breathing cardio. Outdoor walks Saturday.',
    lissOptions: 'Rower, Incline Walk, Outdoor Walk',
    stretches: [
      mkStretch('Cat-Cow', '60s • Spine'),
      mkStretch('Adductor Rock-backs', '60s • Hips'),
      mkStretch("Child's Pose (Wide knee)", '60s • Hip flexors / back'),
      mkStretch('Seated Side Stretch', '60s • Lateral'),
      mkStretch('Deep Squat Breathing', '60s • Pelvic floor'),
    ],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 25,
      coachPrompt: 'Recover Wednesday with the Prenatal Flow — gentle mobility + pelvic breathing.',
      activityOptions: ['Rower', 'Incline Walk', 'Outdoor Walk'],
      media_url: '',
    },
    stretches: [
      { name: 'Cat-Cow', detail: '60s • Spine' },
      { name: 'Adductor Rock-backs', detail: '60s • Hips' },
      { name: "Child's Pose (Wide knee)", detail: '60s • Hip flexors / back' },
      { name: 'Seated Side Stretch', detail: '60s • Lateral' },
      { name: 'Deep Squat Breathing', detail: '60s • Pelvic floor' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'Mobility Flow',
      name: 'Prenatal Flow (All Trimesters)',
      dayAssignment: 'Wednesday',
      duration: '10 min',
      intensity: 'Low',
      modality: 'Mat',
      format: 'Single circuit',
      roundsP1: '2',
      items: [
        mkRecoveryItem('Cat-Cow', '60s', 'Spine'),
        mkRecoveryItem('Adductor Rock-backs', '60s', 'Hips'),
        mkRecoveryItem("Child's Pose", '60s', 'Back'),
        mkRecoveryItem('Seated Side Stretch', '60s', 'Lateral'),
        mkRecoveryItem('Deep Squat Breathing', '60s', 'Pelvic floor'),
      ],
    }),
    mkRecoveryBlock({
      type: 'Outdoor',
      name: 'Saturday Walk',
      dayAssignment: 'Saturday',
      duration: '30-60 min',
      intensity: 'Low',
      modality: 'Outdoor Walk',
      format: 'Single session',
      roundsP1: '1',
    }),
  ],

  restDayConfig: {
    type: 'Full rest / nervous system care',
    message: 'Sleep, hydrate, prepare for the week. Your body is doing the heaviest work.',
    deepRecovery: true,
    outdoorActivity: false,
  },

  injuryPrevention: {
    notes: 'RPE 6-7 ceiling. Supine swap auto-applied P2+. Always listen to your body first.',
    prenatalMode: true,
    weightGuard: true,
    deloadWeeks: true,
  },

  recoveryTips: [
    { day: 'Daily', text: 'Diaphragmatic breathing — prevents diastasis recti and preps for birth.' },
    { day: 'Wednesday', text: 'Pelvic floor day. Don\'t skip — it shortens recovery after birth.' },
  ],

  tags: ['prenatal', 'postpartum', 'safety', 'mobility', '3-phase'],
  isGymRequired: false,
  isHomeFriendly: true,
  isQuickProgram: false,
  isPrenatalProgram: true,
  minSessionMinutes: 20,
  maxSessionMinutes: 45,
  goalText: 'Strong, mobile, confident through pregnancy and into postpartum.',
};

// ---------- Program 13: 12-Week Shred to Stage -----------------------------

const program13 = {
  programCode: 'shred_to_stage_12_week',
  programName: '12-Week Shred to Stage',
  subHeader: 'Precision Sculpting. Athlete-Grade Discipline.',
  overview:
    'Premier physique transformation program. Mirrors stage-prep protocols. Prioritizes muscle retention while driving body fat down with evidence-based hypertrophy.',
  whatsInside:
    'Three 4-week phases: Foundation (Wks 1-4), Hardening (Wks 5-8), Reveal (Wks 9-12). 5 lift days + daily cardio + LISS Saturdays.',
  isThisForYou: 'Intermediate-to-advanced athletes preparing for a stage, shoot, or peak physique.',
  theGoal: 'Stage-ready conditioning with maximum muscle retention.',
  missionStatement: "The stage isn't where the work is done; it's just where the work is shown.",
  primaryGoal: 'Strength, Weight Loss',
  primaryGoals: ['Physique', 'Weight Loss', 'Muscle Retention'],
  workoutSkillLevel: 'Intermediate / Advanced',
  workoutSkillType: 'Weight Lifting',
  workoutPreference: 'Weight Lifting',

  durationWeeks: 12,
  frequencyPerWeek: 6,
  avgSessionMinutes: 75,
  frequencyCaption: '5-6 Days/Week + Daily Cardio',
  frequency: '6',
  daysPerWeek: '6',

  locationTag: 'Commercial Gym Required',
  equipment: 'Full barbell rack, dumbbells, cables, leg machines, dips/pull-up station, EZ-curl bar.',
  equipmentList: ['Barbell Set (Rack, Bench, Platform)', 'Dumbbells (heavy)', 'Cable Machine', 'Adjustable Bench', 'Leg Press', 'Leg Curl/Extension', 'Dips/Pull-up Station', 'EZ-Curl Bar'],
  equipmentNote: 'Commercial gym required.',
  noEquipmentRequired: false,

  implementationNote:
    'Mandatory daily cardio (incline walk / stairclimber) at end of each training day: P1 20m, P2 30m@8-10% incline, P3 45m@10-15% incline. Volume Tracker = Sets × Reps × Weight. Monday photo check-in.',

  phaseCount: 3,
  phaseStructure: {
    transitionTrigger: 'At week number (fixed)',
    changeNotification:
      "Phase complete. Cardio increases and intensity multipliers turn on. Lock in.",
    phases: [
      mkPhase('The Foundation', 1, 4, 'Build volume baseline; 20 min incline cardio', '60-90s'),
      mkPhase('The Hardening', 5, 8, 'Intensity multipliers; 30 min cardio @ 8-10% incline', '60-90s'),
      mkPhase('The Reveal', 9, 12, 'Peak detail; supersets; 45 min cardio @ 10-15% incline', '45-60s'),
    ],
  },

  frequencyRules: {
    trainingDaysPerWeek: '5',
    recoveryDaysPerWeek: '1',
    restDaysPerWeek: '1',
    flexibleSchedule: false,
    libraryMode: false,
  },

  progressTracking: {
    primaryMetric: 'Total Workload (sets × reps × weight) per session',
    secondaryMetric: 'Weekly photo check-in (Monday morning)',
    photoCheckIn: true,
    leaderboard: false,
    pbTracker: true,
    habitTracker: true,
  },

  schedule: [weekRow(1, 'A', 'B', 'C', 'D', 'E', 'recovery', 'rest')],

  weekGrid: {
    cadence: cad('A', 'B', 'C', 'D', 'E', 'recovery', 'rest'),
    monday: 'Chest & Triceps',
    tuesday: 'Back & Biceps',
    wednesday: 'Lower Body — Quads',
    thursday: 'Shoulders & Traps',
    friday: 'Lower Body — Hams/Glutes',
    saturday: 'LISS Cardio (60 min Zone 2)',
    sunday: 'Rest (Wks 1-8) / 45 min Zone 3 Cardio (Wks 9-12)',
  },

  workouts: {
    A: [
      mkExercise('Incline Barbell Bench Press', { sets: 4, reps: '8-10 (P1) / 8-10 (P2) / Incline DB SS (P3)', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Upper Chest'] }),
      mkExercise('Flat Dumbbell Bench Press', { sets: 3, reps: '10-12', role: 'Primary Strength', muscles: ['Chest'] }),
      mkExercise('Weighted Dips / Machine Press (P2) / Bodyweight Dips (P3)', { sets: 3, reps: '10-12 / To Failure', role: 'Primary Strength', muscles: ['Chest', 'Triceps'] }),
      mkExercise('Low-to-High Cable Flyes / Cable Crossovers (P3)', { sets: 3, reps: '15-20', role: 'Accessory', muscles: ['Chest'] }),
      mkExercise('Rope Cable Pressdowns', { sets: 4, reps: '12-15', role: 'Accessory', muscles: ['Triceps'] }),
      mkExercise('Overhead Dumbbell Extension', { sets: 3, reps: '10-12', role: 'Accessory', muscles: ['Triceps'] }),
      mkExercise('Cardio Finisher: Incline Walk / Stairclimber', { sets: 1, reps: 'P1 20m / P2 30m@8-10% / P3 45m@10-15%', role: 'Cardio', tag: 'Cardio', muscles: ['Cardio'] }),
    ],
    B: [
      mkExercise('Wide Grip Lat Pulldowns / Weighted Pull-Ups (P2) / Close-Grip SS (P3)', { sets: 4, reps: '8-10 / 10-12', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Back'] }),
      mkExercise('Bent Over Barbell Rows / T-Bar Rows (P2) / Seated Row SS (P3)', { sets: 4, reps: '8-10 / 12', role: 'Primary Strength', muscles: ['Back', 'Biceps'] }),
      mkExercise('Single-Arm Dumbbell Rows', { sets: 3, reps: '10-12/side', role: 'Primary Strength', muscles: ['Back'] }),
      mkExercise('Straight-Arm Cable Pulldowns', { sets: 3, reps: '15', role: 'Accessory', muscles: ['Lats'] }),
      mkExercise('EZ-Bar / Incline DB / Concentration Curls (P3)', { sets: 3, reps: '10-15', role: 'Accessory', muscles: ['Biceps'] }),
      mkExercise('Hammer Curls', { sets: 3, reps: '12-15', role: 'Accessory', muscles: ['Brachialis'] }),
      mkExercise('Cardio Finisher', { sets: 1, reps: 'P1 20m / P2 30m / P3 45m', role: 'Cardio', tag: 'Cardio' }),
    ],
    C: [
      mkExercise('Barbell Back Squats / Hack Squats (P2) / Leg Press constant tension (P3)', { sets: 4, reps: '8-10 (P1) / 6-8 (P2) / 15-20 (P3)', role: 'Large Muscle', tag: 'Large Muscle', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Leg Press Narrow / Hack Squats / Walking Lunges (P3)', { sets: 3, reps: '10-12 / 20 total', role: 'Primary Strength', muscles: ['Quads'] }),
      mkExercise('Walking Weighted Lunges / Bulgarian Split Squats (P2)', { sets: 3, reps: '10-12/leg', role: 'Primary Strength', muscles: ['Quads', 'Glutes'] }),
      mkExercise('Leg Extensions', { sets: 3, reps: '15-20', role: 'Accessory', muscles: ['Quads'] }),
      mkExercise('Goblet Squats / Sissy Squats (P2&P3)', { sets: 3, reps: '12-15 / To Failure', role: 'Accessory', muscles: ['Quads'] }),
      mkExercise('Standing Calf Raises', { sets: 4, reps: '15-20', role: 'Accessory', muscles: ['Calves'] }),
      mkExercise('Cardio Finisher', { sets: 1, reps: 'P1 20m / P2 30m / P3 45m', role: 'Cardio', tag: 'Cardio' }),
    ],
  },

  workoutsMeta: {
    A: mkMeta({ format: 'Chest & Triceps + Cardio Finisher', restBetweenSets: '60-90s (P1-P2) / 45-60s (P3 supersets)', estDuration: '75 min', overload: [
      mkOverload(1, 4, '8-10', '60-90s', 'Foundation'),
      mkOverload(5, 4, '8-10', '60-90s', 'Hardening — intensity multipliers'),
      mkOverload(9, 4, '10-12 superset', '45-60s', 'Reveal — supersets'),
    ] }),
    B: mkMeta({ format: 'Back & Biceps + Cardio Finisher', restBetweenSets: '60-90s / 45-60s (P3)', estDuration: '75 min', overload: [
      mkOverload(1, 4, '8-10', '60-90s'),
      mkOverload(5, 4, '8-10', '60-90s'),
      mkOverload(9, 4, '10-12 superset', '45-60s'),
    ] }),
    C: mkMeta({ format: 'Lower Body (Quads) + Cardio Finisher', restBetweenSets: '60-120s / 45-60s (P3)', estDuration: '75 min', overload: [
      mkOverload(1, 4, '8-10', '90-120s'),
      mkOverload(5, 4, '6-8', '90-120s'),
      mkOverload(9, 4, '15-20 (constant tension)', '45-60s'),
    ] }),
  },

  exerciseLibrary: {
    A: [
      mkExercise('Incline Barbell Bench Press', { sets: 4, reps: '8-10', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Flat Dumbbell Bench Press', { sets: 3, reps: '10-12', role: 'Primary Strength' }),
      mkExercise('Weighted Dips', { sets: 3, reps: '10-12', role: 'Primary Strength' }),
      mkExercise('Low-to-High Cable Flyes', { sets: 3, reps: '15', role: 'Accessory' }),
      mkExercise('Rope Cable Pressdowns', { sets: 4, reps: '12-15', role: 'Accessory' }),
      mkExercise('Overhead DB Extension', { sets: 3, reps: '10-12', role: 'Accessory' }),
      mkExercise('Cardio Finisher (Incline Walk)', { sets: 1, reps: '20-45 min by phase', role: 'Cardio', tag: 'Cardio' }),
    ],
    B: [
      mkExercise('Wide Grip Lat Pulldowns', { sets: 4, reps: '8-10', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Bent Over Barbell Rows', { sets: 4, reps: '8-10', role: 'Primary Strength' }),
      mkExercise('Single-Arm DB Rows', { sets: 3, reps: '12/side', role: 'Primary Strength' }),
      mkExercise('Seated Cable Rows', { sets: 3, reps: '12-15', role: 'Accessory' }),
      mkExercise('Straight-Arm Cable Pulldowns', { sets: 3, reps: '15', role: 'Accessory' }),
      mkExercise('Standing Alternating DB Curls', { sets: 4, reps: '10-12/side', role: 'Accessory' }),
      mkExercise('EZ-Bar Preacher Curls', { sets: 3, reps: '12', role: 'Accessory' }),
      mkExercise('Hammer Curls', { sets: 3, reps: '12-15', role: 'Accessory' }),
      mkExercise('Cardio Finisher', { sets: 1, reps: '20-45 min by phase', role: 'Cardio', tag: 'Cardio' }),
    ],
    C: [
      mkExercise('Barbell Back Squats', { sets: 4, reps: '8-10', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Leg Press Narrow Stance', { sets: 3, reps: '10-12', role: 'Primary Strength' }),
      mkExercise('Walking Weighted Lunges', { sets: 3, reps: '12/leg', role: 'Primary Strength' }),
      mkExercise('Leg Extensions', { sets: 3, reps: '15', role: 'Accessory' }),
      mkExercise('Goblet Squats', { sets: 3, reps: '12-15', role: 'Accessory' }),
      mkExercise('Standing Calf Raises', { sets: 4, reps: '15-20', role: 'Accessory' }),
      mkExercise('Seated Calf Raises', { sets: 3, reps: '15-20', role: 'Accessory' }),
      mkExercise('Cardio Finisher', { sets: 1, reps: '20-45 min by phase', role: 'Cardio', tag: 'Cardio' }),
    ],
    D: [
      mkExercise('Seated Overhead Barbell Press', { sets: 4, reps: '8-10', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Standing DB Lateral Raises', { sets: 4, reps: '12-15', role: 'Primary Strength' }),
      mkExercise('Upright Rows', { sets: 3, reps: '12', role: 'Accessory' }),
      mkExercise('Bent-Over Rear Delt Flyes', { sets: 3, reps: '15', role: 'Accessory' }),
      mkExercise('Face Pulls', { sets: 3, reps: '15-20', role: 'Accessory' }),
      mkExercise('Dumbbell Shrugs', { sets: 4, reps: '12-15 (2s hold)', role: 'Accessory' }),
      mkExercise('Barbell Shrugs', { sets: 3, reps: '12-15', role: 'Accessory' }),
      mkExercise('Cardio Finisher', { sets: 1, reps: '20-45 min by phase', role: 'Cardio', tag: 'Cardio' }),
    ],
    E: [
      mkExercise('Romanian Deadlifts', { sets: 4, reps: '8-10', role: 'Large Muscle', tag: 'Large Muscle' }),
      mkExercise('Barbell Hip Thrusts', { sets: 4, reps: '10-12 (1s hold)', role: 'Primary Strength' }),
      mkExercise('Lying Leg Curls', { sets: 3, reps: '12-15', role: 'Accessory' }),
      mkExercise('Seated Leg Curls', { sets: 3, reps: '12-15', role: 'Accessory' }),
      mkExercise('Back Hyperextensions', { sets: 3, reps: '15', role: 'Accessory' }),
      mkExercise('Cable Pull-Throughs', { sets: 3, reps: '15', role: 'Accessory' }),
      mkExercise('Abductor Machine', { sets: 3, reps: '20', role: 'Accessory' }),
      mkExercise('Cardio Finisher', { sets: 1, reps: '20-45 min by phase', role: 'Cardio', tag: 'Cardio' }),
    ],
  },

  engineSettings: {
    timerTypes: ['Standard Set/Rest', 'Cardio Finisher Timer', 'Photo Check-in Reminder'],
    uiFeatures: ['Total Workload Display', 'Monday Photo Upload', 'Phase Cardio Auto-Increase'],
  },

  recovery: {
    lissMinutes: 60,
    lissPrompt: 'Saturday — 60 min LISS Zone 2 (conversational pace). Sunday Wks 9-12 — 45 min Zone 3.',
    lissOptions: 'Incline Walk, Stairclimber, Bike',
    stretches: [],
    mediaUrls: [],
  },

  recoveryProtocol: {
    cardio: {
      durationMinutes: 60,
      coachPrompt: 'Saturday LISS — 60 minutes at conversational Zone 2 pace.',
      activityOptions: ['Incline Walk', 'Stairclimber', 'Easy Bike'],
      media_url: '',
    },
    stretches: [
      { name: 'Full-Body Stretch Routine', detail: '10-15 minutes after Saturday LISS' },
      { name: 'Foam Roll Quads/Hams/Lats', detail: '60s each muscle group' },
    ],
  },

  recoveryBlocks: [
    mkRecoveryBlock({
      type: 'LISS Cardio',
      name: 'Saturday Zone 2',
      dayAssignment: 'Saturday',
      duration: '60 min',
      intensity: 'Zone 2 (conversational)',
      modality: 'Incline Walk / Stair / Bike',
      format: 'Steady state',
      roundsP1: '1',
    }),
    mkRecoveryBlock({
      type: 'Steady State',
      name: 'Sunday Reveal Phase Cardio',
      dayAssignment: 'Sunday (Wks 9-12 only)',
      duration: '45 min',
      intensity: 'Zone 3',
      modality: 'Incline Walk / Stair',
      format: 'Steady state',
      roundsP2: '1',
    }),
  ],

  restDayConfig: {
    type: 'Wks 1-8: Total Rest. Wks 9-12: 45 min Zone 3 cardio.',
    message: 'Recovery is the multiplier on muscle retention.',
    deepRecovery: true,
    outdoorActivity: false,
  },

  injuryPrevention: {
    notes: 'High volume demands strict form and adequate recovery. Strategic deload weeks recommended (configurable).',
    prenatalMode: false,
    weightGuard: true,
    deloadWeeks: true,
  },

  recoveryTips: [
    { day: 'Saturday', text: 'Zone 2 mobilizes fat without burning muscle — your secret weapon.' },
    { day: 'Sunday', text: 'Wks 9-12: Zone 3 cardio cuts the last layer. Eat enough to keep muscle.' },
  ],

  tags: ['physique', 'advanced', 'bodybuilding', 'stage-prep', '3-phase'],
  isGymRequired: true,
  isHomeFriendly: false,
  isQuickProgram: false,
  isPrenatalProgram: false,
  minSessionMinutes: 60,
  maxSessionMinutes: 100,
  goalText: 'Stage-ready conditioning with maximum muscle retention.',
};

// ---------- All programs aggregated ---------------------------------------

const ALL_PROGRAMS = [
  program1,
  program2,
  program3,
  program4,
  program5,
  program6,
  program7,
  program8,
  program9,
  program10,
  program11,
  program12,
  program13,
];

// ---------- Upsert runner -------------------------------------------------

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI missing in environment');

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 15000,
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  let upserted = 0;
  let inserted = 0;
  let modified = 0;

  for (const p of ALL_PROGRAMS) {
    // Ensure baseline fields and avoid orphaning the old isDeleted flag.
    const doc = {
      ...p,
      status: 'Active',
      isDeleted: false,
      deletedAt: null,
    };

    const result = await Program.updateOne(
      { programCode: p.programCode },
      { $set: doc },
      { upsert: true }
    );
    if (result.upsertedCount) {
      inserted += 1;
      upserted += 1;
    } else if (result.modifiedCount) {
      modified += 1;
      upserted += 1;
    }
    console.log(
      `[${p.programCode.padEnd(34)}] inserted=${result.upsertedCount || 0} modified=${result.modifiedCount || 0}`
    );
  }

  const totalActive = await Program.countDocuments({
    programCode: { $in: ALL_PROGRAMS.map((p) => p.programCode) },
    status: { $ne: 'Deleted' },
    isDeleted: { $ne: true },
  });

  console.log('--------------------------------------------------------------');
  console.log(`Seed complete. Inserted: ${inserted}, Modified: ${modified}, Total written: ${upserted}.`);
  console.log(`Total ACTIVE tracked programs in DB: ${totalActive} / ${ALL_PROGRAMS.length}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Seed failed:', err.message);
  console.error(err.stack);
  try {
    await mongoose.disconnect();
  } catch (_) { /* ignore */ }
  process.exit(1);
});
