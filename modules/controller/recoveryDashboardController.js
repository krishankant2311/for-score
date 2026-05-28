const User = require('../model/userModel');
const SleepLog = require('../model/sleepLogModel');
const WaterLog = require('../model/waterLogModel');
const RecoveryContent = require('../model/recoveryContentModel');
const { buildWaterView } = require('./waterLogController');

const normalizeDate = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const toHoursLabel = (hours) => `${Number(hours || 0).toFixed(1)}h`;

const toTimeLabel = (raw) => {
  const str = String(raw || '').trim();
  if (!str) return '';
  const [hRaw, mRaw] = str.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return str;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

const safePercent = (current, target) => {
  const c = Number(current || 0);
  const t = Number(target || 0);
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
};

const buildSleepPhaseDistribution = (log) => {
  if (!log) {
    return {
      totalMinutes: 0,
      phases: {
        deep: { minutes: 0, percent: 0 },
        rem: { minutes: 0, percent: 0 },
        light: { minutes: 0, percent: 0 },
      },
    };
  }

  const fallbackTotalMinutes = Math.max(0, Math.round(Number(log.totalHours || 0) * 60));
  const isAutoSplit = String(log.phaseSplitType || '').toLowerCase() === 'auto';
  const deepRaw = Number(log.deepSleepMinutes);
  const remRaw = Number(log.remSleepMinutes);
  const lightRaw = Number(log.lightSleepMinutes);
  const hasStoredPhaseMinutes =
    Number.isFinite(deepRaw) &&
    deepRaw >= 0 &&
    Number.isFinite(remRaw) &&
    remRaw >= 0 &&
    Number.isFinite(lightRaw) &&
    lightRaw >= 0;

  let deepMinutes = 0;
  let remMinutes = 0;
  let lightMinutes = 0;

  if (hasStoredPhaseMinutes) {
    deepMinutes = Math.round(deepRaw);
    remMinutes = Math.round(remRaw);
    lightMinutes = Math.round(lightRaw);
  } else if (fallbackTotalMinutes > 0) {
    // Backward-compatible fallback for old logs: 30/20/50 split.
    deepMinutes = Math.round(fallbackTotalMinutes * 0.3);
    remMinutes = Math.round(fallbackTotalMinutes * 0.2);
    lightMinutes = Math.max(0, fallbackTotalMinutes - deepMinutes - remMinutes);
  }

  const totalMinutes = deepMinutes + remMinutes + lightMinutes;
  if (totalMinutes <= 0) {
    return {
      totalMinutes: 0,
      phases: {
        deep: { minutes: 0, percent: 0 },
        rem: { minutes: 0, percent: 0 },
        light: { minutes: 0, percent: 0 },
      },
    };
  }

  if (isAutoSplit) {
    return {
      totalMinutes,
      phases: {
        deep: { minutes: deepMinutes, percent: 30 },
        rem: { minutes: remMinutes, percent: 20 },
        light: { minutes: lightMinutes, percent: 50 },
      },
    };
  }

  const deepPercent = Math.round((deepMinutes / totalMinutes) * 100);
  const remPercent = Math.round((remMinutes / totalMinutes) * 100);
  const lightPercent = Math.max(0, 100 - deepPercent - remPercent);

  return {
    totalMinutes,
    phases: {
      deep: { minutes: deepMinutes, percent: deepPercent },
      rem: { minutes: remMinutes, percent: remPercent },
      light: { minutes: lightMinutes, percent: lightPercent },
    },
  };
};

const buildSleepSummary = (logs) => {
  if (!logs.length) {
    return {
      avgHours: 0,
      dayStreak: 0,
      qualitySummary: 'Fair',
      lastNight: null,
      avgHoursLabel: '0.0h',
    };
  }

  const totalHours = logs.reduce((sum, item) => sum + Number(item.totalHours || 0), 0);
  const avgHours = totalHours / logs.length;
  const avgHoursLabel = toHoursLabel(avgHours);

  const today = normalizeDate();
  const logsByDate = new Map(
    logs.map((item) => [normalizeDate(item.date).toDateString(), item])
  );
  let dayStreak = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (logsByDate.has(d.toDateString())) dayStreak += 1;
    else break;
  }

  const qualityCounts = { Poor: 0, Fair: 0, Good: 0, Excellent: 0 };
  logs.forEach((item) => {
    if (qualityCounts[item.quality] != null) qualityCounts[item.quality] += 1;
  });

  let qualitySummary = 'Fair';
  if (qualityCounts.Excellent + qualityCounts.Good >= qualityCounts.Fair + qualityCounts.Poor) {
    qualitySummary = 'Good';
  } else if (qualityCounts.Poor > qualityCounts.Good + qualityCounts.Excellent) {
    qualitySummary = 'Poor';
  }

  const lastNight = logs[logs.length - 1];
  return {
    avgHours,
    dayStreak,
    qualitySummary,
    lastNight,
    avgHoursLabel,
  };
};

const buildWellnessCards = ({ sleepHours, sleepTargetHours, hydrationPercent }) => {
  const sleepPercent = safePercent(sleepHours, sleepTargetHours);
  const stressLevel = sleepPercent >= 100 ? 'Low' : sleepPercent >= 80 ? 'Moderate' : 'High';
  const energyLevel = sleepPercent >= 100 ? 'High' : sleepPercent >= 80 ? 'Good' : 'Low';
  const soreness = hydrationPercent >= 80 ? 'Mild' : 'Moderate';
  const mood = sleepPercent >= 100 && hydrationPercent >= 80 ? 'Excellent' : 'Good';

  return [
    { key: 'stress', title: 'Stress Level', value: stressLevel },
    { key: 'energy', title: 'Energy', value: energyLevel },
    { key: 'mood', title: 'Mood', value: mood },
    { key: 'soreness', title: 'Soreness', value: soreness },
  ];
};

