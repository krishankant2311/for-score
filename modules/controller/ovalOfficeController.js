const User = require('../model/userModel');
const WorkoutLog = require('../model/workoutLogModel');
const DailyExerciseCompletion = require('../model/dailyExerciseCompletionModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');

const normalizeDate = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const firstName = (fullName) => {
  if (!fullName) return '';
  return String(fullName).trim().split(/\s+/)[0] || '';
};

const profileInitial = (user) => {
  const fromName = firstName(user?.name);
  if (fromName) return fromName.charAt(0).toUpperCase();
  const email = String(user?.email || '').trim();
  if (email) return email.charAt(0).toUpperCase();
  return 'U';
};

/** Calendar days (YYYY-MM-DD) where user logged workout activity. */
const collectWorkoutDayKeys = async (userId) => {
  const dayKeys = new Set();

  const completions = await DailyExerciseCompletion.find({
    userId,
    'completedSlotKeys.0': { $exists: true },
  })
    .select('date completedSlotKeys')
    .lean();

  for (const row of completions) {
    const keys = (row.completedSlotKeys || []).map((k) => String(k).trim()).filter(Boolean);
    if (keys.length > 0) {
      dayKeys.add(normalizeDate(row.date).toDateString());
    }
  }

  const logs = await WorkoutLog.find({
    userId,
    status: { $ne: 'Deleted' },
    'sets.0': { $exists: true },
  })
    .select('date sets')
    .lean();

  for (const log of logs) {
    const setCount = Array.isArray(log.sets) ? log.sets.length : 0;
    if (setCount > 0) {
      dayKeys.add(normalizeDate(log.date).toDateString());
    }
  }

  return dayKeys;
};

const computeDayStreak = (dayKeys) => {
  if (!dayKeys.size) return 0;
  const today = normalizeDate();
  let streak = 0;
  for (let i = 0; i < 3650; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (dayKeys.has(d.toDateString())) streak += 1;
    else break;
  }
  return streak;
};

const countCompletedSets = async (userId) => {
  const logs = await WorkoutLog.find({
    userId,
    status: { $ne: 'Deleted' },
  })
    .select('sets')
    .lean();

  let total = 0;
  for (const log of logs) {
    if (!Array.isArray(log.sets)) continue;
    total += log.sets.length;
  }
  return total;
};

const buildFourScore = (totalCompletedSets) => {
  const score = Math.min(100, Math.max(0, totalCompletedSets));
  return {
    value: score,
    totalCompletedSets,
    label: 'FOUR Score',
    cappedAt: 100,
  };
};

// GET /api/user/oval-office/page
const getOvalOfficePage = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('name email profilePhoto status').lean();
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }
    if (user.status === 'Deleted') {
      return res.status(400).json({ success: false, message: 'User account has been deleted' });
    }

    const [workoutDayKeys, totalCompletedSets] = await Promise.all([
      collectWorkoutDayKeys(user._id),
      countCompletedSets(user._id),
    ]);

    const workoutsCompleted = workoutDayKeys.size;
    const dayStreak = computeDayStreak(workoutDayKeys);
    const fourScore = buildFourScore(totalCompletedSets);

    const profilePhotoUrl = user.profilePhoto ? toPublicFileUrl(req, user.profilePhoto) : '';

    return res.json({
      success: true,
      message: 'Oval Office page fetched successfully',
      result: {
        header: {
          title: 'The Oval Office',
          subtitle: 'Manage your account',
        },
        profile: {
          name: user.name || '',
          email: user.email || '',
          initial: profileInitial(user),
          profilePhotoUrl,
        },
        stats: {
          workouts: {
            value: workoutsCompleted,
            label: 'Workouts',
          },
          dayStreak: {
            value: dayStreak,
            label: 'Day Streak',
          },
          fourScore: {
            value: fourScore.value,
            label: fourScore.label,
            totalCompletedSets: fourScore.totalCompletedSets,
          },
        },
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
  getOvalOfficePage,
  collectWorkoutDayKeys,
  computeDayStreak,
  countCompletedSets,
  buildFourScore,
};
