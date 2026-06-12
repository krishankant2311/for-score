// Single endpoint that powers the entire user-facing dashboard screen:
//   - Greeting (time-of-day + name + tagline)
//   - CURRENT PROGRAM (active program info + progress %)
//   - TODAY'S WORKOUT (workout title, exercise count, mins, calories)
//   - TODAY'S DIET (meals logged today, calories, macros, water)
//   - YOUR GOALS (progress tracker, primary target, goals list)
//
// Reuses the same helpers as GET /api/user/workouts/today so the dashboard
// card and the workout screen never disagree about exercise count / mins.

const User = require('../model/userModel');
const Program = require('../model/programModel');
const MealLog = require('../model/mealLogModel');
const DailyExerciseCompletion = require('../model/dailyExerciseCompletionModel');
const UserGoal = require('../model/userGoalModel');
const WaterLog = require('../model/waterLogModel');

const { toPublicFileUrl } = require('../../utils/publicFileUrl');
const {
  resolveTodaysExerciseSlots,
  normalizeCalendarDate,
  estimateSessionMinutes,
  buildRecoveryPayloadForResponse,
} = require('./todayWorkoutController');
const { buildGoalView } = require('./userGoalController');
const { buildWaterView } = require('./waterLogController');
const {
  getDailyCalorieTargetDetails,
  buildCalorieEngineResult,
} = require('../../utils/calorieTargetHelpers');
const {
  SCHEDULED_MEAL_TYPES,
  enrichMealLogForResponse,
  buildScheduledMealSlots,
  countCompletedScheduledSlots,
} = require('../../utils/mealLogHelpers');

// ---- Helpers --------------------------------------------------------------

const dayKeyName = (date) => {
  const day = date.getDay();
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
};

// "Good morning" / "Good afternoon" / "Good evening" based on local hour.
const timeOfDayGreeting = (date) => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const firstName = (fullName) => {
  if (!fullName) return '';
  return String(fullName).trim().split(/\s+/)[0] || '';
};

const safePercent = (current, total) => {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
};

// Aggregate calories & macros from a list of meal logs.
const sumMealMacros = (logs) => {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fats = 0;
  for (const log of logs) {
    for (const it of log.items || []) {
      calories += Number(it.calories || 0);
      protein += Number(it.protein || 0);
      carbs += Number(it.carbs || 0);
      fats += Number(it.fats || 0);
    }
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fats: Math.round(fats),
  };
};

// Build the CURRENT PROGRAM card. Returns null when the user hasn't picked one.
// Progress % is calculated from `programStartedAt` and `durationWeeks`.
const buildCurrentProgramCard = async (req, user) => {
  if (!user.activeProgramId) return null;

  const program = await Program.findOne({
    _id: user.activeProgramId,
    status: 'Active',
    isDeleted: { $ne: true },
  }).lean();
  if (!program) return null;

  const start = user.programStartedAt ? new Date(user.programStartedAt) : null;
  const totalWeeks = Math.max(1, Number(program.durationWeeks || 4));
  const totalDays = totalWeeks * 7;

  let daysCompleted = 0;
  if (start) {
    const diffMs = Date.now() - start.getTime();
    daysCompleted = Math.max(0, Math.floor(diffMs / 86400000));
  }
  daysCompleted = Math.min(daysCompleted, totalDays);

  const progressPercent = safePercent(daysCompleted, totalDays);
  const currentWeek = Math.min(totalWeeks, Math.floor(daysCompleted / 7) + 1);

  return {
    _id: program._id,
    title: program.programName || '',
    subtitle: program.subHeader || program.overview || '',
    durationWeeks: totalWeeks,
    daysCompleted,
    totalDays,
    currentWeek,
    progress: {
      percent: progressPercent,
      label: `Week ${currentWeek} of ${totalWeeks}`,
    },
    coverImageUrl: program.thumbnail_url
      ? toPublicFileUrl(req, program.thumbnail_url)
      : program.videoPath
        ? toPublicFileUrl(req, program.videoPath)
        : '',
    cta: 'Change Program',
  };
};

