/**
 * Calorie & Macro Engine (client spec).
 * - Revised Harris-Benedict BMR
 * - Activity factor multipliers (Sedentary → Extra Active)
 * - Weekly goal deficit/surplus (±250 / ±500 kcal)
 * - Macro split: 35% protein / 35% carbs / 30% fat
 * - Safety floors: female 1200, male 1500 kcal/day
 * - Goal vs timeline reality check
 */

const WEEKLY_GOAL_CALORIE_MAP = {
  lose_1: -500,
  lose_0_5: -250,
  maintain: 0,
  gain_0_5: 250,
  gain_1: 500,
};

const WEEKLY_GOAL_RATE_LBS = {
  lose_1: -1,
  lose_0_5: -0.5,
  maintain: 0,
  gain_0_5: 0.5,
  gain_1: 1,
};

const ALLOWED_CALORIE_ADJUSTMENTS = Object.values(WEEKLY_GOAL_CALORIE_MAP);

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const ALLOWED_ACTIVITY_FACTOR_KEYS = Object.keys(ACTIVITY_FACTORS);

const LEGACY_MAINTENANCE_KCAL = 2200;
const MAX_DAILY_TARGET = 4500;
const MAX_MAINTENANCE_KCAL = 4000;

const MIN_CALORIES_FEMALE = 1200;
const MIN_CALORIES_MALE = 1500;

const normalizeWeeklyGoalKey = (raw) => {
  if (raw == null || raw === '') return '';
  let s = String(raw).toLowerCase().trim().replace(/\s+/g, '_');
  const aliases = {
    lose_1lb: 'lose_1',
    lose_1_lb: 'lose_1',
    lose_0_5lb: 'lose_0_5',
    lose_0_5_lb: 'lose_0_5',
    lose_half_lb: 'lose_0_5',
    gain_0_5lb: 'gain_0_5',
    gain_0_5_lb: 'gain_0_5',
    gain_1lb: 'gain_1',
    gain_1_lb: 'gain_1',
  };
  if (aliases[s]) return aliases[s];
  if (s.includes('lose') && s.includes('0.5')) return 'lose_0_5';
  if (s.includes('lose') && s.includes('1')) return 'lose_1';
  if (s.includes('gain') && s.includes('0.5')) return 'gain_0_5';
  if (s.includes('gain') && s.includes('1')) return 'gain_1';
  if (s.includes('maintain')) return 'maintain';
  return s;
};

const normalizeActivityFactorKey = (raw) => {
  if (raw == null || raw === '') return '';
  const s = String(raw)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');

  const aliases = {
    sedentary: 'sedentary',
    lightly_active: 'lightly_active',
    light: 'lightly_active',
    lightly: 'lightly_active',
    moderately_active: 'moderately_active',
    moderate: 'moderately_active',
    moderately: 'moderately_active',
    very_active: 'very_active',
    very: 'very_active',
    extra_active: 'extra_active',
    extra: 'extra_active',
  };

  if (aliases[s]) return aliases[s];
  if (ALLOWED_ACTIVITY_FACTOR_KEYS.includes(s)) return s;
  return '';
};

const getCalorieAdjustmentForUser = (user) => {
  const stored = user?.calorieAdjustment;
  if (stored != null && stored !== '' && !Number.isNaN(Number(stored))) {
    const n = Number(stored);
    if (ALLOWED_CALORIE_ADJUSTMENTS.includes(n)) return n;
  }
  const key = normalizeWeeklyGoalKey(user?.weeklyWeightGoal);
  if (key && Object.prototype.hasOwnProperty.call(WEEKLY_GOAL_CALORIE_MAP, key)) {
    return WEEKLY_GOAL_CALORIE_MAP[key];
  }
  return 0;
};

const parsePositiveNumber = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const normalizeHeightInches = (rawHeight) => {
  const h = parsePositiveNumber(rawHeight);
  if (h == null) return { inches: null, wasCentimeters: false };
  if (h > 96) {
    return { inches: Math.round((h / 2.54) * 10) / 10, wasCentimeters: true };
  }
  return { inches: h, wasCentimeters: false };
};

const bmiFromLbsInches = (weightLbs, heightInches) =>
  (weightLbs / (heightInches * heightInches)) * 703;

const normalizeWeightLbs = (rawWeight, heightInches, heightWasCentimeters) => {
  const w = parsePositiveNumber(rawWeight);
  if (w == null || heightInches == null) return null;

  const bmiAsLbs = bmiFromLbsInches(w, heightInches);
  const bmiImplausible = bmiAsLbs < 12 || bmiAsLbs > 55;

  const likelyKg =
    (heightWasCentimeters && w >= 25 && w <= 130) ||
    (w >= 25 && w <= 200 && bmiImplausible);

  if (likelyKg) {
    return Math.round(w * 2.20462 * 10) / 10;
  }
  return w;
};

