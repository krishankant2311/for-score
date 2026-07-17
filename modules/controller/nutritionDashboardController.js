const User = require('../model/userModel');
const NutritionItem = require('../model/nutritionItemModel');
const MealLog = require('../model/mealLogModel');
const Food = require('../model/foodModel');
const {
  SCHEDULED_MEAL_TYPES,
  enrichMealLogForResponse,
  enrichMealLogsWithItemImages,
  buildScheduledMealSlots,
  countCompletedScheduledSlots,
} = require('../../utils/mealLogHelpers');
const { getDailyCalorieTargetDetails } = require('../../utils/calorieTargetHelpers');
const { isBlockedUser, sendBlockedUserResponse } = require('../../utils/userAccessGuards');

const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const toBool = (value, defaultValue = true) => {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const s = String(value).toLowerCase().trim();
  if (['true', '1', 'yes'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return defaultValue;
};

// 1. Add or update meal log for a meal type on a given date
const addOrUpdateMealLog = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    if (isBlockedUser(user)) {
      return sendBlockedUserResponse(res);
    }

    const { date, mealType, items, notes } = req.body;
    const normalizedDate = normalizeDate(date);

    if (!mealType) {
      return res.status(400).json({
        success: false,
        message: 'mealType is required',
      });
    }

    let parsedItems = [];
    if (Array.isArray(items)) {
      parsedItems = items;
    } else if (typeof items === 'string' && items.trim()) {
      try {
        parsedItems = JSON.parse(items);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'items must be a valid JSON array',
        });
      }
    }

    if (!parsedItems.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one meal item is required',
      });
    }

    const cleanedItems = parsedItems.map((it) => {
      const qty = it.quantity != null && it.quantity !== '' ? Number(it.quantity) : 1;
      const calories = Number(it.calories || 0) * qty;
      const protein = Number(it.protein || 0) * qty;
      const carbs = Number(it.carbs || 0) * qty;
      const fats = Number(it.fats || 0) * qty;

      return {
        foodId: it.foodId || null,
        nutritionItemId: it.nutritionItemId || null,
        name: (it.name || '').trim(),
        calories,
        protein,
        carbs,
        fats,
        quantity: qty,
        mealTime: (it.mealTime || '').trim(),
        servingSize: (it.servingSize || '').trim(),
      };
    });

    if (
      cleanedItems.some(
        (i) =>
          !i.name ||
          Number.isNaN(i.calories) ||
          Number.isNaN(i.protein) ||
          Number.isNaN(i.carbs) ||
          Number.isNaN(i.fats)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: 'Each item must have valid name and numeric macros',
      });
    }

    let log = await MealLog.findOne({
      userId: user_id,
      date: normalizedDate,
      mealType,
      status: { $ne: 'Deleted' },
    });

    const newMealCalories = sumItemsCalories(cleanedItems);
    const projectedTotal = await getProjectedDailyCalories({
      userId: user_id,
      normalizedDate,
      replaceLogId: log?._id || null,
      replacementCalories: newMealCalories,
    });
    if (
      await rejectIfDailyCalorieLimitExceeded({
        res,
        user,
        userId: user_id,
        normalizedDate,
        projectedTotalCalories: projectedTotal,
      })
    ) {
      return;
    }

    if (!log) {
      log = await MealLog.create({
        userId: user_id,
        date: normalizedDate,
        mealType,
        items: cleanedItems,
        notes: (notes || '').trim(),
        isCompleted: true,
        completedAt: new Date(),
      });
    } else {
      log.items = cleanedItems;
      if (notes != null) log.notes = (notes || '').trim();
      log.isCompleted = true;
      log.completedAt = new Date();
      await log.save();
    }

    return res.json({
      success: true,
      message: 'Meal log saved successfully',
      result: enrichMealLogForResponse(log.toObject ? log.toObject() : log),
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

// 1B. Schedule a meal item from food catalog using food id
const scheduleMealByFoodId = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    if (isBlockedUser(user)) {
      return sendBlockedUserResponse(res);
    }

    const { date, mealType, foodId, quantity, mealTime, notes } = req.body;
    if (!mealType || !foodId) {
      return res.status(400).json({
        success: false,
        message: 'mealType and foodId are required',
      });
    }

    const normalizedDate = normalizeDate(date);
    const food = await Food.findOne({ _id: foodId, status: { $ne: 'Deleted' } }).lean();
    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food not found',
      });
    }

    const qty = quantity != null && quantity !== '' ? Number(quantity) : 1;
    if (Number.isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'quantity must be a valid positive number',
      });
    }

    const item = {
      foodId: food._id,
      nutritionItemId: null,
      name: food.name,
      calories: (food.calories || 0) * qty,
      protein: (food.protein || 0) * qty,
      carbs: (food.carbs || 0) * qty,
      fats: (food.fats || 0) * qty,
      quantity: qty,
      mealTime: (mealTime || '').trim(),
      servingSize: (food.servingSize || '').trim(),
    };

    let log = await MealLog.findOne({
      userId: user_id,
      date: normalizedDate,
      mealType,
      status: { $ne: 'Deleted' },
    });

    const projectedTotal = await getProjectedDailyCalories({
      userId: user_id,
      normalizedDate,
      addCalories: item.calories,
    });
    if (
      await rejectIfDailyCalorieLimitExceeded({
        res,
        user,
        userId: user_id,
        normalizedDate,
        projectedTotalCalories: projectedTotal,
      })
    ) {
      return;
    }

    if (!log) {
      log = await MealLog.create({
        userId: user_id,
        date: normalizedDate,
        mealType,
        items: [item],
        notes: (notes || '').trim(),
        isCompleted: true,
        completedAt: new Date(),
      });
    } else {
      log.items.push(item);
      if (notes != null) log.notes = (notes || '').trim();
      log.isCompleted = true;
      log.completedAt = new Date();
      await log.save();
    }

    return res.json({
      success: true,
      message: 'Meal scheduled successfully',
      result: enrichMealLogForResponse(log.toObject ? log.toObject() : log),
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

// Helper to aggregate daily macros from meal logs
const aggregateDailyMacros = (logs) => {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fats = 0;

  logs.forEach((log) => {
    (log.items || []).forEach((it) => {
      calories += it.calories || 0;
      protein += it.protein || 0;
      carbs += it.carbs || 0;
      fats += it.fats || 0;
    });
  });

  return { calories, protein, carbs, fats };
};

const sumMealLogCalories = (log) =>
  (log?.items || []).reduce((sum, it) => sum + (Number(it.calories) || 0), 0);

const sumItemsCalories = (items) =>
  (items || []).reduce((sum, it) => sum + (Number(it.calories) || 0), 0);

const getUserDailyCalorieTarget = (user) =>
  Math.round(Number(getDailyCalorieTargetDetails(user).target) || 0);

/** Reject save when projected day total would exceed the user's daily calorie target. */
const rejectIfDailyCalorieLimitExceeded = async ({
  res,
  user,
  userId,
  normalizedDate,
  projectedTotalCalories,
}) => {
  const target = getUserDailyCalorieTarget(user);
  if (target <= 0) return false;

  const projected = Math.round(Number(projectedTotalCalories) || 0);
  if (projected <= target) return false;

  res.status(400).json({
    success: false,
    message: `Daily calorie limit exceeded. You cannot log more than ${target} calories per day.`,
    result: {
      target,
      projected,
      over_by: projected - target,
    },
  });
  return true;
};

const getProjectedDailyCalories = async ({
  userId,
  normalizedDate,
  excludeLogId = null,
  addCalories = 0,
  replaceLogId = null,
  replacementCalories = 0,
}) => {
  const logs = await MealLog.find({
    userId,
    date: normalizedDate,
    status: { $ne: 'Deleted' },
  }).lean();

  let total = 0;
  for (const log of logs) {
    if (excludeLogId && String(log._id) === String(excludeLogId)) continue;
    if (replaceLogId && String(log._id) === String(replaceLogId)) {
      total += replacementCalories;
      continue;
    }
    total += sumMealLogCalories(log);
  }
  return total + addCalories;
};

const safePercent = (val, target) =>
  target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0;

const roundMacro = (n) => Math.round(Number(n) || 0);

/** Daily totals for Great American Menu / nutrition summary (used, target, remaining). */
const buildDailyNutritionPayload = (user, logs, normalizedDate) => {
  const macros = aggregateDailyMacros(logs);

  const calorieDetails = getDailyCalorieTargetDetails(user);
  const calorieTarget = calorieDetails.target;
  const proteinTarget = calorieDetails.macros?.protein_grams ?? 0;
  const carbsTarget = calorieDetails.macros?.carb_grams ?? 0;
  const fatsTarget = calorieDetails.macros?.fat_grams ?? 0;

  const currentCalories = roundMacro(macros.calories);
  const targetCalories = roundMacro(calorieTarget);
  const remainingCalories = Math.max(0, targetCalories - currentCalories);

  const mealsCompleted = countCompletedScheduledSlots(logs);
  const mealSlots = buildScheduledMealSlots(logs);

  const macroBlock = (current, target) => ({
    current: roundMacro(current),
    target: roundMacro(target),
    remaining: Math.max(0, roundMacro(target) - roundMacro(current)),
    percent: safePercent(current, target),
  });

  return {
    date: normalizedDate,
    calories: {
      current: currentCalories,
      target: targetCalories,
      remaining: remainingCalories,
      percent: safePercent(currentCalories, targetCalories),
      maintenance: calorieDetails.maintenanceCalories,
      adjustment: calorieDetails.calorieAdjustment,
      calculatedFromProfile: calorieDetails.calculatedFromProfile,
      bmr: calorieDetails.bmr,
      activity_factor: calorieDetails.activityFactor,
      activity_multiplier: calorieDetails.activityMultiplier,
    },
    calculations: calorieDetails.calculations,
    goal_timeline_warning: calorieDetails.goal_timeline_warning,
    macros: {
      protein: macroBlock(macros.protein, proteinTarget),
      carbs: macroBlock(macros.carbs, carbsTarget),
      fats: macroBlock(macros.fats, fatsTarget),
    },
    meals: {
      completed: mealsCompleted,
      total: SCHEDULED_MEAL_TYPES.length,
    },
    mealSlots,
  };
};

// 2. Get daily nutrition dashboard summary
const getDailyNutritionSummary = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const normalizedDate = normalizeDate(req.query.date);

    const logs = await MealLog.find({
      userId: user_id,
      date: normalizedDate,
      status: { $ne: 'Deleted' },
    }).lean();

    return res.json({
      success: true,
      message: 'Daily nutrition summary fetched successfully',
      result: buildDailyNutritionPayload(user, logs, normalizedDate),
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

// 3. Get daily meals list (for "My Meals" and meal cards)
const getDailyMeals = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const normalizedDate = normalizeDate(req.query.date);

    const logs = await MealLog.find({
      userId: user_id,
      date: normalizedDate,
      status: { $ne: 'Deleted' },
    })
      .sort({ mealType: 1, createdAt: 1 })
      .lean();

    const sortedLogs = await enrichMealLogsWithItemImages(req, logs);

    const summary = buildDailyNutritionPayload(user, sortedLogs, normalizedDate);

    return res.json({
      success: true,
      message: 'Daily meals fetched successfully',
      result: sortedLogs,
      summary,
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

// 4. Get suggested menu from Nutrition Items (for "The Great American Menu")
const getSuggestedMenu = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const [breakfast, morningSnacks, lunch, eveningSnacks, dinner, genericSnacks] =
      await Promise.all([
        NutritionItem.find({ category: 'Breakfast', status: 'Active' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        NutritionItem.find({ category: 'Morning Snack', status: 'Active' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        NutritionItem.find({ category: 'Lunch', status: 'Active' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        NutritionItem.find({ category: 'Evening Snack', status: 'Active' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        NutritionItem.find({ category: 'Dinner', status: 'Active' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        NutritionItem.find({ category: 'Snack', status: 'Active' })
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
      ]);

    // Legacy items tagged plain 'Snack' fall back to BOTH snack buckets so older
    // admin data doesn't disappear from the UI after the split.
    const morningSnacksFinal = morningSnacks.length ? morningSnacks : genericSnacks;
    const eveningSnacksFinal = eveningSnacks.length ? eveningSnacks : genericSnacks;

    return res.json({
      success: true,
      message: 'Suggested menu fetched successfully',
      result: {
        breakfast,
        morningSnacks: morningSnacksFinal,
        lunch,
        eveningSnacks: eveningSnacksFinal,
        dinner,
        // Backward compatibility for older clients still reading `snacks`.
        snacks: genericSnacks.length ? genericSnacks : [...morningSnacks, ...eveningSnacks],
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

// 5. Soft delete meal log (if user removes a meal)
const deleteMealLog = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const log = await MealLog.findOne({
      _id: id,
      userId: user_id,
    });

    if (!log || log.status === 'Deleted') {
      return res.status(404).json({
        success: false,
        message: 'Meal log not found',
      });
    }

    log.status = 'Deleted';
    await log.save();

    return res.json({
      success: true,
      message: 'Meal log deleted successfully',
      result: enrichMealLogForResponse(log.toObject ? log.toObject() : log),
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

// 5B. Delete one item from a meal log (items do not have their own _id)
const deleteMealLogItem = async (req, res) => {
  try {
    const user_id = req.token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const itemIndexRaw = req.body?.itemIndex ?? req.body?.index ?? req.query?.itemIndex ?? req.query?.index;
    const itemIndex =
      itemIndexRaw != null && itemIndexRaw !== '' && Number.isInteger(Number(itemIndexRaw))
        ? Number(itemIndexRaw)
        : null;
    const foodId = String(req.body?.foodId ?? req.query?.foodId ?? '').trim();
    const nutritionItemId = String(req.body?.nutritionItemId ?? req.query?.nutritionItemId ?? '').trim();
    const name = String(req.body?.name ?? req.query?.name ?? '').trim().toLowerCase();

    if (itemIndex == null && !foodId && !nutritionItemId && !name) {
      return res.status(400).json({
        success: false,
        message: 'itemIndex, foodId, nutritionItemId or name is required',
      });
    }

    const log = await MealLog.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Meal log not found',
      });
    }

    const items = Array.isArray(log.items) ? log.items : [];
    if (!items.length) {
      return res.status(404).json({
        success: false,
        message: 'No meal items found',
      });
    }

    let removeIndex = -1;
    if (itemIndex != null) {
      const sortedWithOriginalIndex = items
        .map((item, originalIndex) => ({ item, originalIndex }))
        .sort((a, b) => String(a.item.mealTime || '').localeCompare(String(b.item.mealTime || '')));
      if (itemIndex < 0 || itemIndex >= sortedWithOriginalIndex.length) {
        return res.status(400).json({
          success: false,
          message: 'itemIndex is out of range',
        });
      }
      removeIndex = sortedWithOriginalIndex[itemIndex].originalIndex;
    } else {
      removeIndex = items.findIndex((item) => {
        const itemFoodId = item.foodId != null ? String(item.foodId) : '';
        const itemNutritionItemId =
          item.nutritionItemId != null ? String(item.nutritionItemId) : '';
        const itemName = String(item.name || '').trim().toLowerCase();
        return (
          (foodId && itemFoodId === foodId) ||
          (nutritionItemId && itemNutritionItemId === nutritionItemId) ||
          (name && itemName === name)
        );
      });
    }

    if (removeIndex < 0) {
      return res.status(404).json({
        success: false,
        message: 'Meal item not found',
      });
    }

    const [removedItem] = items.splice(removeIndex, 1);
    log.items = items;
    if (items.length === 0) {
      log.status = 'Deleted';
      log.isCompleted = false;
      log.completedAt = null;
    }
    await log.save();

    return res.json({
      success: true,
      message: 'Meal item deleted successfully',
      result: {
        meal: enrichMealLogForResponse(log.toObject ? log.toObject() : log),
        deletedItem: removedItem,
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

// 6. Mark one meal log complete / incomplete (by MealLog _id)
const markMealLogComplete = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const completed = toBool(req.body?.completed ?? req.body?.isCompleted, true);

    const log = await MealLog.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Meal log not found',
      });
    }

    log.isCompleted = completed;
    log.completedAt = completed ? new Date() : null;
    await log.save();

    return res.json({
      success: true,
      message: completed ? 'Meal marked complete' : 'Meal marked incomplete',
      result: enrichMealLogForResponse(log.toObject()),
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

// 7. Mark all scheduled meal slots for a day complete / incomplete (creates empty logs if needed)
const markAllMealsCompleteForDay = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const normalizedDate = normalizeDate(req.body?.date);
    const completed = toBool(req.body?.completed ?? req.body?.isCompleted, true);

    const updated = [];

    for (const mealType of SCHEDULED_MEAL_TYPES) {
      let log = await MealLog.findOne({
        userId: user_id,
        date: normalizedDate,
        mealType,
        status: { $ne: 'Deleted' },
      });

      if (!log) {
        if (!completed) continue;
        log = await MealLog.create({
          userId: user_id,
          date: normalizedDate,
          mealType,
          items: [],
          notes: '',
          isCompleted: true,
          completedAt: new Date(),
        });
      } else {
        log.isCompleted = completed;
        log.completedAt = completed ? new Date() : null;
        await log.save();
      }
      const plain = log.toObject ? log.toObject() : log;
      updated.push(enrichMealLogForResponse(plain));
    }

    return res.json({
      success: true,
      message: completed
        ? 'All scheduled meals marked complete for this day'
        : 'All scheduled meals marked incomplete for this day',
      result: updated,
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
  addOrUpdateMealLog,
  scheduleMealByFoodId,
  getDailyNutritionSummary,
  getDailyMeals,
  getSuggestedMenu,
  deleteMealLog,
  deleteMealLogItem,
  markMealLogComplete,
  markAllMealsCompleteForDay,
};

