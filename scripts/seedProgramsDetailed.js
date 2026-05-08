require('dotenv').config();
const mongoose = require('mongoose');
const Program = require('../modules/model/programModel');

const detailedPrograms = [
  {
    programCode: 'foundations_28_day',
    subHeader: 'Build your base. Master the moves. Start your journey.',
    overview:
      '4-week beginner block with 3 strength days and 2 active recovery days. Progressive overload by increasing sets/reps weekly while keeping exercise list constant.',
    whatsInside: [
      '3 Strength Days: Lower, Upper, Full Body',
      '2 Active Recovery Days: LISS + Stretch',
      'Week-by-week progression from 2x10 to 3x15',
    ],
    goalText: 'Move better, build consistency, and prepare for advanced programs.',
    weekGrid: {
      week1: { mon: '2x10', tue: 'LISS+Stretch', wed: '2x10', thu: 'LISS+Stretch', fri: '2x10' },
      week2: { mon: '3x10', tue: 'LISS+Stretch', wed: '3x10', thu: 'LISS+Stretch', fri: '3x10' },
      week3: { mon: '3x12', tue: 'LISS+Stretch', wed: '3x12', thu: 'LISS+Stretch', fri: '3x12' },
      week4: { mon: '3x15', tue: 'LISS+Stretch', wed: '3x15', thu: 'LISS+Stretch', fri: '3x15' },
    },
    exerciseLibrary: {
      monday_legs: ['Goblet Squat', 'Reverse Lunges', 'Glute Bridges', 'Lateral Lunges', 'Calf Raises', 'Dead Bug'],
      wednesday_upper: ['Incline Push-ups', 'DB Rows', 'Overhead DB Press', 'Bicep Curls', 'Tricep Extension', 'Plank Tap'],
      friday_fullbody: ['DB Thrusters', 'Romanian Deadlifts', 'Bird-Dogs', 'Mountain Climbers', 'Superman Holds', 'Russian Twists'],
    },
    recoveryProtocol: {
      liss: '20 minutes brisk walk/incline treadmill/light cycling/elliptical',
      stretches: ['Couch Stretch 1m/side', "Child's Pose 1m", 'Cat-Cow 10 reps', 'Doorway Chest Stretch 1m'],
      logic: 'iterate set/rep by week variable while keeping exercise list constant',
    },
  },
  {
    programCode: 'intermediate_strength_8_week',
    subHeader: 'Break through plateaus. Build lean muscle. Define your physique.',
    overview:
      '8-week upper/lower split. Phase 1 hypertrophy (weeks 1-4), Phase 2 strength (weeks 5-8), with active recovery days and progressive load.',
    whatsInside: ['4 strength days/week', '2 active recovery days', 'Phase shift notification after week 4'],
    weekGrid: {
      cadence: ['Mon Upper A', 'Tue Lower A', 'Wed Recovery', 'Thu Upper B', 'Fri Lower B', 'Sat Recovery', 'Sun Rest'],
      phase1: 'Higher volume, 60-90s rest',
      phase2: 'Lower reps, heavier loads, 2-3m rest',
    },
    exerciseLibrary: {
      upperA: ['DB Bench Press', 'Overhead DB Press', 'Chest-supported Row', 'Dips', 'Lateral Raises', 'Weighted Dead Bug'],
      lowerA: ['Back Squat', 'Walking Lunges', 'Leg Extensions', 'DB Step-Ups', 'Seated Calf Raises', 'Hanging Knee Raises'],
      upperB: ['Lat Pulldowns', 'Bent-over DB Row', 'Incline DB Bench', 'Face Pulls', 'Hammer Curls', 'Weighted Russian Twists'],
      lowerB: ['DB RDL', 'DB Hip Thrusts', 'Leg Curls', 'Bulgarian Split Squats', 'Standing Calf Raises', 'Plank Hip Dips'],
    },
    recoveryProtocol: {
      flow: ["World's Greatest Stretch", '90/90 Hip Switches', 'Cat-Cow', 'Scapular Wall Slides', 'Pigeon Pose', 'Thoracic Bridge'],
      week1_4_rounds: 2,
      week5_8_rounds: 3,
    },
  },
  {
    programCode: 'elite_mastery_8_week',
    subHeader: 'The Standard of Excellence',
    overview:
      'Advanced 8-week strength cycle with two 4-week phases. Primary lifts progress weekly by 2.5-5% with dedicated recover days.',
    weekGrid: {
      cadence: ['Mon Foundational Force', 'Tue Vertical/Horizontal Power', 'Wed Active Mobility', 'Thu Posterior Chain', 'Fri Back/Midline', 'Sat Mobility'],
      progressionRule: '+2.5% to 5% weekly on primary lifts with form integrity',
      phase1: 'Volume foundation',
      phase2: 'Intensity and peak',
    },
    exerciseLibrary: {
      monday_squat: ['Back Squat', 'RDL', 'Walking Lunges', 'Leg Press', 'Box Step Ups', 'Calf Raises'],
      tuesday_push: ['Overhead Press', 'Bench Press', 'Cable Fly', 'Incline DB Press', 'Lateral Raises', 'Push Ups'],
      thursday_hinge: ['Deadlift', 'Good Mornings', 'Walking Lunges', 'DB Lateral Lunges', 'Leg Press', 'Hamstring Curls'],
      friday_pull: ['Barbell Row', 'Lat Pulldown', 'Cable Seated Row', 'Pull-Ups', 'Cable Pushdowns', 'Face Pulls'],
    },
    recoveryProtocol: {
      days: ['Wednesday', 'Saturday'],
      duration: '30-45 min low-intensity movement + mobility',
    },
  },
  {
    programCode: 'ignite_28_day',
    subHeader: 'Four Weeks of Intentional Movement, Metabolic Priming, and Habit Mastery.',
    overview:
      'Accelerated 4-week fat loss starter. MWF strength circuit + Tu/Th/Sa cardio + Sunday active recovery with progressive density and reduced rest.',
    weekGrid: {
      cadence: ['Mon/Wed/Fri 20-min Strength', 'Tue/Thu/Sat 30-min Cardio', 'Sun Active Recovery'],
      week1: '3 rounds, 15s rest',
      week2: '3 rounds, 15s rest + rep target',
      week3: '3 rounds, 10s rest',
      week4: '4 rounds, 10s rest',
    },
    exerciseLibrary: {
      foundations_circuit: ['Bodyweight Squat', 'Incline Push-Up', 'Reverse Lunge', 'Plank', 'Bird-Dog'],
      alternatives: ['Box Squat', 'Knee Push-Up', 'Assisted Lunge', 'Kneeling Plank'],
      cardio: ['Brisk walk / 7000+ steps'],
    },
    recoveryProtocol: {
      dailyMetrics: ['Protein every major meal', '7000+ steps', '2-3L water', 'Complete scheduled circuit'],
      sunday: 'light stretch or leisure walk',
    },
  },
  {
    programCode: 'shred_burn_hiit',
    subHeader: 'High-Intensity, High-Result: The 4-Week Metabolic Overdrive.',
    overview:
      'Intermediate HIIT block using 40:20 intervals, explosive compounds, mobility recovery, and week-wise density progression.',
    weekGrid: {
      monday: 'HIIT Lower',
      tuesday: 'LISS 30-45m',
      wednesday: 'HIIT Upper/Core',
      thursday: 'Mobility/Light Yoga',
      friday: 'HIIT Full Body',
      saturday: 'Outdoor activity',
      sunday: 'Rest',
      progression: { week3: 'rest 20s -> 15s', week4: 'rounds 4 -> 5' },
    },
    exerciseLibrary: {
      lower_hiit: ['Goblet Squat', 'Lateral Lunge', 'Jump Squat', 'Glute Bridge March', 'Skaters'],
      upper_hiit: ['Push-Up', 'Renegade Row', 'Mountain Climbers', 'Overhead Press', 'Burpees'],
      fullbody_hiit: ['Thruster', 'Reverse Lunge to Knee Drive', 'Plank Jacks', 'KB Swing', 'Bicycle Crunches'],
    },
    recoveryProtocol: {
      mobility: ['Cat-Cow', "World's Greatest Stretch", '90/90 Hip Switches', "Child's Pose to Cobra", 'Thread-the-Needle', 'Deep Squat Hold'],
      timer: 'Each HIIT exercise uses workout timer',
    },
  },
  {
    programCode: 'elite_metabolic',
    subHeader: 'Precision Training for the High-Performance Physique.',
    overview:
      'Advanced 4-week metabolic conditioning program blending heavy work, EMOM, AMRAP, and strategic recovery.',
    weekGrid: {
      monday: 'Power Engine',
      tuesday: 'Upper Push/Pull',
      wednesday: 'Zone 2 Recovery',
      thursday: 'Posterior Chain EMOM',
      friday: 'AMRAP Challenger',
      saturday: 'Outdoor high-effort activity',
      sunday: 'Deep recovery',
    },
    exerciseLibrary: {
      monday: ['Back Squat 5x5', '400m Run', 'KB Swing x20', 'Box Jump x15'],
      tuesday: ['OH Press + Pull-Up Superset', 'Incline DB Bench + Single Arm Row', 'Metabolic Ladder'],
      thursday: ['EMOM 20: RDL, Renegade Row, KB Swing, Burpees, Rest'],
      friday: ['20-min AMRAP: Thruster, Pull-Up/Row, Push-Up, DB Walking Lunge, Bear Crawl'],
    },
    recoveryProtocol: {
      wednesday: '45-60 min Zone 2 @ 60-70% HR',
      sunday: ['Soft tissue work 10m', 'Contrast shower 5m', 'Diaphragmatic breathing 5m'],
    },
  },
  {
    programCode: 'bodyweight_basics',
    subHeader: 'Master Your Machine. No Equipment Required.',
    overview:
      'Bodyweight-only strength and movement mastery using tempo control, density, and rep-progression without added load.',
    weekGrid: {
      monday: 'Upper Foundation',
      tuesday: 'Lower Body Pillars',
      wednesday: 'Mobility Flow',
      thursday: 'EMOM 20',
      friday: 'Core & Midline',
    },
    exerciseLibrary: {
      monday: ['Tempo Push-Ups', 'Incline Dips', 'Pike Push-ups', 'Superman Holds', 'Plank Shoulder Taps'],
      tuesday: ['Reverse Lunges', 'Bulgarian Split Squats', 'Air Squats', 'Glute Bridges', 'Wall Sit'],
      thursday: ['Air Squats', 'Push-Ups', 'Burpees', 'Bicycle Crunches'],
      friday: ['Hollow Body Hold', 'Side Plank', 'Bird-Dog', 'Mountain Climbers', 'Plank'],
    },
    recoveryProtocol: {
      notes: ['Tempo visualizer', 'Track total reps vs previous sessions'],
    },
  },
  {
    programCode: 'core_flow',
    subHeader: 'Stability in the Center. Fluidity in Motion.',
    overview:
      'Core integration plus dynamic mobility. Monday/Thursday core stability, Tuesday/Friday flow, Wednesday deep reset.',
    weekGrid: {
      monday: 'Core Integrity',
      tuesday: 'Dynamic Flow',
      wednesday: 'Deep Reset',
      thursday: 'Core Integrity',
      friday: 'Dynamic Flow',
    },
    exerciseLibrary: {
      core_integrity: ['360 Breathing', 'Deadbugs', 'Bird-Dog ISO', 'Side Plank', 'Bear Crawl Hold', 'Glute Bridge March'],
      dynamic_flow: ['Cat-Cow Barrel Rolls', "World's Greatest Stretch", '90/90 Hip Switches', 'Scapular Push-ups', 'Adductor Rock-backs'],
      deep_reset: ["Supported Child's Pose", 'Pigeon R/L', 'Puppy Pose', 'Legs Up the Wall'],
    },
    recoveryProtocol: {
      breath: '4-7-8 breathing on reset day',
      reflectionPrompt: 'Grounded / Sleepy / Light / Still Tense',
    },
  },
  {
    programCode: 'functional_strength_mastery',
    subHeader: 'A bridge between raw strength and athletic fluidity.',
    overview:
      'Advanced 8-week, 4-day functional strength program emphasizing compound lifts, carries, unilateral work, and gymnastics exposure.',
    weekGrid: {
      day1: 'Posterior Power & Midline',
      day2: 'Vertical Press & Overhead Mobility',
      day3: 'Explosive Extension & Unilateral Strength',
      day4: 'Full Body Integration & Capacity',
    },
    exerciseLibrary: {
      day1: ['Deadlift 5x5', 'Weighted Pull-Ups', 'KB Front Rack Lunge', 'Hanging Leg Raises', "Farmer's Carry"],
      day2: ['OH Press 5x5', 'Weighted Dips', 'Goblet Cossack Squat', 'Face Pulls', 'Handstand Hold/Walk'],
      day3: ['Power Clean/Snatch', 'Bulgarian Split Squats', 'Single-arm DB Row', 'Barbell RDL', 'Weighted Plank'],
      day4: ['Front Squat 5x5', 'Incline DB Bench', 'Tempo Chin-Ups', 'Turkish Get-Up', 'Sled Push/Drag'],
    },
    recoveryProtocol: { progression: 'repeat weekly for 8 weeks with progressive overload' },
  },
  {
    programCode: 'united_frontier_crossfit',
    subHeader: 'General Physical Preparedness for the Modern Patriot.',
    overview:
      'CrossFit-style Strength + WOD format with benchmark-style scoring and timer modes (AMRAP, For Time, EMOM).',
    weekGrid: {
      monday: 'Back Squat + 21-15-9 WOD',
      tuesday: 'Gymnastics Skill + 20min AMRAP',
      wednesday: '2000m Row + Mobility',
      thursday: 'Power Clean + 5 Rounds For Time',
      friday: 'Bench Press + Chipper',
      saturday: 'Community Frontier WOD',
    },
    exerciseLibrary: {
      monday_wod: ['Thrusters', 'Pull-Ups/Ring Rows', 'Burpees over Bar'],
      tuesday_wod: ['400m Run', 'Box Jumps', 'KB Swings', 'Toes-to-Bar'],
      thursday_wod: ['Deadlifts', 'Double Unders', 'Wall Ball Shots'],
      friday_wod: ['Air Squats', 'Sit-ups', 'Hand-release Push-ups', 'Pull-ups', 'Clean & Jerk'],
    },
    recoveryProtocol: {
      developerNotes: ['Score fields: time/reps/weight', 'Timer types: AMRAP, stopwatch, EMOM'],
    },
  },
  {
    programCode: 'express_15_minute',
    subHeader: 'Zero Excuses. Maximum Intent.',
    overview:
      'Quick-hit 15-minute library for busy schedules. 40s work/20s rest, 3 rounds, multiple targets (full-body, posterior, upper, lower, core).',
    weekGrid: {
      module1: 'Full Body Ignite',
      module2: 'Posterior Power',
      module3: 'Upper Body Sculpt',
      module4: 'Lower Body Burn',
      module5: 'Core & Conditioning Finisher',
    },
    exerciseLibrary: {
      full_body: ['Thrusters', 'Renegade Rows/Banded Row', 'Reverse Lunges', 'Push-ups', 'Mountain Climbers'],
      posterior: ['RDL', 'Single-Arm Row', 'Glute Bridges', 'Superman', 'KB/DB Swings'],
      upper: ['Overhead Press', 'Bicep Curls', 'Tricep Kickbacks', 'Lateral Raises', 'Plank to Push-up'],
      lower: ['Goblet Squats', 'Lateral Lunges', 'Split Squat R/L', 'Jump Squats'],
      core: ['DB Snatch/Woodchoppers', 'Bicycle Crunches', 'Burpees', 'Russian Twists', 'High Knees'],
    },
    recoveryProtocol: { timer: 'stopwatch + interval timer required for each module' },
  },
  {
    programCode: 'radiant_forge_prenatal',
    subHeader: 'Strength for Two: A Guided Path through Pregnancy and Beyond.',
    overview:
      'Prenatal 3-phase program (trimester-based) focusing on safe strength, breathing, pelvic stability, and trimester-specific movement swaps.',
    weekGrid: {
      phase1_weeks: '1-12',
      phase2_weeks: '13-27',
      phase3_weeks: '28-40',
      cadence: ['Mon Lower', 'Tue Upper', 'Wed Recover Flow', 'Thu Full Body', 'Fri Core/Cardio', 'Sat Walk', 'Sun Rest'],
    },
    exerciseLibrary: {
      phase1: ['Back Squat', 'Walking Lunges', 'Seated DB Press', 'Single Arm Row', 'Deadlift', 'Pallof Press'],
      phase2: ['Box Squat', 'Step-ups', 'Arnold Press', 'Lat Pulldown', 'Sumo Deadlift', 'Bird-Dog'],
      phase3: ['Sumo DB Squat', 'Monster Walks', 'Incline DB Press', 'Seated Cable Row', 'Trap Bar Deadlift', 'Pelvic Tilts'],
      recovery_day: ['Cat-Cow', 'Adductor Rock-backs', "Child's Pose", 'Seated Side Stretch', 'Deep Squat Breathing'],
    },
    recoveryProtocol: {
      safety: ['RPE 6-7', 'Supine exercise swaps in phase 2/3', 'Daily diaphragmatic breathing prompt'],
      logic: ['Auto-switch phase at week 13 and 28', 'Add +30s rest in phase 3'],
    },
  },
  {
    programCode: 'shred_to_stage_12_week',
    subHeader: 'Precision Sculpting. Athlete-Grade Discipline.',
    overview:
      '12-week physique transformation with three phases, high-volume hypertrophy, cardio escalation, and stage-prep conditioning.',
    weekGrid: {
      phase1_weeks_1_4: '20-min cardio added daily on training days',
      phase2_weeks_5_8: '30-min cardio daily + higher intensity methods',
      phase3_weeks_9_12: '45-min cardio daily + high detail volume/supersets',
      split: ['Mon Chest/Triceps', 'Tue Back/Biceps', 'Wed Quads', 'Thu Shoulders/Traps', 'Fri Hams/Glutes', 'Sat LISS', 'Sun Rest/Cardio'],
    },
    exerciseLibrary: {
      phase1: ['Incline Bench', 'Rows', 'Back Squat', 'Overhead Press', 'RDL/Hip Thrust', 'daily 20-min incline cardio'],
      phase2: ['Hack Squats', 'Military Press', 'Weighted Pull-Ups', 'Stiff-Leg Deadlifts', 'daily 30-min incline cardio'],
      phase3: ['Superset-heavy chest/back/shoulder days', 'high-rep lower detail', 'daily 45-min incline cardio'],
    },
    recoveryProtocol: {
      extras: ['Saturday zone2 LISS', 'Photo check-in Monday', 'Total workload tracker (sets x reps x weight)'],
    },
  },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates:
      String(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS).toLowerCase() === 'true',
  });

  let updated = 0;
  for (const item of detailedPrograms) {
    const result = await Program.updateOne(
      { programCode: item.programCode },
      {
        $set: {
          subHeader: item.subHeader,
          overview: item.overview,
          whatsInside: item.whatsInside || [],
          goalText: item.goalText || '',
          weekGrid: item.weekGrid,
          exerciseLibrary: item.exerciseLibrary,
          recoveryProtocol: item.recoveryProtocol,
        },
      }
    );
    if (result.modifiedCount) updated += 1;
  }

  console.log(`Detailed seed complete. Updated programs: ${updated}/${detailedPrograms.length}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Detailed seed failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

