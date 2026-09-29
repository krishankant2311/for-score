const mongoose = require('mongoose');
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
        servingGrams: it.servingGrams != null && it.servingGrams !== '' ? Number(it.servingGrams) : null,
        calories_per_serving: it.calories_per_serving != null && it.calories_per_serving !== '' ? Number(it.calories_per_serving) : null,
        protein_g_per_serving: (it.protein_g_per_serving ?? it.protein_per_serving) != null && (it.protein_g_per_serving ?? it.protein_per_serving) !== '' ? Number(it.protein_g_per_serving ?? it.protein_per_serving) : null,
        carbs_g_per_serving: (it.carbs_g_per_serving ?? it.carbs_per_serving) != null && (it.carbs_g_per_serving ?? it.carbs_per_serving) !== '' ? Number(it.carbs_g_per_serving ?? it.carbs_per_serving) : null,
        fat_g_per_serving: (it.fat_g_per_serving ?? it.fats_g_per_serving ?? it.fat_per_serving ?? it.fats_per_serving) != null && (it.fat_g_per_serving ?? it.fats_g_per_serving ?? it.fat_per_serving ?? it.fats_per_serving) !== '' ? Number(it.fat_g_per_serving ?? it.fats_g_per_serving ?? it.fat_per_serving ?? it.fats_per_serving) : null,
        calories_per_100g: it.calories_per_100g != null && it.calories_per_100g !== '' ? Number(it.calories_per_100g) : null,
        protein_g_per_100g: it.protein_g_per_100g != null && it.protein_g_per_100g !== '' ? Number(it.protein_g_per_100g) : null,
        carbs_g_per_100g: it.carbs_g_per_100g != null && it.carbs_g_per_100g !== '' ? Number(it.carbs_g_per_100g) : null,
        fat_g_per_100g: it.fat_g_per_100g != null && it.fat_g_per_100g !== '' ? Number(it.fat_g_per_100g) : null,
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

const roundMacro2 = (n) =>
  n == null || Number.isNaN(Number(n)) ? 0 : Math.round(Number(n) * 100) / 100;
const roundCal = (n) =>
  n == null || Number.isNaN(Number(n)) ? 0 : Math.round(Number(n));

