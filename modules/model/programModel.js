// modules/model/programModel.js
// New FitnessProgram schema (client-aligned). Exported as `Program` and pinned to
// collection name `programs` so existing user.activeProgramId references and
// other controllers (today workout, dashboard, etc.) keep working unchanged.
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ScheduleRowSchema = new Schema(
  {
    week: { type: Number, required: true, min: 1 },
    mon: { type: String, default: '' },
    tue: { type: String, default: '' },
    wed: { type: String, default: '' },
    thu: { type: String, default: '' },
    fri: { type: String, default: '' },
    sat: { type: String, default: '' },
    sun: { type: String, default: '' },
    weekend: { type: String, default: '' },
  },
  { _id: false }
);

const ExerciseSchema = new Schema(
  {
    slotKey: String,
    name: { type: String, default: '' },
    tag: { type: String, default: 'Large Muscle' },
    role: { type: String, default: 'Primary' },
    target_sets: { type: Number, default: null },
    target_reps_range: { type: String, default: '' },
    tempo: { type: String, default: '' },
    restPerExercise: { type: String, default: '' },
    alternative: { type: String, default: '' },
    notes: { type: String, default: '' },
    targetMusclesText: { type: String, default: '' },
    target_muscles: [String],
    instructionsText: { type: String, default: '' },
    instructions: [String],
    difficulty_level: String,
    estimated_time: Number,
    estimated_calories: Number,
    media_type: String,
    video_url: String,
    thumbnail_url: String,
    mediaUrls: [String],
  },
  { _id: false }
);