// Build the TODAY'S WORKOUT card. Reuses the slot resolver so the count /
// minutes / calories shown here exactly match GET /workouts/today.
const buildTodayWorkoutCard = async (req, user, refDate) => {
  if (!user.activeProgramId || !user.programStartedAt) return null;

  const program = await Program.findOne({
    _id: user.activeProgramId,
    status: 'Active',
    isDeleted: { $ne: true },
  }).lean();
  if (!program) return null;

  const programIdStr = String(program._id);
  const { slots, inferred, dayType } = resolveTodaysExerciseSlots(
    program,
    user.programStartedAt,
    refDate,
    programIdStr
  );

  const normalizedDate = normalizeCalendarDate(refDate);
  const completion = await DailyExerciseCompletion.findOne({
    userId: user._id,
    date: normalizedDate,
  }).lean();
  const doneKeys = new Set(
    (completion?.completedSlotKeys || []).map((k) => String(k).trim()).filter(Boolean)
  );

  const exerciseCount = slots.length;
  const completedCount = slots.filter((s) => doneKeys.has(s.slotKey)).length;
  const completionPercent = safePercent(completedCount, exerciseCount);

  const estimatedMinutes = exerciseCount ? estimateSessionMinutes(slots, program) : 0;
  const sumCals = slots.reduce(
    (a, s) =>
      a +
      (s.caloriesEstimate != null && !Number.isNaN(Number(s.caloriesEstimate))
        ? Number(s.caloriesEstimate)
        : 0),
    0
  );
  let estimatedCalories = sumCals > 0 ? Math.round(sumCals) : null;
  if (estimatedCalories == null && estimatedMinutes && program.avgSessionMinutes) {
    estimatedCalories = Math.round(
      (estimatedMinutes / Math.max(Number(program.avgSessionMinutes), 1)) * 300
    );
  } else if (estimatedCalories == null && exerciseCount) {
    estimatedCalories = exerciseCount * 45;
  }

  // Subtitle line under the title, e.g. "45 min  •  6 exercises  •  380 cal"
  const parts = [];
  if (estimatedMinutes) parts.push(`${estimatedMinutes} min`);
  if (exerciseCount) parts.push(`${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`);
  if (estimatedCalories != null && estimatedCalories > 0) parts.push(`${estimatedCalories} cal`);

  const card = {
    title: inferred.workoutTitle || program.programName || '',
    day_type: dayType,
    is_rest_day: dayType === 'rest',
    is_recovery_day: dayType === 'recovery',
    exercise_count: exerciseCount,
    completed_count: completedCount,
    completion_percent: completionPercent,
    estimated_minutes: estimatedMinutes,
    estimated_calories: estimatedCalories != null ? estimatedCalories : 0,
    subtitle: parts.join('  •  '),
    cta: dayType === 'workout' ? 'Start Workout' : dayType === 'rest' ? 'Rest Day' : 'View Recovery',
  };

  if (dayType === 'recovery') {
    card.recovery = buildRecoveryPayloadForResponse(req, program);
  }
  return card;
};

