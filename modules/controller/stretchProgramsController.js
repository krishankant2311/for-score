const User = require('../model/userModel');
const StretchProgram = require('../model/stretchProgramModel');
const StretchSessionLog = require('../model/stretchSessionLogModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');

const DEFAULT_PROGRAMS = [
  {
    title: 'Morning Full Body Stretch',
    description: 'Wake up your muscles with gentle full-body stretches',
    level: 'Beginner',
    durationMinutes: 5,
    stretchCount: 8,
    iconKey: 'morning_full_body',
    sortOrder: 1,
  },
  {
    title: 'Post-Workout Recovery',
    description: 'Cool down and prevent soreness after training',
    level: 'Intermediate',
    durationMinutes: 8,
    stretchCount: 8,
    iconKey: 'post_workout',
    sortOrder: 2,
  },
  {
    title: 'Evening Relaxation',
    description: 'Wind down before bed with calming stretches',
    level: 'All Levels',
    durationMinutes: 10,
    stretchCount: 10,
    iconKey: 'evening_relaxation',
    sortOrder: 3,
  },
  {
    title: 'Lower Body Focus',
    description: 'Target hips, hamstrings, and calves',
    level: 'Intermediate',
    durationMinutes: 7,
    stretchCount: 7,
    iconKey: 'lower_body',
    sortOrder: 4,
  },
];

const STRETCHING_TIPS = [
  'Never bounce - use slow, controlled movements',
  'Breathe deeply and relax into each stretch',
  'Hold each stretch for 15-30 seconds minimum',
  'Stop if you feel sharp pain - mild tension is normal',
];

const normalizeDate = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const buildProgramCard = (req, program) => ({
  _id: program._id || null,
  title: program.title,
  description: program.description,
  level: program.level,
  durationMinutes: Number(program.durationMinutes),
  durationLabel: `${Number(program.durationMinutes)} mins`,
  stretchCount: Number(program.stretchCount),
  stretchesLabel: `${Number(program.stretchCount)} stretches`,
  iconKey: program.iconKey || 'stretch_default',
  mediaUrl: program.mediaPath ? toPublicFileUrl(req, program.mediaPath) : '',
});

const computeDayStreak = (sessionDates) => {
  if (!sessionDates.length) return 0;
  const uniqueDays = new Set(sessionDates.map((d) => normalizeDate(d).toDateString()));
  const today = normalizeDate();
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (uniqueDays.has(d.toDateString())) streak += 1;
    else break;
  }
  return streak;
};

const buildUserProgress = async (userId) => {
  const sessions = await StretchSessionLog.find({
    userId,
    status: { $ne: 'Deleted' },
  })
    .select('date durationMinutes')
    .lean();

  const sessionsCount = sessions.length;
  const totalMinutes = sessions.reduce(
    (sum, s) => sum + Number(s.durationMinutes || 0),
    0
  );
  const dayStreak = computeDayStreak(sessions.map((s) => s.date));

  return {
    sessions: sessionsCount,
    dayStreak,
    totalMinutes,
    labels: {
      sessions: String(sessionsCount),
      dayStreak: String(dayStreak),
      totalMinutes: String(totalMinutes),
    },
  };
};

const loadActivePrograms = async () => {
  const programs = await StretchProgram.find({ status: 'Active' })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  if (programs.length) return programs;
  return DEFAULT_PROGRAMS;
};

// GET /api/user/stretch-programs/page
const getStretchProgramsPage = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const [programs, progress] = await Promise.all([
      loadActivePrograms(),
      buildUserProgress(user._id),
    ]);

    return res.json({
      success: true,
      message: 'Stretch programs page fetched successfully',
      result: {
        header: {
          title: 'Stretch Programs',
          subtitle: 'Choose a flexibility routine',
        },
        yourProgress: progress,
        availablePrograms: programs.map((p) => buildProgramCard(req, p)),
        stretchingTips: STRETCHING_TIPS.map((text, index) => ({
          order: index + 1,
          text,
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

// GET /api/user/stretch-programs/:id
const getStretchProgramByIdForUser = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const program = await StretchProgram.findOne({
      _id: req.params.id,
      status: 'Active',
    }).lean();

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Stretch program not found',
      });
    }

    return res.json({
      success: true,
      message: 'Stretch program fetched successfully',
      result: buildProgramCard(req, program),
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

// POST /api/user/stretch-sessions
// Body: { programId?, date?, durationMinutes }
const logStretchSession = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const { programId, date, durationMinutes } = req.body || {};
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    let minutes = Number(durationMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      if (programId) {
        const program = await StretchProgram.findOne({
          _id: programId,
          status: 'Active',
        }).lean();
        if (program) minutes = Number(program.durationMinutes);
      }
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'durationMinutes is required (or provide a valid programId)',
      });
    }

    if (programId) {
      const program = await StretchProgram.findOne({
        _id: programId,
        status: 'Active',
      }).lean();
      if (!program) {
        return res.status(404).json({
          success: false,
          message: 'Stretch program not found',
        });
      }
    }

    const session = await StretchSessionLog.create({
      userId: user._id,
      programId: programId || null,
      date: normalizedDate,
      durationMinutes: Math.round(minutes),
    });

    const progress = await buildUserProgress(user._id);

    return res.json({
      success: true,
      message: 'Stretch session logged successfully',
      result: {
        session,
        yourProgress: progress,
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
  getStretchProgramsPage,
  getStretchProgramByIdForUser,
  logStretchSession,
  DEFAULT_PROGRAMS,
};