const resolveMealItemMacros = (food, body, qty = 1) => {
  const rawServingSize = body.servingSize ?? body.serving_size;
  const servingSize =
    rawServingSize != null && String(rawServingSize).trim() !== ''
      ? String(rawServingSize).trim()
      : (food.servingSize || '').trim();

  // 1. Resolve serving grams
  let servingGrams = null;
  const rawServingGrams = body.servingGrams ?? body.serving_grams;
  if (rawServingGrams != null && rawServingGrams !== '' && !Number.isNaN(Number(rawServingGrams))) {
    servingGrams = Number(rawServingGrams);
  } else if (Array.isArray(food.servingSizes) && food.servingSizes.length > 0) {
    const match = food.servingSizes.find(
      (s) => s?.label && s.label.trim().toLowerCase() === servingSize.toLowerCase()
    );
    if (match && match.grams != null && !Number.isNaN(Number(match.grams))) {
      servingGrams = Number(match.grams);
    }
  }

  if (servingGrams == null) {
    const gMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\b/i);
    if (gMatch) {
      servingGrams = parseFloat(gMatch[1]);
    } else if (food.servingGrams != null && !Number.isNaN(Number(food.servingGrams))) {
      servingGrams = Number(food.servingGrams);
    }
  }

  // 2. Base 100g macros from food
  const cal100 = food.calories_per_100g != null ? Number(food.calories_per_100g) : null;
  const pro100 = food.protein_g_per_100g != null ? Number(food.protein_g_per_100g) : null;
  const carb100 = food.carbs_g_per_100g != null ? Number(food.carbs_g_per_100g) : null;
  const fat100 = food.fat_g_per_100g != null ? Number(food.fat_g_per_100g) : null;

  // 3. Base food per-serving defaults
  const baseCalPerServing =
    food.calories_per_serving != null
      ? Number(food.calories_per_serving)
      : food.calories != null
      ? Number(food.calories)
      : 0;
  const baseProPerServing =
    food.protein_g_per_serving != null
      ? Number(food.protein_g_per_serving)
      : food.protein != null
      ? Number(food.protein)
      : 0;
  const baseCarbPerServing =
    food.carbs_g_per_serving != null
      ? Number(food.carbs_g_per_serving)
      : food.carbs != null
      ? Number(food.carbs)
      : 0;
  const baseFatPerServing =
    food.fat_g_per_serving != null
      ? Number(food.fat_g_per_serving)
      : food.fats != null
      ? Number(food.fats)
      : 0;

  // 4. Check explicit per-serving macros from request
  const reqCalPerServing =
    body.calories_per_serving != null && body.calories_per_serving !== ''
      ? Number(body.calories_per_serving)
      : null;
  const reqProPerServing =
    (body.protein_g_per_serving ?? body.protein_per_serving) != null &&
    (body.protein_g_per_serving ?? body.protein_per_serving) !== ''
      ? Number(body.protein_g_per_serving ?? body.protein_per_serving)
      : null;
  const reqCarbPerServing =
    (body.carbs_g_per_serving ?? body.carbs_per_serving) != null &&
    (body.carbs_g_per_serving ?? body.carbs_per_serving) !== ''
      ? Number(body.carbs_g_per_serving ?? body.carbs_per_serving)
      : null;
  const reqFatPerServing =
    (body.fat_g_per_serving ??
      body.fats_g_per_serving ??
      body.fat_per_serving ??
      body.fats_per_serving) != null &&
    (body.fat_g_per_serving ??
      body.fats_g_per_serving ??
      body.fat_per_serving ??
      body.fats_per_serving) !== ''
      ? Number(
          body.fat_g_per_serving ??
            body.fats_g_per_serving ??
            body.fat_per_serving ??
            body.fats_per_serving
        )
      : null;

  // 5. Check direct macros from request (e.g. calories, protein, carbs, fats/fat)
  const reqCalories =
    (body.calories ?? body.calorie) != null && (body.calories ?? body.calorie) !== ''
      ? Number(body.calories ?? body.calorie)
      : null;
  const reqProtein =
    (body.protein ?? body.proteins) != null && (body.protein ?? body.proteins) !== ''
      ? Number(body.protein ?? body.proteins)
      : null;
  const reqCarbs =
    (body.carbs ?? body.carb) != null && (body.carbs ?? body.carb) !== ''
      ? Number(body.carbs ?? body.carb)
      : null;
  const reqFats =
    (body.fats ?? body.fat) != null && (body.fats ?? body.fat) !== ''
      ? Number(body.fats ?? body.fat)
      : null;

  // Calculate default per-serving from servingGrams / 100g ratio if available
  let calculatedCalPerServing = baseCalPerServing;
  let calculatedProPerServing = baseProPerServing;
  let calculatedCarbPerServing = baseCarbPerServing;
  let calculatedFatPerServing = baseFatPerServing;

  let baseFoodGrams = null;
  if (food.servingGrams != null && !Number.isNaN(Number(food.servingGrams))) {
    baseFoodGrams = Number(food.servingGrams);
  } else if (food.servingSize) {
    const baseGMatch = String(food.servingSize).match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\b/i);
    if (baseGMatch) baseFoodGrams = parseFloat(baseGMatch[1]);
  }

  if (servingGrams != null && cal100 != null) {
    calculatedCalPerServing = (cal100 * servingGrams) / 100;
    if (pro100 != null) calculatedProPerServing = (pro100 * servingGrams) / 100;
    if (carb100 != null) calculatedCarbPerServing = (carb100 * servingGrams) / 100;
    if (fat100 != null) calculatedFatPerServing = (fat100 * servingGrams) / 100;
  } else if (servingGrams != null && baseFoodGrams != null && baseFoodGrams > 0) {
    const ratio = servingGrams / baseFoodGrams;
    calculatedCalPerServing = baseCalPerServing * ratio;
    calculatedProPerServing = baseProPerServing * ratio;
    calculatedCarbPerServing = baseCarbPerServing * ratio;
    calculatedFatPerServing = baseFatPerServing * ratio;
  }

  // Resolve final per-serving and total macros:
  let finalCalPerServing = reqCalPerServing ?? calculatedCalPerServing;
  let finalProPerServing = reqProPerServing ?? calculatedProPerServing;
  let finalCarbPerServing = reqCarbPerServing ?? calculatedCarbPerServing;
  let finalFatPerServing = reqFatPerServing ?? calculatedFatPerServing;

  let finalTotalCalories = null;
  let finalTotalProtein = null;
  let finalTotalCarbs = null;
  let finalTotalFats = null;

  if (reqCalories != null && !Number.isNaN(reqCalories)) {
    if (qty === 1) {
      finalTotalCalories = reqCalories;
      finalCalPerServing = reqCalories;
    } else {
      finalTotalCalories = reqCalories;
      finalCalPerServing = reqCalPerServing ?? roundMacro2(reqCalories / qty);
    }
  } else {
    finalTotalCalories = finalCalPerServing * qty;
  }

  if (reqProtein != null && !Number.isNaN(reqProtein)) {
    if (qty === 1) {
      finalTotalProtein = reqProtein;
      finalProPerServing = reqProtein;
    } else {
      finalTotalProtein = reqProtein;
      finalProPerServing = reqProPerServing ?? roundMacro2(reqProtein / qty);
    }
  } else {
    finalTotalProtein = finalProPerServing * qty;
  }

  if (reqCarbs != null && !Number.isNaN(reqCarbs)) {
    if (qty === 1) {
      finalTotalCarbs = reqCarbs;
      finalCarbPerServing = reqCarbs;
    } else {
      finalTotalCarbs = reqCarbs;
      finalCarbPerServing = reqCarbPerServing ?? roundMacro2(reqCarbs / qty);
    }
  } else {
    finalTotalCarbs = finalCarbPerServing * qty;
  }

  if (reqFats != null && !Number.isNaN(reqFats)) {
    if (qty === 1) {
      finalTotalFats = reqFats;
      finalFatPerServing = reqFats;
    } else {
      finalTotalFats = reqFats;
      finalFatPerServing = reqFatPerServing ?? roundMacro2(reqFats / qty);
    }
  } else {
    finalTotalFats = finalFatPerServing * qty;
  }

  return {
    servingSize,
    servingGrams: servingGrams != null ? roundMacro2(servingGrams) : null,
    calories: roundCal(finalTotalCalories),
    protein: roundMacro2(finalTotalProtein),
    carbs: roundMacro2(finalTotalCarbs),
    fats: roundMacro2(finalTotalFats),
    calories_per_serving: roundCal(finalCalPerServing),
    protein_g_per_serving: roundMacro2(finalProPerServing),
    carbs_g_per_serving: roundMacro2(finalCarbPerServing),
    fat_g_per_serving: roundMacro2(finalFatPerServing),
    calories_per_100g: cal100,
    protein_g_per_100g: pro100,
    carbs_g_per_100g: carb100,
    fat_g_per_100g: fat100,
  };
};

