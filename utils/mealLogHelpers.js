/**
 * Shared meal-log completion helpers for nutrition GET/POST responses
 * (dashboard, nutrition summary, /nutrition/meals, completion APIs).
 */

const mongoose = require('mongoose');
const Food = require('../modules/model/foodModel');
const NutritionItem = require('../modules/model/nutritionItemModel');
const { toPublicFileUrl } = require('./publicFileUrl');

const SCHEDULED_MEAL_TYPES = [
  'Breakfast',
  'Morning Snack',
  'Lunch',
  'Evening Snack',
  'Dinner',
];

/** Stored flag wins; legacy rows (no field) = complete if they have logged items */
const mealLogIsComplete = (log) => {
  if (!log) return false;
  if (typeof log.isCompleted === 'boolean') return log.isCompleted;
  return Array.isArray(log.items) && log.items.length > 0;
};

/** Normalize any stored date to ISO string; invalid / missing → null */
const toIsoOrNull = (d) => {
  if (d == null || d === '') return null;
  const dt = d instanceof Date ? d : new Date(d);
  const t = dt.getTime();
  return Number.isNaN(t) ? null : dt.toISOString();
};

/**
 * When a meal counts as complete but `completedAt` was never set (legacy rows or
 * older writes), expose `updatedAt` / `createdAt` so clients can always show a time.
 */
const resolvedCompletedAtForResponse = (log) => {
  if (!log) return null;
  const explicit = toIsoOrNull(log.completedAt);
  if (explicit) return explicit;
  if (mealLogIsComplete(log)) {
    return toIsoOrNull(log.updatedAt) || toIsoOrNull(log.createdAt) || null;
  }
  return null;
};

const enrichMealLogForResponse = (log) => {
  if (!log) return log;
  const sortedItems = [...(log.items || [])].sort((a, b) =>
    String(a.mealTime || '').localeCompare(String(b.mealTime || ''))
  );
  return {
    ...log,
    items: sortedItems,
    isCompleted: mealLogIsComplete(log),
    completedAt: resolvedCompletedAtForResponse(log),
  };
};

const resolveItemImageFromMaps = (item, foodImageById, nutritionImageById) => {
  if (!item) return '';
  const foodId = item.foodId != null ? String(item.foodId) : '';
  if (foodId && foodImageById.has(foodId)) return foodImageById.get(foodId) || '';
  const nutritionItemId = item.nutritionItemId != null ? String(item.nutritionItemId) : '';
  if (nutritionItemId && nutritionImageById.has(nutritionItemId)) {
    return nutritionImageById.get(nutritionItemId) || '';
  }
  return '';
};

/** Attach public `image` URL on each meal item from Food.image or NutritionItem.imagePath. */
const enrichMealLogsWithItemImages = async (req, logs) => {
  const list = Array.isArray(logs) ? logs : [];
  const foodIds = new Set();
  const nutritionIds = new Set();

  for (const log of list) {
    for (const it of log?.items || []) {
      if (it?.foodId && mongoose.Types.ObjectId.isValid(String(it.foodId))) {
        foodIds.add(String(it.foodId));
      }
      if (it?.nutritionItemId && mongoose.Types.ObjectId.isValid(String(it.nutritionItemId))) {
        nutritionIds.add(String(it.nutritionItemId));
      }
    }
  }

  const foodImageById = new Map();
  const nutritionImageById = new Map();

  if (foodIds.size) {
    const foods = await Food.find({
      _id: { $in: [...foodIds] },
      status: { $ne: 'Deleted' },
    })
      .select('image')
      .lean();
    for (const f of foods) {
      const stored = String(f.image ?? '').trim();
      foodImageById.set(String(f._id), stored ? toPublicFileUrl(req, stored) : '');
    }
  }

  if (nutritionIds.size) {
    const nutritionRows = await NutritionItem.find({
      _id: { $in: [...nutritionIds] },
      status: 'Active',
    })
      .select('imagePath')
      .lean();
    for (const n of nutritionRows) {
      const stored = String(n.imagePath ?? '').trim();
      nutritionImageById.set(String(n._id), stored ? toPublicFileUrl(req, stored) : '');
    }
  }

  return list.map((log) => {
    const base = enrichMealLogForResponse(log);
    return {
      ...base,
      items: (base.items || []).map((it) => ({
        ...it,
        image: resolveItemImageFromMaps(it, foodImageById, nutritionImageById),
      })),
    };
  });
};

const indexLogsByMealType = (logs) => {
  const byType = {};
  for (const log of logs || []) {
    if (log && log.mealType) byType[log.mealType] = log;
  }
  return byType;
};

const resolveLogForScheduledSlot = (byType, mealType) => {
  if (mealType === 'Evening Snack') {
    return byType['Evening Snack'] || byType['Snack'] || null;
  }
  return byType[mealType] || null;
};

/** One entry per standard slot; legacy "Snack" maps to Evening Snack when needed */
const buildScheduledMealSlots = (logs) => {
  const byType = indexLogsByMealType(logs);
  return SCHEDULED_MEAL_TYPES.map((mealType) => {
    const log = resolveLogForScheduledSlot(byType, mealType);
    const isCompleted = log ? mealLogIsComplete(log) : false;
    return {
      mealType,
      isCompleted,
      mealLogId: log && log._id ? String(log._id) : null,
      hasItems: !!(log && Array.isArray(log.items) && log.items.length > 0),
      completedAt: log ? resolvedCompletedAtForResponse(log) : null,
    };
  });
};

const countCompletedScheduledSlots = (logs) =>
  buildScheduledMealSlots(logs).filter((s) => s.isCompleted).length;

module.exports = {
  SCHEDULED_MEAL_TYPES,
  mealLogIsComplete,
  toIsoOrNull,
  resolvedCompletedAtForResponse,
  enrichMealLogForResponse,
  enrichMealLogsWithItemImages,
  buildScheduledMealSlots,
  countCompletedScheduledSlots,
};