const OverloadRowSchema = new Schema(
  {
    week: { type: Number, required: true },
    sets: { type: String, default: '' },
    reps: { type: String, default: '' },
    rest: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const WorkoutMetaSchema = new Schema(
  {
    format: { type: String, default: 'Standard sets' },
    workInterval: { type: String, default: '' },
    restBetweenSets: { type: String, default: '' },
    rounds: { type: String, default: '' },
    estDuration: { type: String, default: '' },
    levelNotes: { type: String, default: '' },
    overload: [OverloadRowSchema],
  },
  { _id: false }
);

const PhaseSchema = new Schema(
  {
    name: { type: String, default: '' },
    startWeek: { type: Number, default: 1 },
    endWeek: { type: Number, default: 4 },
    goal: { type: String, default: '' },
    restPeriod: { type: String, default: '' },
  },
  { _id: false }
);

const StretchSchema = new Schema(
  {
    name: { type: String, default: '' },
    detail: { type: String, default: '' },
  },
  { _id: false }
);

const RecoveryBlockItemSchema = new Schema(
  {
    name: { type: String, default: '' },
    duration: { type: String, default: '' },
    target: { type: String, default: '' },
  },
  { _id: false }
);

const RecoveryBlockSchema = new Schema(
  {
    type: { type: String, default: 'LISS Cardio' },
    name: { type: String, default: '' },
    dayAssignment: { type: String, default: 'Recovery day' },
    duration: { type: String, default: '' },
    intensity: { type: String, default: '' },
    modality: { type: String, default: '' },
    format: { type: String, default: 'Single circuit' },
    roundsP1: { type: String, default: '' },
    roundsP2: { type: String, default: '' },
    instruction: { type: String, default: '' },
    items: [RecoveryBlockItemSchema],
  },
  { _id: false }
);

const RecoveryTipSchema = new Schema(
  {
    day: { type: String, default: 'Any recovery day' },
    text: { type: String, default: '' },
  },
  { _id: false }
);

const RecoverySchema = new Schema(
  {
    lissMinutes: { type: Number, default: 20 },
    lissPrompt: { type: String, default: '' },
    lissOptions: { type: String, default: '' },
    stretches: [StretchSchema],
    mediaUrls: [String],
  },
  { _id: false }
);

const FitnessProgramSchema = new Schema(
  {
    programName: { type: String, required: true, trim: true },
    subHeader: { type: String, default: '' },
    overview: { type: String, default: '' },
    whatsInside: { type: String, default: '' },
    isThisForYou: { type: String, default: '' },
    theGoal: { type: String, default: '' },
    missionStatement: { type: String, default: '' },
    primaryGoal: { type: String, default: '' },

    workoutSkillLevel: { type: String, default: '' },
    workoutSkillType: { type: String, default: '' },
    workoutPreference: { type: String, default: '' },
    primaryGoals: [String],

    durationWeeks: { type: Number, default: 4 },
    frequencyPerWeek: { type: Number, default: 5 },
    avgSessionMinutes: { type: Number, default: 35 },
    frequencyCaption: { type: String, default: '' },
    frequency: { type: String, default: '' },
    daysPerWeek: { type: String, default: '' },

    locationTag: { type: String, default: '' },
    equipment: { type: String, default: '' },
    equipmentList: [String],
    equipmentNote: { type: String, default: '' },
    noEquipmentRequired: { type: Boolean, default: false },

    status: { type: String, default: 'Active' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },

    implementationNote: { type: String, default: '' },

    phaseCount: { type: Number, default: 1, min: 1, max: 3 },
    phaseStructure: {
      transitionTrigger: { type: String, default: 'At week number (fixed)' },
      changeNotification: { type: String, default: '' },
      phases: [PhaseSchema],
    },

    frequencyRules: {
      trainingDaysPerWeek: { type: String, default: '' },
      recoveryDaysPerWeek: { type: String, default: '' },
      restDaysPerWeek: { type: String, default: '' },
      flexibleSchedule: { type: Boolean, default: false },
      libraryMode: { type: Boolean, default: false },
    },

    progressTracking: {
      primaryMetric: { type: String, default: 'Sets × Reps progression' },
      secondaryMetric: { type: String, default: '' },
      photoCheckIn: { type: Boolean, default: false },
      leaderboard: { type: Boolean, default: false },
      pbTracker: { type: Boolean, default: false },
      habitTracker: { type: Boolean, default: false },
    },

    schedule: [ScheduleRowSchema],
    weekGrid: { type: Schema.Types.Mixed },

    workouts: {
      A: [ExerciseSchema],
      B: [ExerciseSchema],
      C: [ExerciseSchema],
    },
    workoutsMeta: {
      A: WorkoutMetaSchema,
      B: WorkoutMetaSchema,
      C: WorkoutMetaSchema,
    },
    exerciseLibrary: { type: Schema.Types.Mixed },

    engineSettings: {
      timerTypes: [String],
      uiFeatures: [String],
    },

    recovery: RecoverySchema,
    recoveryProtocol: { type: Schema.Types.Mixed },
    recoveryBlocks: [RecoveryBlockSchema],
    restDayConfig: {
      type: { type: String, default: 'Full rest (no activity)' },
      message: { type: String, default: '' },
      deepRecovery: { type: Boolean, default: false },
      outdoorActivity: { type: Boolean, default: false },
    },
    injuryPrevention: {
      notes: { type: String, default: '' },
      prenatalMode: { type: Boolean, default: false },
      weightGuard: { type: Boolean, default: false },
      deloadWeeks: { type: Boolean, default: false },
    },
    recoveryTips: [RecoveryTipSchema],

    page2: { type: Schema.Types.Mixed },
    page3: { type: Schema.Types.Mixed },
    page4: { type: Schema.Types.Mixed },
    programDetail: { type: Schema.Types.Mixed },

    // ---- Legacy fields preserved so older docs and matching engine keep working
    programCode: { type: String, default: '' },
    tags: [String],
    isGymRequired: { type: Boolean, default: false },
    isHomeFriendly: { type: Boolean, default: false },
    isQuickProgram: { type: Boolean, default: false },
    isPrenatalProgram: { type: Boolean, default: false },
    minSessionMinutes: { type: Number, default: null },
    maxSessionMinutes: { type: Number, default: null },
    goalText: { type: String, default: '' },
    quickStats: { type: Schema.Types.Mixed },
    videoPath: { type: String, default: '' },

    createdByEmail: { type: String, default: '' },
  },
  { timestamps: true }
);

FitnessProgramSchema.index({ programName: 'text', subHeader: 'text', overview: 'text' });
FitnessProgramSchema.index({ status: 1, isDeleted: 1, updatedAt: -1 });

// Pin to existing `programs` collection so old user.activeProgramId references stay valid.
const Program = mongoose.model('Program', FitnessProgramSchema, 'programs');

module.exports = Program;
