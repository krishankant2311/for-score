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

module.exports = {
  getDailyExerciseCompletions,
  putDailyExerciseCompletions,
};
