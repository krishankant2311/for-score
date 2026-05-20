const User = require('../model/userModel');
const Program = require('../model/programModel');
const DailyExerciseCompletion = require('../model/dailyExerciseCompletionModel');
const {
  resolveTodaysExerciseSlots,
  normalizeCalendarDate,
  buildTodayWorkoutListItem,
} = require('./todayWorkoutController');

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

/**
 * Mark every exercise slot for the given calendar day as complete (same slotKeys as GET /workouts/today).
 * Body/query: optional date. Body: completed: false clears all slot keys for that day.
 */
const markAllWorkoutSlotsCompleteForDay = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const user = await User.findById(user_id).select('activeProgramId programStartedAt').lean();
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const dateInput = req.body?.date ?? req.query?.date;
    const refDate = dateInput ? new Date(dateInput) : new Date();
    if (Number.isNaN(refDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }
    const normalizedDate = normalizeCalendarDate(refDate);

    const clearAll =
      req.body?.completed === false ||
      req.body?.completed === 'false' ||
      req.body?.isCompleted === false;

    if (clearAll) {
      const doc = await DailyExerciseCompletion.findOneAndUpdate(
        { userId: user_id, date: normalizedDate },
        { $set: { completedSlotKeys: [] } },
        { new: true, upsert: true }
      ).lean();
      return res.json({
        success: true,
        message: 'Exercise completions cleared for this day',
        result: {
          date: normalizedDate,
          completedSlotKeys: doc?.completedSlotKeys || [],
          marked_count: 0,
        },
      });
    }

    if (!user.activeProgramId || !user.programStartedAt) {
      return res.status(400).json({
        success: false,
        message: 'No active program. Select a program first.',
      });
    }

    const program = await Program.findOne({
      _id: user.activeProgramId,
      status: 'Active',
      isDeleted: { $ne: true },
    }).lean();
    if (!program) {
      return res.status(404).json({ success: false, message: 'Active program no longer exists' });
    }

    const programIdStr = String(program._id);
    const { slots, dayType } = resolveTodaysExerciseSlots(
      program,
      user.programStartedAt,
      refDate,
      programIdStr
    );

    const keys = [...new Set(slots.map((s) => s.slotKey).filter(Boolean))];

    if (keys.length === 0) {
      const existing = await DailyExerciseCompletion.findOne({
        userId: user_id,
        date: normalizedDate,
      }).lean();
      return res.json({
        success: true,
        message: `No workout exercise slots for this day (${dayType}). Nothing to mark.`,
        result: {
          date: normalizedDate,
          day_type: dayType,
          completedSlotKeys: existing?.completedSlotKeys || [],
          marked_count: 0,
        },
      });
    }

    const doc = await DailyExerciseCompletion.findOneAndUpdate(
      { userId: user_id, date: normalizedDate },
      {
        $set: { completedSlotKeys: keys },
        $setOnInsert: { userId: user_id, date: normalizedDate },
      },
      { new: true, upsert: true }
    ).lean();

    return res.json({
      success: true,
      message: 'All exercises for this day marked complete',
      result: {
        date: normalizedDate,
        day_type: dayType,
        completedSlotKeys: doc?.completedSlotKeys || [],
        marked_count: keys.length,
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
 * GET query:
 *   - date=YYYY-MM-DD → that day's completed exercises (names, thumbnails via active program + schedule for that date)
 *   - from= & to= → each day in range with completed_slot_keys + counts (no per-exercise expand)
 */
const getCompletedExercisesByDateOrRange = async (req, res) => {
  try {
    const user_id = req.token?._id;
    if (!(await User.findById(user_id))) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const { date, from, to } = req.query || {};
    const hasRange =
      from != null &&
      String(from).trim() !== '' &&
      to != null &&
      String(to).trim() !== '';

    if (hasRange) {
      const dFrom = new Date(from);
      const dTo = new Date(to);
      if (Number.isNaN(dFrom.getTime()) || Number.isNaN(dTo.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid from or to date' });
      }
      let nf = normalizeCalendarDate(dFrom);
      let nt = normalizeCalendarDate(dTo);
      if (nf.getTime() > nt.getTime()) {
        const swap = nf;
        nf = nt;
        nt = swap;
      }

      const rows = await DailyExerciseCompletion.find({
        userId: user_id,
        date: { $gte: nf, $lte: nt },
      })
        .sort({ date: 1 })
        .lean();

      const days = rows.map((r) => ({
        date: r.date,
        completed_count: (r.completedSlotKeys || []).length,
        completed_slot_keys: r.completedSlotKeys || [],
      }));

      return res.json({
        success: true,
        message: 'Completed exercise keys by date range',
        result: {
          from: nf,
          to: nt,
          day_count: days.length,
          days,
        },
      });
    }

    if (!date || !String(date).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Provide date=YYYY-MM-DD or from= and to= (range)',
      });
    }

    const refDate = new Date(date);
    if (Number.isNaN(refDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }
    const normalizedDate = normalizeCalendarDate(refDate);

    const doc = await DailyExerciseCompletion.findOne({
      userId: user_id,
      date: normalizedDate,
    }).lean();

    const completedKeys = [...(doc?.completedSlotKeys || [])]
      .map((k) => String(k).trim())
      .filter(Boolean);
    const uniqueKeys = [...new Set(completedKeys)];

    const user = await User.findById(user_id).select('activeProgramId programStartedAt').lean();
    const exercises = [];
    let day_type = null;
    let total_slots_for_day = 0;

    if (user?.activeProgramId && user?.programStartedAt) {
      const program = await Program.findOne({
        _id: user.activeProgramId,
        status: 'Active',
        isDeleted: { $ne: true },
      }).lean();

      if (program) {
        const programIdStr = String(program._id);
        const { slots, dayType } = resolveTodaysExerciseSlots(
          program,
          user.programStartedAt,
          refDate,
          programIdStr
        );
        day_type = dayType;
        total_slots_for_day = slots.length;
        const slotByKey = new Map(slots.map((s) => [s.slotKey, s]));
        const doneSet = new Set(uniqueKeys);

        for (const slot of slots) {
          if (doneSet.has(slot.slotKey)) {
            exercises.push(buildTodayWorkoutListItem(req, slot, true));
          }
        }

        for (const key of uniqueKeys) {
          if (!slotByKey.has(key)) {
            exercises.push({
              slotKey: key,
              name: '',
              completed: true,
              orphaned: true,
              note: 'Key not in this date workout list (program or week grid may have changed since)',
            });
          }
        }
      }
    }

    if (!exercises.length && uniqueKeys.length) {
      uniqueKeys.forEach((slotKey) => {
        exercises.push({
          slotKey,
          name: '',
          completed: true,
          orphaned: true,
          note:
            user?.activeProgramId && user?.programStartedAt
              ? 'Could not resolve exercise details'
              : 'No active program — slot keys only',
        });
      });
    }

    return res.json({
      success: true,
      message: 'Completed exercises for this day',
      result: {
        date: normalizedDate,
        day_type,
        completed_slot_keys: uniqueKeys,
        completed_count: uniqueKeys.length,
        total_slots_for_day,
        exercises,
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
  markAllWorkoutSlotsCompleteForDay,
  getCompletedExercisesByDateOrRange,
};