// Build the TODAY'S DIET card from meal logs + water log + per-user targets.
const buildTodayDietCard = async (user, refDate) => {
  const normalizedDate = new Date(refDate);
  normalizedDate.setHours(0, 0, 0, 0);

  const [logs, waterLog] = await Promise.all([
    MealLog.find({
      userId: user._id,
      date: normalizedDate,
      status: { $ne: 'Deleted' },
    }).lean(),
    WaterLog.findOne({
      userId: user._id,
      date: normalizedDate,
      status: { $ne: 'Deleted' },
    }).lean(),
  ]);

  /** Matches nutrition APIs: completed slots (explicit flag or legacy items) */
  const mealsLogged = countCompletedScheduledSlots(logs);
  const mealsTarget = SCHEDULED_MEAL_TYPES.length;

  const mealLogs = logs.map((l) => enrichMealLogForResponse(l));
  const mealSlots = buildScheduledMealSlots(logs);

  const macros = sumMealMacros(logs);

  const calorieDetails = getDailyCalorieTargetDetails(user);
  const calorieTarget = calorieDetails.target;
  const proteinTarget = calorieDetails.macros?.protein_grams ?? 0;
  const carbsTarget = calorieDetails.macros?.carb_grams ?? 0;
  const fatsTarget = calorieDetails.macros?.fat_grams ?? 0;

  const remainingCalories = Math.max(0, calorieTarget - macros.calories);

  return {
    mealsLogged: {
      current: mealsLogged,
      target: mealsTarget,
      label: `${mealsLogged} / ${mealsTarget}`,
    },
    mealLogs,
    mealSlots,
    calories: {
      current: macros.calories,
      target: calorieTarget,
      remaining: remainingCalories,
      percent: safePercent(macros.calories, calorieTarget),
      label: `${macros.calories} / ${calorieTarget}`,
      remainingLabel: `${remainingCalories} cal remaining`,
    },
    macros: {
      protein: {
        current: macros.protein,
        target: proteinTarget,
        unit: 'g',
        percent: safePercent(macros.protein, proteinTarget),
        label: `${macros.protein}g`,
        targetLabel: `of ${proteinTarget}g`,
      },
      carbs: {
        current: macros.carbs,
        target: carbsTarget,
        unit: 'g',
        percent: safePercent(macros.carbs, carbsTarget),
        label: `${macros.carbs}g`,
        targetLabel: `of ${carbsTarget}g`,
      },
      fats: {
        current: macros.fats,
        target: fatsTarget,
        unit: 'g',
        percent: safePercent(macros.fats, fatsTarget),
        label: `${macros.fats}g`,
        targetLabel: `of ${fatsTarget}g`,
      },
      water: (() => {
        const view = buildWaterView(waterLog);
        return {
          current: view.cups,
          target: view.target,
          unit: 'cups',
          percent: view.percent,
          label: `${view.cups}`,
          targetLabel: `of ${view.target} cups`,
        };
      })(),
    },
    cta: 'Log Meal',
  };
};

// Build the YOUR GOALS card from UserGoal documents.
const buildGoalsCard = async (user) => {
  const goals = await UserGoal.find({
    userId: user._id,
    status: { $ne: 'Deleted' },
  })
    .sort({ isPrimary: -1, createdAt: -1 })
    .lean();

  const views = goals.map(buildGoalView);
  const completed = views.filter((g) => g.isCompleted).length;
  const primary = views.find((g) => g.isPrimary) || null;

  // Build the "PRIMARY TARGET" tile (Current / Target / To Go) when set.
  let primaryTarget = null;
  if (primary) {
    primaryTarget = {
      _id: primary._id,
      title: primary.title,
      subtitle: primary.subtitle || primary.category,
      unit: primary.unit || '',
      current: primary.currentValue,
      target: primary.targetValue,
      toGo: primary.progress.toGo,
      percent: primary.progress.percent,
    };
  }

  return {
    progressTracker: {
      completed,
      total: views.length,
      label: `${completed} of ${views.length} completed`,
    },
    primaryTarget,
    goals: views,
  };
};

// ---- Main endpoint --------------------------------------------------------

// GET /api/user/dashboard?date=YYYY-MM-DD
const getUserDashboard = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const user = await User.findById(user_id).lean();
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const refDate = req.query.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(refDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date query' });
    }

    // Fake-`req` to call the workout-card builder; it only uses req for
    // `toPublicFileUrl` so we just forward the real req.
    const [currentProgram, todayWorkout, todayDiet, yourGoals] = await Promise.all([
      buildCurrentProgramCard(req, user),
      buildTodayWorkoutCard(req, user, refDate),
      buildTodayDietCard(user, refDate),
      buildGoalsCard(user),
    ]);

    const greeting = timeOfDayGreeting(refDate);
    const name = firstName(user.name) || 'there';
    const profilePhotoUrl = user.profilePhoto
      ? toPublicFileUrl(req, user.profilePhoto)
      : '';

    const calorieEngine = buildCalorieEngineResult(user);

    return res.json({
      success: true,
      message: 'Dashboard fetched successfully',
      result: {
        date: refDate.toISOString(),
        dayName: dayKeyName(refDate),
        calculations: calorieEngine.calculations,
        goal_timeline_warning: calorieEngine.goal_timeline_warning,
        header: {
          greeting,
          name,
          greetingLine: `${greeting}, ${name}`,
          tagline: 'Your only limit is you',
          profilePhotoUrl,
        },
        currentProgram,
        todayWorkout,
        todayDiet,
        yourGoals,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

module.exports = {
  getUserDashboard,
};
