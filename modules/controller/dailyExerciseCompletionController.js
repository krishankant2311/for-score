const User = require('../model/userModel');
const DailyExerciseCompletion = require('../model/dailyExerciseCompletionModel');

const normalizeCalendarDate = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDailyExerciseCompletions = async (req, res) => {
  try {
    const user_id = req.token?._id;
    if (!(await User.findById(user_id))) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const normalizedDate = normalizeCalendarDate(req.query.date);
    const doc = await DailyExerciseCompletion.findOne({
      userId: user_id,
      date: normalizedDate,
    }).lean();

    return res.json({
      success: true,
      message: 'Daily completions fetched',
      result: {
        date: normalizedDate,
        completedSlotKeys: doc?.completedSlotKeys || [],
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

const putDailyExerciseCompletions = async (req, res) => {
  try {
    const user_id = req.token?._id;
    if (!(await User.findById(user_id))) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const { date } = req.body || {};
    const normalizedDate = normalizeCalendarDate(date);

    let keysRaw = req.body.completedSlotKeys ?? [];
    if (!Array.isArray(keysRaw)) {
      keysRaw = keysRaw != null && keysRaw !== '' ? [keysRaw] : [];
    }
    const completedSlotKeys = [
      ...new Set(keysRaw.map((k) => String(k).trim()).filter(Boolean)),
    ];

    const doc = await DailyExerciseCompletion.findOneAndUpdate(
      { userId: user_id, date: normalizedDate },
      {
        $set: { completedSlotKeys },
        $setOnInsert: { userId: user_id, date: normalizedDate },
      },
      { new: true, upsert: true }
    ).lean();

    return res.json({
      success: true,
      message: 'Daily completions updated',
      result: {
        date: normalizedDate,
        completedSlotKeys: doc?.completedSlotKeys || [],
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

/**
 * POST body: slotKey (required), date (optional), completed (boolean, default true).
 * Adds or removes one slot key for that calendar day without replacing the full list.
 */
const postTodayExerciseSlotCompletion = async (req, res) => {
  try {
    const user_id = req.token?._id;
    if (!(await User.findById(user_id))) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const { date, slotKey, completed } = req.body || {};
    const k = String(slotKey || '').trim();
    if (!k) {
      return res.status(400).json({ success: false, message: 'slotKey is required' });
    }

    const normalizedDate = normalizeCalendarDate(date);
    const done =
      completed === undefined ||
      completed === null ||
      completed === true ||
      completed === 'true' ||
      completed === 1 ||
      completed === '1';

    const existing = await DailyExerciseCompletion.findOne({
      userId: user_id,
      date: normalizedDate,
    }).lean();
    let keys = [...(existing?.completedSlotKeys || []).map((x) => String(x).trim()).filter(Boolean)];
    if (done) {
      if (!keys.includes(k)) keys.push(k);
    } else {
      keys = keys.filter((x) => x !== k);
    }

    const doc = await DailyExerciseCompletion.findOneAndUpdate(
      { userId: user_id, date: normalizedDate },
      {
        $set: { completedSlotKeys: keys },
        $setOnInsert: { userId: user_id, date: normalizedDate },
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({
      success: true,
      message: done ? 'Marked complete for this day' : 'Marked incomplete for this day',
      result: {
        date: normalizedDate,
        slot_key: k,
        completed: done,
        completed_slot_keys: doc?.completedSlotKeys || [],
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
  getDailyExerciseCompletions,
  putDailyExerciseCompletions,
  postTodayExerciseSlotCompletion,
};