const activityFactorFromWorkoutFrequency = (daysPerWeek) => {
  const d = parsePositiveNumber(daysPerWeek);
  if (d == null) return 'moderately_active';
  if (d <= 3) return 'lightly_active';
  if (d === 4) return 'moderately_active';
  if (d === 5) return 'very_active';
  return 'extra_active';
};

const resolveActivityFactorKey = (user) => {
  const stored = normalizeActivityFactorKey(user?.activityFactor);
  if (stored) return stored;
  return activityFactorFromWorkoutFrequency(user?.workoutFrequency);
};

/**
 * Revised Harris-Benedict BMR (metric: kg, cm, years).
 */
const calculateHarrisBenedictBmr = ({ weightKg, heightCm, ageYears, gender }) => {
  const g = String(gender || '').toLowerCase();
  if (g === 'male') {
    return 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * ageYears;
  }
  if (g === 'female') {
    return 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * ageYears;
  }
  const male = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * ageYears;
  const female = 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * ageYears;
  return (male + female) / 2;
};

/** @deprecated Use calculateHarrisBenedictBmr — kept for any external imports */
const calculateBmrKcal = ({ weightLbs, heightInches, ageYears, gender }) =>
  calculateHarrisBenedictBmr({
    weightKg: weightLbs / 2.20462,
    heightCm: heightInches * 2.54,
    ageYears,
    gender,
  });

const resolveProfileForCalories = (user) => {
  const { inches: heightInches, wasCentimeters } = normalizeHeightInches(user?.height);
  const weightLbs = normalizeWeightLbs(user?.weight, heightInches, wasCentimeters);
  const ageYears = parsePositiveNumber(user?.age);

  if (heightInches == null || weightLbs == null || ageYears == null) {
    return null;
  }

  return { heightInches, weightLbs, ageYears, gender: user?.gender, wasCentimeters };
};

const applyCalorieFloor = (targetCalories, gender) => {
  const g = String(gender || '').toLowerCase();
  const floor = g === 'male' ? MIN_CALORIES_MALE : MIN_CALORIES_FEMALE;
  return Math.max(floor, Math.round(targetCalories));
};

const calculateMacroGrams = (targetCalories) => {
  const cal = Math.round(Number(targetCalories) || 0);
  return {
    protein_grams: Math.round((cal * 0.35) / 4),
    carb_grams: Math.round((cal * 0.35) / 4),
    fat_grams: Math.round((cal * 0.3) / 9),
  };
};

