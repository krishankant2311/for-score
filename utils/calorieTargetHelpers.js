/**
 * Daily calorie target from user profile (US units: height inches, weight lbs).
 * Maintenance ≈ Mifflin–St Jeor BMR × activity (workout days/week).
 * Target = maintenance + weekly-goal adjustment (≈ ±250/500 kcal per 0.5/1 lb/week).
 *
 * If the app stored height in cm (e.g. 175) or weight in kg (e.g. 75), values are normalized.
 */

const WEEKLY_GOAL_CALORIE_MAP = {
  lose_1: -500,
  lose_0_5: -250,
  maintain: 0,
  gain_0_5: 250,
  gain_1: 500,
};

const ALLOWED_CALORIE_ADJUSTMENTS = Object.values(WEEKLY_GOAL_CALORIE_MAP);

const LEGACY_MAINTENANCE_KCAL = 2200;
const MIN_DAILY_TARGET = 1200;
const MAX_DAILY_TARGET = 4500;
const MAX_MAINTENANCE_KCAL = 4000;

const normalizeWeeklyGoalKey = (raw) => {
  if (raw == null || raw === '') return '';
  return String(raw).toLowerCase().trim().replace(/\s+/g, '_');
};

/** Daily kcal delta from lose/gain 0.5–1 lb per week screen (clamped to valid offsets only). */
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

/** Values > 96 are treated as centimeters (realistic max height ~8 ft = 96 in). */
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

/**
 * Weight may be stored in kg (e.g. 75) when height was stored in cm (e.g. 175).
 * Values already in lbs (often 130–350) are left unchanged.
 */
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

const activityMultiplierFromWorkoutFrequency = (daysPerWeek) => {
  const d = parsePositiveNumber(daysPerWeek);
  if (d == null) return 1.55;
  if (d <= 3) return 1.375;
  if (d === 4) return 1.55;
  if (d === 5) return 1.725;
  return 1.9;
};

/**
 * Mifflin–St Jeor BMR (kcal/day). Height in inches, weight in pounds.
 */
const calculateBmrKcal = ({ weightLbs, heightInches, ageYears, gender }) => {
  const weightKg = weightLbs * 0.45359237;
  const heightCm = heightInches * 2.54;
  const g = String(gender || '').toLowerCase();
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  if (g === 'female') return base - 161;
  if (g === 'male') return base + 5;
  return base - 78;
};

const resolveProfileForCalories = (user) => {
  const { inches: heightInches, wasCentimeters } = normalizeHeightInches(user?.height);
  const weightLbs = normalizeWeightLbs(user?.weight, heightInches, wasCentimeters);
  const ageYears = parsePositiveNumber(user?.age);

  if (heightInches == null || weightLbs == null || ageYears == null) {
    return null;
  }

  return { heightInches, weightLbs, ageYears, gender: user?.gender };
};

/**
 * @returns {{
 *   target: number,
 *   maintenanceCalories: number,
 *   calorieAdjustment: number,
 *   bmr: number | null,
 *   activityMultiplier: number,
 *   calculatedFromProfile: boolean,
 * }}
 */
const getDailyCalorieTargetDetails = (user) => {
  const calorieAdjustment = getCalorieAdjustmentForUser(user);
  const activityMultiplier = activityMultiplierFromWorkoutFrequency(user?.workoutFrequency);

  const profile = resolveProfileForCalories(user);

  if (!profile) {
    const maintenanceCalories = LEGACY_MAINTENANCE_KCAL;
    const target = Math.min(
      MAX_DAILY_TARGET,
      Math.max(MIN_DAILY_TARGET, Math.round(maintenanceCalories + calorieAdjustment))
    );
    return {
      target,
      maintenanceCalories,
      calorieAdjustment,
      bmr: null,
      activityMultiplier,
      calculatedFromProfile: false,
    };
  }

  const bmr = calculateBmrKcal({
    weightLbs: profile.weightLbs,
    heightInches: profile.heightInches,
    ageYears: profile.ageYears,
    gender: profile.gender,
  });

  const maintenanceRaw = Math.round(bmr * activityMultiplier);
  const maintenanceCalories = Math.min(MAX_MAINTENANCE_KCAL, maintenanceRaw);
  const target = Math.min(
    MAX_DAILY_TARGET,
    Math.max(MIN_DAILY_TARGET, Math.round(maintenanceCalories + calorieAdjustment))
  );

  return {
    target,
    maintenanceCalories,
    calorieAdjustment,
    bmr: Math.round(bmr),
    activityMultiplier,
    calculatedFromProfile: true,
  };
};

const getDailyCalorieTarget = (user) => getDailyCalorieTargetDetails(user).target;

module.exports = {
  WEEKLY_GOAL_CALORIE_MAP,
  ALLOWED_CALORIE_ADJUSTMENTS,
  LEGACY_MAINTENANCE_KCAL,
  getCalorieAdjustmentForUser,
  getDailyCalorieTarget,
  getDailyCalorieTargetDetails,
  calculateBmrKcal,
  normalizeHeightInches,
  normalizeWeightLbs,
  resolveProfileForCalories,
};
