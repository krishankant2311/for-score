const User = require('../model/userModel');
const SleepLog = require('../model/sleepLogModel');

const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// 1. Add or update sleep log for a given date
const addOrUpdateSleepLog = async (req, res) => {
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

    const { date, startTime, endTime, totalHours, quality } = req.body;
    const normalizedDate = normalizeDate(date);

    if (!totalHours) {
      return res.status(400).json({
        success: false,
        message: 'totalHours is required',
      });
    }

    const hoursNum = Number(totalHours);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid totalHours is required',
      });
    }

    let qualityVal = quality || 'Good';
    const allowedQualities = ['Poor', 'Fair', 'Good', 'Excellent'];
    if (!allowedQualities.includes(qualityVal)) {
      qualityVal = 'Good';
    }

    let log = await SleepLog.findOne({
      userId: user_id,
      date: normalizedDate,
      status: { $ne: 'Deleted' },
    });

    if (!log) {
      log = await SleepLog.create({
        userId: user_id,
        date: normalizedDate,
        startTime: startTime || '',
        endTime: endTime || '',
        totalHours: hoursNum,
        quality: qualityVal,
      });
    } else {
      if (startTime != null) log.startTime = startTime;
      if (endTime != null) log.endTime = endTime;
      log.totalHours = hoursNum;
      log.quality = qualityVal;
      await log.save();
    }

    return res.json({
      success: true,
      message: 'Sleep log saved successfully',
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

// 2. Get sleep log for a specific date
const getSleepLogByDate = async (req, res) => {
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

    const log = await SleepLog.findOne({
      userId: user_id,
      date: normalizedDate,
      status: { $ne: 'Deleted' },
    }).lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Sleep log not found',
      });
    }

    return res.json({
      success: true,
      message: 'Sleep log fetched successfully',
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

// 3. Get last 7 days sleep logs (This Week section)
const getWeeklySleepLogs = async (req, res) => {
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

    const today = normalizeDate();
    const start = new Date(today);
    start.setDate(start.getDate() - 6); // last 7 days including today

    const logs = await SleepLog.find({
      userId: user_id,
      date: { $gte: start, $lte: today },
      status: { $ne: 'Deleted' },
    })
      .sort({ date: 1 })
      .lean();

    return res.json({
      success: true,
      message: 'Weekly sleep logs fetched successfully',
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

// 4. Sleep summary (avg hours, streak, last night, quality summary)
const getSleepSummary = async (req, res) => {
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

    const today = normalizeDate();
    const start = new Date(today);
    start.setDate(start.getDate() - 6);

    const logs = await SleepLog.find({
      userId: user_id,
      date: { $gte: start, $lte: today },
      status: { $ne: 'Deleted' },
    })
      .sort({ date: 1 })
      .lean();

    if (!logs.length) {
      return res.json({
        success: true,
        message: 'No sleep data available',
        result: {
          avgHours: 0,
          dayStreak: 0,
          qualitySummary: null,
          lastNight: null,
        },
      });
    }

    const totalHours = logs.reduce((sum, l) => sum + (l.totalHours || 0), 0);
    const avgHours = totalHours / logs.length;

    const logsByDate = new Map();
    logs.forEach((l) => {
      logsByDate.set(new Date(l.date).toDateString(), l);
    });

    let streak = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (logsByDate.has(d.toDateString())) {
        streak += 1;
      } else {
        break;
      }
    }

    const qualityCounts = { Poor: 0, Fair: 0, Good: 0, Excellent: 0 };
    logs.forEach((l) => {
      if (qualityCounts[l.quality] != null) {
        qualityCounts[l.quality] += 1;
      }
    });

    let qualitySummary = 'Fair';
    if (qualityCounts.Excellent + qualityCounts.Good >= qualityCounts.Fair + qualityCounts.Poor) {
      qualitySummary = 'Good';
    } else if (qualityCounts.Poor > qualityCounts.Good + qualityCounts.Excellent) {
      qualitySummary = 'Poor';
    }

    const lastNight = logs[logs.length - 1];

    return res.json({
      success: true,
      message: 'Sleep summary fetched successfully',
      result: {
        avgHours,
        dayStreak: streak,
        qualitySummary,
        lastNight,
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

// 5. Soft delete a sleep log by id
const deleteSleepLog = async (req, res) => {
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
    const log = await SleepLog.findOne({
      _id: id,
      userId: user_id,
    });

    if (!log || log.status === 'Deleted') {
      return res.status(404).json({
        success: false,
        message: 'Sleep log not found',
      });
    }

    log.status = 'Deleted';
    await log.save();

    return res.json({
      success: true,
      message: 'Sleep log deleted successfully',
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
  addOrUpdateSleepLog,
  getSleepLogByDate,
  getWeeklySleepLogs,
  getSleepSummary,
  deleteSleepLog,
};