const parseGoalDurationWeeks = (raw) => {
  if (raw == null || raw === '') return null;
  const s = String(raw).toLowerCase().trim();
  const preset = { '8w': 8, '12w': 12, '16w': 16, '24w': 24 };
  if (preset[s] != null) return preset[s];
  const m = /^(\d+)\s*w(?:eeks?)?$/i.exec(s);
  if (m) return Number(m[1]);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const evaluateGoalTimelineWarning = (user) => {
  const noWarning = { show_warning: false, message: '' };

  const profile = resolveProfileForCalories(user);
  if (!profile) return noWarning;

  const weeks = parseGoalDurationWeeks(user?.goalDuration);
  const goalKey = normalizeWeeklyGoalKey(user?.weeklyWeightGoal);
  const weeklyRate = WEEKLY_GOAL_RATE_LBS[goalKey];

  if (!weeks || weeklyRate == null || weeklyRate === 0) return noWarning;

  const targetLbs = normalizeWeightLbs(
    user?.targetweight,
    profile.heightInches,
    profile.wasCentimeters
  );
  if (targetLbs == null) return noWarning;

  const currentLbs = profile.weightLbs;
  const delta = targetLbs - currentLbs;
  const requestedChangeLbs = Math.abs(delta);
  if (requestedChangeLbs < 0.5) return noWarning;

  const sameDirection =
    (weeklyRate < 0 && delta < 0) || (weeklyRate > 0 && delta > 0);
  if (!sameDirection) return noWarning;

  const sustainableChangeLbs = Math.abs(weeklyRate) * weeks;
  if (requestedChangeLbs <= sustainableChangeLbs + 0.01) return noWarning;

  const sustainableRounded = Math.round(sustainableChangeLbs);
  const suggestedTargetLbs =
    weeklyRate < 0
      ? Math.round((currentLbs - sustainableChangeLbs) * 10) / 10
      : Math.round((currentLbs + sustainableChangeLbs) * 10) / 10;

  return {
    show_warning: true,
    message: `Based on your ${weeks}-week timeline, a sustainable target is closer to ${sustainableRounded} lbs. Would you like to extend your timeline or adjust your target goal?`,
    weeks_selected: weeks,
    weekly_rate_lbs: Math.abs(weeklyRate),
    sustainable_change_lbs: Math.round(sustainableChangeLbs * 10) / 10,
    requested_change_lbs: Math.round(requestedChangeLbs * 10) / 10,
    suggested_target_weight_lbs: suggestedTargetLbs,
  };
};

/**
 * Full engine output for profile / dashboard APIs.
 */
const buildCalorieEngineResult = (user) => {
  const calorieAdjustment = getCalorieAdjustmentForUser(user);
  const activityFactorKey = resolveActivityFactorKey(user);
  const activityMultiplier = ACTIVITY_FACTORS[activityFactorKey];
  const goalTimelineWarning = evaluateGoalTimelineWarning(user);

  const profile = resolveProfileForCalories(user);

  if (!profile) {
    const tdeeMaintenance = LEGACY_MAINTENANCE_KCAL;
    let targetDailyCalories = applyCalorieFloor(
      tdeeMaintenance + calorieAdjustment,
      user?.gender
    );
    targetDailyCalories = Math.min(MAX_DAILY_TARGET, targetDailyCalories);

    return {
      calculations: {
        bmr: null,
        tdee_maintenance: tdeeMaintenance,
        target_daily_calories: targetDailyCalories,
        macros: calculateMacroGrams(targetDailyCalories),
      },
      calculatedFromProfile: false,
      activity_factor: activityFactorKey,
      activity_multiplier: activityMultiplier,
      calorie_adjustment: calorieAdjustment,
      goal_timeline_warning: goalTimelineWarning,
    };
  }

  const weightKg = profile.weightLbs / 2.20462;
  const heightCm = profile.heightInches * 2.54;

  const bmr = Math.round(
    calculateHarrisBenedictBmr({
      weightKg,
      heightCm,
      ageYears: profile.ageYears,
      gender: profile.gender,
    })
  );

  const tdeeMaintenance = Math.min(
    MAX_MAINTENANCE_KCAL,
    Math.round(bmr * activityMultiplier)
  );

  let targetDailyCalories = Math.round(tdeeMaintenance + calorieAdjustment);
  targetDailyCalories = applyCalorieFloor(targetDailyCalories, profile.gender || user?.gender);
  targetDailyCalories = Math.min(MAX_DAILY_TARGET, targetDailyCalories);

  return {
    calculations: {
      bmr,
      tdee_maintenance: tdeeMaintenance,
      target_daily_calories: targetDailyCalories,
      macros: calculateMacroGrams(targetDailyCalories),
    },
    calculatedFromProfile: true,
    activity_factor: activityFactorKey,
    activity_multiplier: activityMultiplier,
    calorie_adjustment: calorieAdjustment,
    goal_timeline_warning: goalTimelineWarning,
  };
};

const getDailyCalorieTargetDetails = (user) => {
  const engine = buildCalorieEngineResult(user);
  return {
    target: engine.calculations.target_daily_calories,
    maintenanceCalories: engine.calculations.tdee_maintenance,
    calorieAdjustment: engine.calorie_adjustment,
    bmr: engine.calculations.bmr,
    activityMultiplier: engine.activity_multiplier,
    activityFactor: engine.activity_factor,
    calculatedFromProfile: engine.calculatedFromProfile,
    macros: engine.calculations.macros,
    calculations: engine.calculations,
    goal_timeline_warning: engine.goal_timeline_warning,
  };
};

const getDailyCalorieTarget = (user) => getDailyCalorieTargetDetails(user).target;

module.exports = {
  WEEKLY_GOAL_CALORIE_MAP,
  WEEKLY_GOAL_RATE_LBS,
  ALLOWED_CALORIE_ADJUSTMENTS,
  ACTIVITY_FACTORS,
  ALLOWED_ACTIVITY_FACTOR_KEYS,
  LEGACY_MAINTENANCE_KCAL,
  MIN_CALORIES_FEMALE,
  MIN_CALORIES_MALE,
  getCalorieAdjustmentForUser,
  getDailyCalorieTarget,
  getDailyCalorieTargetDetails,
  buildCalorieEngineResult,
  calculateHarrisBenedictBmr,
  calculateBmrKcal,
  calculateMacroGrams,
  evaluateGoalTimelineWarning,
  normalizeActivityFactorKey,
  normalizeHeightInches,
  normalizeWeightLbs,
  resolveProfileForCalories,
};