const loadWeeklySleepLogs = async (userId, referenceDate) => {
  const end = normalizeDate(referenceDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return SleepLog.find({
    userId,
    date: { $gte: start, $lte: end },
    status: { $ne: 'Deleted' },
  })
    .sort({ date: 1 })
    .lean();
};

const getRecoverPageData = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) return res.status(400).json({ success: false, message: 'User not found' });

    const referenceDate = normalizeDate(req.query.date);
    if (!referenceDate) {
      return res.status(400).json({ success: false, message: 'Invalid date query' });
    }

    const [weeklySleepLogs, waterLog, sleepTips] = await Promise.all([
      loadWeeklySleepLogs(user._id, referenceDate),
      WaterLog.findOne({
        userId: user._id,
        date: referenceDate,
        status: { $ne: 'Deleted' },
      }).lean(),
      RecoveryContent.find({ status: 'Active', category: 'Sleep' })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean(),
    ]);

    const sleepSummary = buildSleepSummary(weeklySleepLogs);
    const lastNight = sleepSummary.lastNight || null;
    const sleepPhaseDistribution = buildSleepPhaseDistribution(lastNight);
    const hydration = buildWaterView(waterLog);
    const wellnessCards = buildWellnessCards({
      sleepHours: lastNight?.totalHours || 0,
      sleepTargetHours: 8,
      hydrationPercent: hydration.percent || 0,
    });

    return res.json({
      success: true,
      message: 'Recover page data fetched successfully',
      result: {
        date: referenceDate,
        sleep: {
          lastNight: lastNight
            ? {
                ...lastNight,
                totalHoursLabel: toHoursLabel(lastNight.totalHours),
                startTimeLabel: toTimeLabel(lastNight.startTime),
                endTimeLabel: toTimeLabel(lastNight.endTime),
              }
            : null,
          phaseDistribution: sleepPhaseDistribution,
          summary: {
            avgHours: sleepSummary.avgHours,
            avgHoursLabel: sleepSummary.avgHoursLabel,
            dayStreak: sleepSummary.dayStreak,
            qualitySummary: sleepSummary.qualitySummary,
            targetHours: 8,
          },
          weekly: weeklySleepLogs.map((item) => ({
            date: item.date,
            day: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
            totalHours: Number(item.totalHours || 0),
            totalHoursLabel: toHoursLabel(item.totalHours),
            quality: item.quality || 'Good',
          })),
        },
        hydration,
        wellness: {
          cards: wellnessCards,
        },
        sleepTips: sleepTips.map((tip, index) => ({
          _id: tip._id,
          order: index + 1,
          title: tip.title,
          description: tip.description,
          contentType: tip.contentType,
          durationOrTarget: tip.durationOrTarget || '',
        })),
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

const getSleepTrackingPageData = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) return res.status(400).json({ success: false, message: 'User not found' });

    const referenceDate = normalizeDate(req.query.date);
    if (!referenceDate) {
      return res.status(400).json({ success: false, message: 'Invalid date query' });
    }

    const [weeklySleepLogs, todayLog, latestLog, sleepTips] = await Promise.all([
      loadWeeklySleepLogs(user._id, referenceDate),
      SleepLog.findOne({
        userId: user._id,
        date: referenceDate,
        status: { $ne: 'Deleted' },
      }).lean(),
      SleepLog.findOne({
        userId: user._id,
        status: { $ne: 'Deleted' },
      })
        .sort({ date: -1 })
        .lean(),
      RecoveryContent.find({ status: 'Active', category: 'Sleep' })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean(),
    ]);

    const sleepSummary = buildSleepSummary(weeklySleepLogs);
    const baseLog = todayLog || latestLog;
    const logForCard = baseLog
      ? {
          ...baseLog,
          totalHoursLabel: toHoursLabel(baseLog.totalHours),
          startTimeLabel: toTimeLabel(baseLog.startTime),
          endTimeLabel: toTimeLabel(baseLog.endTime),
        }
      : null;

    return res.json({
      success: true,
      message: 'Sleep tracking page data fetched successfully',
      result: {
        date: referenceDate,
        headline: {
          avgHours: sleepSummary.avgHours,
          avgHoursLabel: sleepSummary.avgHoursLabel,
          targetHours: 8,
          qualitySummary: sleepSummary.qualitySummary,
        },
        lastNight: logForCard,
        adjustSleepHours: {
          min: 0,
          max: 12,
          step: 0.5,
          current: Number(logForCard?.totalHours || 0),
        },
        qualityOptions: ['Poor', 'Fair', 'Good', 'Excellent'],
        selectedQuality: logForCard?.quality || 'Good',
        weekly: weeklySleepLogs.map((item) => ({
          date: item.date,
          day: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
          totalHours: Number(item.totalHours || 0),
          totalHoursLabel: toHoursLabel(item.totalHours),
          quality: item.quality || 'Good',
        })),
        tips: sleepTips.map((tip, index) => ({
          _id: tip._id,
          order: index + 1,
          title: tip.title,
          description: tip.description,
          contentType: tip.contentType,
          durationOrTarget: tip.durationOrTarget || '',
        })),
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
  getRecoverPageData,
  getSleepTrackingPageData,
};
