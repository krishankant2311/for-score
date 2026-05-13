const WaterLog = require('../model/waterLogModel');
const User = require('../model/userModel');

const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const toNumber = (val, fallback = null) => {
  if (val === '' || val == null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

const buildWaterView = (log) => {
  if (!log) {
    return {
      cups: 0,
      target: 8,
      remaining: 8,
      percent: 0,
      label: '0 / 8 cups',
    };
  }
  const cups = Math.max(0, Number(log.cups || 0));
  const target = Math.max(1, Number(log.target || 8));
  const remaining = Math.max(0, target - cups);
  const percent = Math.min(100, Math.round((cups / target) * 100));
  return {
    _id: log._id,
    date: log.date,
    cups,
    target,
    remaining,
    percent,
    label: `${cups} / ${target} cups`,
    updatedAt: log.updatedAt,
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

// GET /api/user/water/today?date=YYYY-MM-DD
const getWaterForDate = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const date = normalizeDate(req.query.date);
    if (!date) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const log = await WaterLog.findOne({
      userId: user._id,
      date,
      status: { $ne: 'Deleted' },
    }).lean();

    return res.json({
      success: true,
      message: 'Water log fetched',
      result: { date, ...buildWaterView(log) },
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

// POST /api/user/water  — increment / decrement / set cups for a date.
// Body: { date?: 'YYYY-MM-DD', cups?: 5, delta?: +1|-1, target?: 8 }
// Precedence: explicit `cups` wins; otherwise `delta` is applied to existing.
const upsertWaterLog = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const date = normalizeDate(req.body.date);
    if (!date) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const explicitCups = toNumber(req.body.cups, null);
    const delta = toNumber(req.body.delta, null);
    const target = toNumber(req.body.target, null);

    let log = await WaterLog.findOne({ userId: user._id, date });
    if (!log) {
      log = new WaterLog({
        userId: user._id,
        date,
        cups: 0,
        target: target != null ? target : 8,
      });
    }

    if (explicitCups != null) {
      log.cups = Math.max(0, explicitCups);
    } else if (delta != null) {
      log.cups = Math.max(0, Number(log.cups || 0) + delta);
    } else if (explicitCups == null && delta == null && target == null) {
      return res.status(400).json({
        success: false,
        message: 'Provide cups, delta, or target',
      });
    }

    if (target != null) log.target = target;
    log.status = 'Active';
    await log.save();

    return res.json({
      success: true,
      message: 'Water log updated',
      result: { date, ...buildWaterView(log.toObject()) },
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
  getWaterForDate,
  upsertWaterLog,
  buildWaterView,
  normalizeDate,
};