// 1B. Schedule one or multiple meal items from food catalog using food id(s)
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
    if (!mealType) {
      return res.status(400).json({
        success: false,
        message: 'mealType is required',
      });
    }

    // Support both multiple foods (items or foods array) and single food (foodId)
    let incomingItems = [];
    const rawItems = req.body.items ?? req.body.foods;
    if (Array.isArray(rawItems)) {
      incomingItems = rawItems;
    } else if (typeof rawItems === 'string' && rawItems.trim()) {
      try {
        const parsed = JSON.parse(rawItems);
        if (Array.isArray(parsed)) incomingItems = parsed;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'items must be a valid JSON array',
        });
      }
    }

    if (!incomingItems.length) {
      if (!foodId) {
        return res.status(400).json({
          success: false,
          message: 'foodId or items array is required',
        });
      }
      incomingItems = [
        {
          foodId,
          quantity,
          mealTime,
          notes,
          servingSize: req.body.servingSize ?? req.body.serving_size,
          servingGrams: req.body.servingGrams ?? req.body.serving_grams,
          calories: req.body.calories ?? req.body.calorie,
          protein: req.body.protein ?? req.body.proteins,
          carbs: req.body.carbs ?? req.body.carb,
          fats: req.body.fats ?? req.body.fat,
          calories_per_serving: req.body.calories_per_serving,
          protein_g_per_serving: req.body.protein_g_per_serving ?? req.body.protein_per_serving,
          carbs_g_per_serving: req.body.carbs_g_per_serving ?? req.body.carbs_per_serving,
          fat_g_per_serving:
            req.body.fat_g_per_serving ??
            req.body.fats_g_per_serving ??
            req.body.fat_per_serving ??
            req.body.fats_per_serving,
          itemIndex: req.body.itemIndex ?? req.body.index,
          itemId: req.body.itemId,
          name: req.body.name,
        },
      ];
    }

    const normalizedDate = normalizeDate(date);
    const foodIds = [...new Set(incomingItems.map((it) => it.foodId).filter(Boolean))];
    if (!foodIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Each item must have a valid foodId',
      });
    }

    const foods = await Food.find({ _id: { $in: foodIds }, status: { $ne: 'Deleted' } }).lean();
    const foodMap = new Map(foods.map((f) => [String(f._id), f]));

    const processedItems = [];
    for (const rawIt of incomingItems) {
      const fId = String(rawIt.foodId || '').trim();
      const food = foodMap.get(fId);
      if (!food) {
        return res.status(404).json({
          success: false,
          message: `Food not found for id: ${fId}`,
        });
      }

      const qty = rawIt.quantity != null && rawIt.quantity !== '' ? Number(rawIt.quantity) : 1;
      if (Number.isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `quantity must be a valid positive number for food: ${food.name}`,
        });
      }

      const macroData = resolveMealItemMacros(food, rawIt, qty);
      processedItems.push({
        foodId: food._id,
        nutritionItemId: null,
        name: (rawIt.name && String(rawIt.name).trim()) || food.name,
        calories: macroData.calories,
        protein: macroData.protein,
        carbs: macroData.carbs,
        fats: macroData.fats,
        quantity: qty,
        mealTime: (rawIt.mealTime || mealTime || '').trim(),
        servingSize: macroData.servingSize,
        servingGrams: macroData.servingGrams,
        calories_per_serving: macroData.calories_per_serving,
        protein_g_per_serving: macroData.protein_g_per_serving,
        carbs_g_per_serving: macroData.carbs_g_per_serving,
        fat_g_per_serving: macroData.fat_g_per_serving,
        calories_per_100g: macroData.calories_per_100g,
        protein_g_per_100g: macroData.protein_g_per_100g,
        carbs_g_per_100g: macroData.carbs_g_per_100g,
        fat_g_per_100g: macroData.fat_g_per_100g,
        _itemIndex: rawIt.itemIndex ?? rawIt.index ?? null,
        _itemId: rawIt.itemId ?? null,
      });
    }

    let log = null;
    const reqLogId = req.body.mealLogId ?? req.body.logId ?? req.body.id;
    if (reqLogId && mongoose.Types.ObjectId.isValid(String(reqLogId))) {
      log = await MealLog.findOne({
        _id: reqLogId,
        userId: user_id,
        status: { $ne: 'Deleted' },
      });
    }

    if (!log) {
      log = await MealLog.findOne({
        userId: user_id,
        date: normalizedDate,
        mealType,
        status: { $ne: 'Deleted' },
      });
    }

    let finalItems = [];
    if (!log) {
      finalItems = processedItems.map(({ _itemIndex, _itemId, ...rest }) => rest);
    } else {
      finalItems = [...(log.items || [])];
      for (const pItem of processedItems) {
        const { _itemIndex, _itemId, ...cleanItem } = pItem;
        let matchIdx = -1;

        if (_itemIndex != null && Number.isInteger(Number(_itemIndex))) {
          const idx = Number(_itemIndex);
          if (idx >= 0 && idx < finalItems.length) matchIdx = idx;
        }

        if (matchIdx < 0 && _itemId) {
          matchIdx = finalItems.findIndex(
            (it) => String(it._id || '') === String(_itemId) || String(it.foodId || '') === String(_itemId)
          );
        }

        if (matchIdx < 0) {
          matchIdx = finalItems.findIndex(
            (it) => it.foodId && String(it.foodId) === String(cleanItem.foodId)
          );
        }

        if (matchIdx >= 0) {
          finalItems[matchIdx] = {
            ...(finalItems[matchIdx]?.toObject ? finalItems[matchIdx].toObject() : finalItems[matchIdx]),
            ...cleanItem,
          };
        } else {
          finalItems.push(cleanItem);
        }
      }
    }

    const newMealCalories = finalItems.reduce((sum, it) => sum + (Number(it.calories) || 0), 0);
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
        items: finalItems,
        notes: (notes || '').trim(),
        isCompleted: true,
        completedAt: new Date(),
      });
    } else {
      log.items = finalItems;
      if (notes != null) log.notes = (notes || '').trim();
      log.isCompleted = true;
      log.completedAt = new Date();
      await log.save();
    }

    const isUpdate = !!(log && processedItems.length === 1 && incomingItems[0]?._itemIndex != null);
    return res.json({
      success: true,
      message: isUpdate ? 'Meal updated successfully' : 'Meal scheduled successfully',
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

