/**
 * Shared meal-log completion helpers for nutrition GET/POST responses
 * (dashboard, nutrition summary, /nutrition/meals, completion APIs).
 */

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

const enrichMealLogForResponse = (log) => {
  if (!log) return log;
  const sortedItems = [...(log.items || [])].sort((a, b) =>
    String(a.mealTime || '').localeCompare(String(b.mealTime || ''))
  );
  return {
    ...log,
    items: sortedItems,
    isCompleted: mealLogIsComplete(log),
    completedAt: log.completedAt != null ? log.completedAt : null,
  };
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
      completedAt: log && log.completedAt ? log.completedAt : null,
    };
  });
};

const countCompletedScheduledSlots = (logs) =>
  buildScheduledMealSlots(logs).filter((s) => s.isCompleted).length;

module.exports = {
  SCHEDULED_MEAL_TYPES,
  mealLogIsComplete,
  enrichMealLogForResponse,
  buildScheduledMealSlots,
  countCompletedScheduledSlots,
};
