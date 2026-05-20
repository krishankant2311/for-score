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
  buildScheduledMealSlots,
  countCompletedScheduledSlots,
};
