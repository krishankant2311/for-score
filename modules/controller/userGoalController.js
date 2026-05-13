const UserGoal = require('../model/userGoalModel');
const User = require('../model/userModel');

const toNumber = (val, fallback = null) => {
  if (val === '' || val == null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

const toBool = (val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return ['true', '1', 'yes', 'y', 'on'].includes(s);
  }
  return false;
};

// Public goal payload that matches the dashboard's progress card.
// Percent is always 0–100 to keep the UI bar simple.
const buildGoalView = (goal) => {
  if (!goal) return null;
  const target = Number(goal.targetValue || 0);
  const start = Number(goal.startValue || 0);
  const current = Number(goal.currentValue || 0);

  // For "reduce" goals (e.g. weight loss) start > target. We compute progress
  // as (progress travelled) / (total distance) so it always grows toward 100%.
  let percent = 0;
  if (target !== start) {
    percent = ((current - start) / (target - start)) * 100;
  } else if (target > 0) {
    percent = (current / target) * 100;
  }
  if (!Number.isFinite(percent)) percent = 0;
  percent = Math.max(0, Math.min(100, Math.round(percent)));

  // "To go" is the absolute remaining distance regardless of direction.
  const toGo = Math.max(0, Math.abs(target - current));

  return {
    _id: goal._id,
    title: goal.title,
    category: goal.category,
    subtitle: goal.subtitle || goal.category,
    startValue: start,
    currentValue: current,
    targetValue: target,
    unit: goal.unit || '',
    isPrimary: !!goal.isPrimary,
    isCompleted: !!goal.isCompleted,
    completedAt: goal.completedAt,
    targetDate: goal.targetDate,
    notes: goal.notes || '',
    progress: {
      percent,
      toGo,
      label: `${current}${goal.unit ? ` ${goal.unit}` : ''} / ${target}${goal.unit ? ` ${goal.unit}` : ''}`,
    },
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
};

// Ensures only one goal per user is flagged primary.
const clearOtherPrimaries = async (userId, exceptId = null) => {
  const filter = { userId, isPrimary: true, status: { $ne: 'Deleted' } };
  if (exceptId) filter._id = { $ne: exceptId };
  await UserGoal.updateMany(filter, { $set: { isPrimary: false } });
};

const requireUser = async (req, res) => {
  const user_id = req.token?._id;
  const user = await User.findById(user_id);
  if (!user) {
    res.status(400).json({ success: false, message: 'User not found' });
    return null;
  }
  return user;
};

// POST /api/user/goals
const addGoal = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const { title, category, subtitle, unit, notes, targetDate } = req.body;
    const targetValue = toNumber(req.body.targetValue, null);
    const startValue = toNumber(req.body.startValue, 0);
    const currentValue = toNumber(req.body.currentValue, startValue);
    const isPrimary = toBool(req.body.isPrimary);

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }
    if (targetValue == null) {
      return res.status(400).json({ success: false, message: 'targetValue is required (number)' });
    }

    const goal = await UserGoal.create({
      userId: user._id,
      title: String(title).trim(),
      category: category || 'Custom',
      subtitle: subtitle || '',
      startValue,
      currentValue,
      targetValue,
      unit: unit || '',
      notes: notes || '',
      targetDate: targetDate ? new Date(targetDate) : null,
      isPrimary,
    });

    if (isPrimary) await clearOtherPrimaries(user._id, goal._id);

    return res.json({
      success: true,
      message: 'Goal created successfully',
      result: buildGoalView(goal.toObject()),
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

// GET /api/user/goals
const getAllGoals = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const goals = await UserGoal.find({
      userId: user._id,
      status: { $ne: 'Deleted' },
    })
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean();

    const views = goals.map(buildGoalView);
    const completed = views.filter((g) => g.isCompleted).length;

    return res.json({
      success: true,
      message: 'Goals fetched successfully',
      result: {
        progressTracker: {
          completed,
          total: views.length,
          label: `${completed} of ${views.length} completed`,
        },
        primaryGoal: views.find((g) => g.isPrimary) || null,
        goals: views,
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

// GET /api/user/goals/:id
const getGoalById = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const goal = await UserGoal.findOne({
      _id: req.params.id,
      userId: user._id,
      status: { $ne: 'Deleted' },
    }).lean();

    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }
    return res.json({
      success: true,
      message: 'Goal fetched successfully',
      result: buildGoalView(goal),
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

// POST /api/user/goals/:id
const updateGoal = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const goal = await UserGoal.findOne({
      _id: req.params.id,
      userId: user._id,
      status: { $ne: 'Deleted' },
    });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    const fields = ['title', 'category', 'subtitle', 'unit', 'notes'];
    for (const f of fields) {
      if (req.body[f] != null) goal[f] = String(req.body[f]).trim();
    }

    if (req.body.targetValue != null) {
      const v = toNumber(req.body.targetValue, null);
      if (v == null) {
        return res.status(400).json({ success: false, message: 'targetValue must be a number' });
      }
      goal.targetValue = v;
    }
    if (req.body.startValue != null) {
      const v = toNumber(req.body.startValue, null);
      if (v == null) {
        return res.status(400).json({ success: false, message: 'startValue must be a number' });
      }
      goal.startValue = v;
    }
    if (req.body.currentValue != null) {
      const v = toNumber(req.body.currentValue, null);
      if (v == null) {
        return res.status(400).json({ success: false, message: 'currentValue must be a number' });
      }
      goal.currentValue = v;
    }
    if (req.body.targetDate !== undefined) {
      goal.targetDate = req.body.targetDate ? new Date(req.body.targetDate) : null;
    }
    if (req.body.isPrimary != null) {
      goal.isPrimary = toBool(req.body.isPrimary);
    }
    if (req.body.isCompleted != null) {
      const completed = toBool(req.body.isCompleted);
      goal.isCompleted = completed;
      goal.completedAt = completed ? new Date() : null;
    }

    await goal.save();
    if (goal.isPrimary) await clearOtherPrimaries(user._id, goal._id);

    return res.json({
      success: true,
      message: 'Goal updated successfully',
      result: buildGoalView(goal.toObject()),
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

// POST /api/user/goals/:id/progress  — quick endpoint to log new current value
const logGoalProgress = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const currentValue = toNumber(req.body.currentValue, null);
    if (currentValue == null) {
      return res.status(400).json({ success: false, message: 'currentValue is required (number)' });
    }

    const goal = await UserGoal.findOne({
      _id: req.params.id,
      userId: user._id,
      status: { $ne: 'Deleted' },
    });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    goal.currentValue = currentValue;
    // Auto-mark complete when we hit/exceed the target in the goal's direction.
    if (!goal.isCompleted) {
      const increasing = goal.targetValue >= goal.startValue;
      const hit = increasing
        ? goal.currentValue >= goal.targetValue
        : goal.currentValue <= goal.targetValue;
      if (hit) {
        goal.isCompleted = true;
        goal.completedAt = new Date();
      }
    }
    await goal.save();

    return res.json({
      success: true,
      message: 'Goal progress updated',
      result: buildGoalView(goal.toObject()),
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

// POST /api/user/goals/:id/primary  — mark this goal as the primary target
const setPrimaryGoal = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const goal = await UserGoal.findOne({
      _id: req.params.id,
      userId: user._id,
      status: { $ne: 'Deleted' },
    });
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    await clearOtherPrimaries(user._id, goal._id);
    goal.isPrimary = true;
    await goal.save();

    return res.json({
      success: true,
      message: 'Primary goal updated',
      result: buildGoalView(goal.toObject()),
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

// POST /api/user/goals/:id/delete  — soft delete
const deleteGoal = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const goal = await UserGoal.findOne({
      _id: req.params.id,
      userId: user._id,
    });
    if (!goal || goal.status === 'Deleted') {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }

    goal.status = 'Deleted';
    goal.isPrimary = false;
    await goal.save();

    return res.json({
      success: true,
      message: 'Goal deleted successfully',
      result: { _id: goal._id },
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

// ---------- Auto-managed Primary Weight Goal ---------------------------------
//
// Called from userController whenever the user updates weight, targetweight,
// or fitnessTarget. Mirrors those profile fields into a real UserGoal so the
// dashboard "PRIMARY TARGET" tile shows the user's weight journey without
// asking them to add a goal manually.
//
// Behavior:
//   - Only one auto goal per user (source: 'system:weight'). Re-synced in-place.
//   - Title and category derived from current vs. target weight:
//        target  <  weight  → "Weight Loss" — "Lose X lbs"
//        target  >  weight  → "Weight Gain" — "Gain X lbs"
//        target === weight  → "Custom"      — "Maintain X lbs"
//   - We only flip `isPrimary` to true when the user has NO other primary
//     goal yet. If they already chose a different goal as primary (e.g.
//     Run 5K), we leave that alone and keep the weight goal as a regular
//     entry in the list.
//   - Returns null when the profile doesn't have enough data (weight or
//     targetweight missing / zero).
const syncPrimaryWeightGoal = async (user) => {
  if (!user || !user._id) return null;
  const weight = Number(user.weight);
  const target = Number(user.targetweight);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  if (!Number.isFinite(target) || target <= 0) return null;

  const diff = Math.abs(target - weight);
  let category;
  let title;
  let subtitle;
  if (target < weight) {
    category = 'Weight Loss';
    title = `Lose ${Math.round(diff)} lbs`;
    subtitle = 'Weight Loss';
  } else if (target > weight) {
    category = 'Weight Gain';
    title = `Gain ${Math.round(diff)} lbs`;
    subtitle = 'Weight Gain';
  } else {
    category = 'Custom';
    title = `Maintain ${Math.round(weight)} lbs`;
    subtitle = 'Maintain Weight';
  }

  // Look up existing auto goal first; if missing, see whether the user
  // already has any primary set so we know whether to mark this one primary.
  const [autoGoal, anyPrimary] = await Promise.all([
    UserGoal.findOne({
      userId: user._id,
      source: 'system:weight',
      status: { $ne: 'Deleted' },
    }),
    UserGoal.findOne({
      userId: user._id,
      isPrimary: true,
      status: { $ne: 'Deleted' },
    }),
  ]);

  if (autoGoal) {
    autoGoal.title = title;
    autoGoal.category = category;
    autoGoal.subtitle = subtitle;
    // Preserve startValue (the user's weight when the goal was first created)
    // so the progress bar grows as they get closer to the target. Only the
    // CURRENT weight and TARGET weight are kept in lockstep with profile.
    autoGoal.currentValue = weight;
    autoGoal.targetValue = target;
    autoGoal.unit = 'lbs';
    // Auto-complete when user reaches the target (direction-aware).
    if (!autoGoal.isCompleted) {
      const increasing = target >= autoGoal.startValue;
      const hit = increasing ? weight >= target : weight <= target;
      if (hit) {
        autoGoal.isCompleted = true;
        autoGoal.completedAt = new Date();
      }
    }
    // Promote to primary only if no other user-chosen primary exists.
    // (autoGoal itself counts as primary if it already was.)
    if (!anyPrimary || String(anyPrimary._id) === String(autoGoal._id)) {
      autoGoal.isPrimary = true;
    }
    await autoGoal.save();
    if (autoGoal.isPrimary) await clearOtherPrimaries(user._id, autoGoal._id);
    return autoGoal;
  }

  const shouldBePrimary = !anyPrimary;
  const created = await UserGoal.create({
    userId: user._id,
    title,
    category,
    subtitle,
    startValue: weight,
    currentValue: weight,
    targetValue: target,
    unit: 'lbs',
    isPrimary: shouldBePrimary,
    source: 'system:weight',
  });
  if (shouldBePrimary) await clearOtherPrimaries(user._id, created._id);
  return created;
};

module.exports = {
  addGoal,
  getAllGoals,
  getGoalById,
  updateGoal,
  logGoalProgress,
  setPrimaryGoal,
  deleteGoal,
  buildGoalView,
  syncPrimaryWeightGoal,
};
