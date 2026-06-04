/**
 * Daily calorie target from user profile (US units: height inches, weight lbs).
 * Maintenance ≈ Mifflin–St Jeor BMR × activity (workout days/week).
 * Target = maintenance + weekly-goal adjustment (≈ ±250/500 kcal per 0.5/1 lb/week).
 */

const WEEKLY_GOAL_CALORIE_MAP = {
  lose_1: -500,
  lose_0_5: -250,
  maintain: 0,
  gain_0_5: 250,
  gain_1: 500,
};

const LEGACY_MAINTENANCE_KCAL = 2200;
const MIN_DAILY_TARGET = 1200;
const MAX_DAILY_TARGET = 5000;

const normalizeWeeklyGoalKey = (raw) => {
  if (raw == null || raw === '') return '';
  return String(raw).toLowerCase().trim().replace(/\s+/g, '_');
};

/** Daily kcal delta from lose/gain 0.5–1 lb per week screen. */
const getCalorieAdjustmentForUser = (user) => {
  const stored = user?.calorieAdjustment;
  if (stored != null && stored !== '' && !Number.isNaN(Number(stored))) {
    return Number(stored);
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
  // non-binary / unknown: average of male & female offsets
  return base - 78;
};

const canCalculateMaintenance = (user) => {
  const weightLbs = parsePositiveNumber(user?.weight);
  const heightInches = parsePositiveNumber(user?.height);
  const ageYears = parsePositiveNumber(user?.age);
  return weightLbs != null && heightInches != null && ageYears != null;
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

  if (!canCalculateMaintenance(user)) {
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
    weightLbs: Number(user.weight),
    heightInches: Number(user.height),
    ageYears: Number(user.age),
    gender: user.gender,
  });
  const maintenanceCalories = Math.round(bmr * activityMultiplier);
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
  LEGACY_MAINTENANCE_KCAL,
  getCalorieAdjustmentForUser,
  getDailyCalorieTarget,
  getDailyCalorieTargetDetails,
  calculateBmrKcal,
};
