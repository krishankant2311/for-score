const BodyWeightLog = require('../model/bodyWeightLogModel');
const User = require('../model/userModel');
const { syncPrimaryWeightGoal } = require('./userGoalController');

const MAX_ACTIVE_LOGS = 365;
const DEFAULT_HISTORY_LIMIT = 30;
const MAX_HISTORY_LIMIT = 100;

const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDateKey = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const safeSyncWeightGoal = async (user) => {
  try {
    await syncPrimaryWeightGoal(user);
  } catch (e) {
    console.error('syncPrimaryWeightGoal failed:', e.message);
  }
};

const syncProfileWeightFromLatestLog = async (user) => {
  const latest = await BodyWeightLog.findOne({
    userId: user._id,
    status: { $ne: 'Deleted' },
  })
    .sort({ date: -1 })
    .lean();

  if (latest && Number.isFinite(Number(latest.weight))) {
    user.weight = Number(latest.weight);
    await user.save();
    await safeSyncWeightGoal(user);
  }
};

const buildBodyWeightView = (log) => {
  if (!log) return null;
  const weight = Number(log.weight);
  return {
    _id: log._id,
    date: formatDateKey(log.date),
    weight,
    unit: log.unit || 'lbs',
    label: `${weight} lbs`,
    updatedAt: log.updatedAt,
    createdAt: log.createdAt,
  };
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

const parseWeight = (raw) => {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 1000) return null;
  return n;
};

// POST /api/user/body-weight  — log or update weight for a day (default: today)
// Body: { weight: 185, date?: 'YYYY-MM-DD' }
const upsertBodyWeightLog = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const weight = parseWeight(req.body.weight);
    if (weight == null) {
      return res.status(400).json({
        success: false,
        message: 'Valid weight is required (lbs, greater than 0)',
      });
    }

    const date = normalizeDate(req.body.date);
    if (!date) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    let log = await BodyWeightLog.findOne({ userId: user._id, date });
    const isNew = !log;

    if (isNew) {
      const activeCount = await BodyWeightLog.countDocuments({
        userId: user._id,
        status: { $ne: 'Deleted' },
      });
      if (activeCount >= MAX_ACTIVE_LOGS) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${MAX_ACTIVE_LOGS} body weight entries reached. Delete old entries first.`,
        });
      }
      log = new BodyWeightLog({
        userId: user._id,
        date,
        weight,
        unit: 'lbs',
      });
    } else {
      log.weight = weight;
      log.unit = 'lbs';
      log.status = 'Active';
    }

    await log.save();
    await syncProfileWeightFromLatestLog(user);

    return res.json({
      success: true,
      message: isNew ? 'Body weight logged successfully' : 'Body weight updated successfully',
      result: buildBodyWeightView(log.toObject()),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Body weight already logged for this date',
      });
    }
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
};

// GET /api/user/body-weight?date=YYYY-MM-DD
const getBodyWeightForDate = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const date = normalizeDate(req.query.date);
    if (!date) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const log = await BodyWeightLog.findOne({
      userId: user._id,
      date,
      status: { $ne: 'Deleted' },
    }).lean();

    return res.json({
      success: true,
      message: log ? 'Body weight fetched' : 'No body weight for this date',
      result: {
        date: formatDateKey(date),
        log: buildBodyWeightView(log),
        profileWeight: Number(user.weight) || null,
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

// GET /api/user/body-weight/latest
const getLatestBodyWeight = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const log = await BodyWeightLog.findOne({
      userId: user._id,
      status: { $ne: 'Deleted' },
    })
      .sort({ date: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Latest body weight fetched',
      result: {
        log: buildBodyWeightView(log),
        profileWeight: Number(user.weight) || null,
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

// GET /api/user/body-weight/history?limit=30
const getBodyWeightHistory = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    let limit = Number(req.query.limit);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_HISTORY_LIMIT;
    limit = Math.min(Math.floor(limit), MAX_HISTORY_LIMIT);

    const logs = await BodyWeightLog.find({
      userId: user._id,
      status: { $ne: 'Deleted' },
    })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      message: 'Body weight history fetched',
      result: logs.map(buildBodyWeightView),
      meta: { limit, count: logs.length },
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

// POST /api/user/body-weight/:id/delete
const deleteBodyWeightLog = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const log = await BodyWeightLog.findOne({
      _id: req.params.id,
      userId: user._id,
      status: { $ne: 'Deleted' },
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Body weight log not found',
      });
    }

    log.status = 'Deleted';
    await log.save();
    await syncProfileWeightFromLatestLog(user);

    const freshUser = await User.findById(user._id);

    return res.json({
      success: true,
      message: 'Body weight log deleted',
      result: {
        profileWeight: freshUser ? Number(freshUser.weight) || null : null,
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
  upsertBodyWeightLog,
  getBodyWeightForDate,
  getLatestBodyWeight,
  getBodyWeightHistory,
  deleteBodyWeightLog,
};
