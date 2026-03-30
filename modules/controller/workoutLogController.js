const User = require('../model/userModel');
const WorkoutLog = require('../model/workoutLogModel');

const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// 1. Add or update workout log for a single exercise on a given date
const addOrUpdateWorkoutLog = async (req, res) => {
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

    const { date, exerciseName, sets, notes } = req.body;
    const normalizedDate = normalizeDate(date);

    if (!exerciseName) {
      return res.status(400).json({
        success: false,
        message: 'exerciseName is required',
      });
    }

    let parsedSets = [];
    if (Array.isArray(sets)) {
      parsedSets = sets;
    } else if (typeof sets === 'string' && sets.trim()) {
      try {
        parsedSets = JSON.parse(sets);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'sets must be a valid JSON array',
        });
      }
    }

    if (!parsedSets.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one set is required',
      });
    }

    const cleanedSets = parsedSets.map((s, idx) => ({
      setNumber: Number(s.setNumber || idx + 1),
      weight: Number(s.weight || 0),
      reps: Number(s.reps || 0),
      previousWeight:
        s.previousWeight != null && s.previousWeight !== '' ? Number(s.previousWeight) : null,
      previousReps:
        s.previousReps != null && s.previousReps !== '' ? Number(s.previousReps) : null,
    }));

    if (cleanedSets.some((s) => Number.isNaN(s.weight) || Number.isNaN(s.reps))) {
      return res.status(400).json({
        success: false,
        message: 'Each set must have valid numeric weight and reps',
      });
    }

    let log = await WorkoutLog.findOne({
      userId: user_id,
      date: normalizedDate,
      exerciseName: exerciseName.trim(),
      status: { $ne: 'Deleted' },
    });

    if (!log) {
      log = await WorkoutLog.create({
        userId: user_id,
        date: normalizedDate,
        exerciseName: exerciseName.trim(),
        notes: (notes || '').trim(),
        sets: cleanedSets,
      });
    } else {
      log.sets = cleanedSets;
      if (notes != null) log.notes = (notes || '').trim();
      await log.save();
    }

    return res.json({
      success: true,
      message: 'Workout log saved successfully',
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

// 2. Get all workouts for a given date (for "Today’s Session" + list)
const getWorkoutLogsByDate = async (req, res) => {
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

    const { date } = req.query;
    const normalizedDate = normalizeDate(date);

    const logs = await WorkoutLog.find({
      userId: user_id,
      date: normalizedDate,
      status: { $ne: 'Deleted' },
    })
      .sort({ exerciseName: 1 })
      .lean();

    return res.json({
      success: true,
      message: 'Workout logs fetched successfully',
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

// 3. Get summary for a given date (Today’s Session card)
const getWorkoutSummaryByDate = async (req, res) => {
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

    const { date } = req.query;
    const normalizedDate = normalizeDate(date);

    const logs = await WorkoutLog.find({
      userId: user_id,
      date: normalizedDate,
      status: { $ne: 'Deleted' },
    }).lean();

    if (!logs.length) {
      return res.json({
        success: true,
        message: 'No workout data for this date',
        result: {
          totalExercises: 0,
          totalSets: 0,
          totalVolume: 0,
        },
      });
    }

    let totalSets = 0;
    let totalVolume = 0; // sum of weight * reps across all sets
    logs.forEach((log) => {
      (log.sets || []).forEach((s) => {
        totalSets += 1;
        totalVolume += (s.weight || 0) * (s.reps || 0);
      });
    });

    return res.json({
      success: true,
      message: 'Workout summary fetched successfully',
      result: {
        totalExercises: logs.length,
        totalSets,
        totalVolume,
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

// 4. Get history for a specific exercise (for cards history)
const getWorkoutHistoryByExercise = async (req, res) => {
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

    const { exerciseName } = req.query;
    if (!exerciseName) {
      return res.status(400).json({
        success: false,
        message: 'exerciseName is required',
      });
    }

    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit) || 10));

    const logs = await WorkoutLog.find({
      userId: user_id,
      exerciseName: exerciseName.trim(),
      status: { $ne: 'Deleted' },
    })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      message: 'Workout history fetched successfully',
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

// 5. Get single workout log by id
const getWorkoutLogById = async (req, res) => {
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
    const log = await WorkoutLog.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    }).lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Workout log not found',
      });
    }

    return res.json({
      success: true,
      message: 'Workout log fetched successfully',
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

// 6. Soft delete workout log
const deleteWorkoutLog = async (req, res) => {
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
    const log = await WorkoutLog.findOne({
      _id: id,
      userId: user_id,
    });

    if (!log || log.status === 'Deleted') {
      return res.status(404).json({
        success: false,
        message: 'Workout log not found',
      });
    }

    log.status = 'Deleted';
    await log.save();

    return res.json({
      success: true,
      message: 'Workout log deleted successfully',
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
  addOrUpdateWorkoutLog,
  getWorkoutLogsByDate,
  getWorkoutSummaryByDate,
  getWorkoutHistoryByExercise,
  getWorkoutLogById,
  deleteWorkoutLog,
};

