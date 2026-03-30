const User = require('../model/userModel');
const NutritionItem = require('../model/nutritionItemModel');
const MealLog = require('../model/mealLogModel');

const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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
        nutritionItemId: it.nutritionItemId || null,
        name: (it.name || '').trim(),
        calories,
        protein,
        carbs,
        fats,
        quantity: qty,
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

    if (!log) {
      log = await MealLog.create({
        userId: user_id,
        date: normalizedDate,
        mealType,
        items: cleanedItems,
        notes: (notes || '').trim(),
      });
    } else {
      log.items = cleanedItems;
      if (notes != null) log.notes = (notes || '').trim();
      await log.save();
    }

    return res.json({
      success: true,
      message: 'Meal log saved successfully',
      result: log,
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

    const macros = aggregateDailyMacros(logs);

    // Simple targets (could be personalized later)
    const calorieTarget = 2200 + (user.calorieAdjustment || 0);
    const proteinTarget = 150;
    const carbsTarget = 250;
    const fatsTarget = 70;

    const safePercent = (val, target) => (target > 0 ? Math.min(100, (val / target) * 100) : 0);

    return res.json({
      success: true,
      message: 'Daily nutrition summary fetched successfully',
      result: {
        date: normalizedDate,
        calories: {
          current: macros.calories,
          target: calorieTarget,
          percent: safePercent(macros.calories, calorieTarget),
        },
        macros: {
          protein: {
            current: macros.protein,
            target: proteinTarget,
            percent: safePercent(macros.protein, proteinTarget),
          },
          carbs: {
            current: macros.carbs,
            target: carbsTarget,
            percent: safePercent(macros.carbs, carbsTarget),
          },
          fats: {
            current: macros.fats,
            target: fatsTarget,
            percent: safePercent(macros.fats, fatsTarget),
          },
        },
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

    return res.json({
      success: true,
      message: 'Daily meals fetched successfully',
      result: logs,
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

    const breakfast = await NutritionItem.find({
      category: 'Breakfast',
      status: 'Active',
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const snacks = await NutritionItem.find({
      category: 'Snack',
      status: 'Active',
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const lunch = await NutritionItem.find({
      category: 'Lunch',
      status: 'Active',
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const dinner = await NutritionItem.find({
      category: 'Dinner',
      status: 'Active',
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return res.json({
      success: true,
      message: 'Suggested menu fetched successfully',
      result: {
        breakfast,
        snacks,
        lunch,
        dinner,
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
      result: log,
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
  getDailyNutritionSummary,
  getDailyMeals,
  getSuggestedMenu,
  deleteMealLog,
};

