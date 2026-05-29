const User = require('../model/userModel');
const Program = require('../model/programModel');
const StretchSessionLog = require('../model/stretchSessionLogModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');

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

const slugIconKey = (title) =>
  String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'stretch_default';

const mapSkillLevel = (raw) => {
  const s = String(raw || '').toLowerCase();
  if (s.includes('begin')) return 'Beginner';
  if (s.includes('inter') || s.includes('adv')) return 'Intermediate';
  return 'All Levels';
};

/** Recovery-day stretches from fitness program (recoveryProtocol + legacy recovery). */
const extractStretchesFromFitnessProgram = (program) => {
  const protocol =
    program?.recoveryProtocol && typeof program.recoveryProtocol === 'object'
      ? program.recoveryProtocol
      : null;
  const legacyRecovery =
    program?.recovery && typeof program.recovery === 'object' ? program.recovery : null;

  const rawLists = [
    Array.isArray(protocol?.stretches) ? protocol.stretches : [],
    Array.isArray(legacyRecovery?.stretches) ? legacyRecovery.stretches : [],
  ];

  const seen = new Set();
  const stretches = [];
  for (const list of rawLists) {
    for (const item of list) {
      const name = String(item?.name ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      stretches.push({
        name,
        detail: String(item?.detail ?? '').trim(),
      });
    }
  }
  return stretches;
};

const estimateDurationMinutes = (program, stretchCount) => {
  const protocol =
    program?.recoveryProtocol && typeof program.recoveryProtocol === 'object'
      ? program.recoveryProtocol
      : null;
  const cardio = protocol?.cardio && typeof protocol.cardio === 'object' ? protocol.cardio : null;
  const cardioMinutes = Number(
    cardio?.durationMinutes ?? cardio?.duration_minutes ?? program?.recovery?.lissMinutes ?? 0
  );
  const stretchBlockMinutes = stretchCount > 0 ? Math.max(5, stretchCount * 2) : 0;
  const total = (Number.isFinite(cardioMinutes) ? cardioMinutes : 0) + stretchBlockMinutes;
  if (total > 0) return Math.round(total);
  const avg = Number(program?.avgSessionMinutes || 0);
  if (avg > 0) return Math.round(avg * 0.35);
  return stretchCount > 0 ? Math.max(5, stretchCount * 2) : 5;
};

const mapFitnessProgramToStretchProgram = (program) => {
  const stretches = extractStretchesFromFitnessProgram(program);
  const durationMinutes = estimateDurationMinutes(program, stretches.length);
  const description =
    String(program.subHeader || '').trim() ||
    String(program.overview || '').trim() ||
    'Recovery day stretching from your fitness program';

  return {
    _id: program._id,
    fitnessProgramId: String(program._id),
    source: 'fitness_program',
    title: program.programName || 'Stretch Program',
    description,
    level: mapSkillLevel(program.workoutSkillLevel),
    durationMinutes,
    stretchCount: stretches.length,
    iconKey: slugIconKey(program.programName),
    mediaPath: program.thumbnail_url || program.videoPath || '',
    programCode: program.programCode || '',
    stretches,
  };
};

const buildProgramCard = (req, program, { includeStretches = false } = {}) => {
  const card = {
    _id: program._id ? String(program._id) : null,
    fitnessProgramId: program.fitnessProgramId || (program._id ? String(program._id) : null),
    source: program.source || 'fitness_program',
    title: program.title,
    description: program.description,
    level: program.level,
    durationMinutes: Number(program.durationMinutes),
    durationLabel: `${Number(program.durationMinutes)} mins`,
    stretchCount: Number(program.stretchCount),
    stretchesLabel: `${Number(program.stretchCount)} stretches`,
    iconKey: program.iconKey || 'stretch_default',
    mediaUrl: program.mediaPath ? toPublicFileUrl(req, program.mediaPath) : '',
    programCode: program.programCode || '',
  };
  if (includeStretches && Array.isArray(program.stretches)) {
    card.stretches = program.stretches;
  }
  return card;
};

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

const fitnessProgramFilter = () => ({
  status: 'Active',
  isDeleted: { $ne: true },
});

const loadStretchProgramsFromFitness = async () => {
  const programs = await Program.find(fitnessProgramFilter())
    .sort({ programName: 1, createdAt: 1 })
    .lean();

  return programs.map(mapFitnessProgramToStretchProgram);
};

const findProgramById = async (programId) => {
  const fitness = await Program.findOne({
    ...fitnessProgramFilter(),
    _id: programId,
  }).lean();
  if (!fitness) return null;
  return mapFitnessProgramToStretchProgram(fitness);
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
      loadStretchProgramsFromFitness(),
      buildUserProgress(user._id),
    ]);

    const withStretches = programs.filter((p) => p.stretchCount > 0);
    const availablePrograms = (withStretches.length ? withStretches : programs).map((p) =>
      buildProgramCard(req, p)
    );

    return res.json({
      success: true,
      message: 'Stretch programs page fetched successfully',
      result: {
        header: {
          title: 'Stretch Programs',
          subtitle: 'Choose a flexibility routine',
        },
        yourProgress: progress,
        availablePrograms,
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

// GET /api/user/stretch-programs/:id  (id = fitness program _id)
const getStretchProgramByIdForUser = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const program = await findProgramById(req.params.id);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Stretch program not found',
      });
    }

    return res.json({
      success: true,
      message: 'Stretch program fetched successfully',
      result: buildProgramCard(req, program, { includeStretches: true }),
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
// Body: { programId?, date?, durationMinutes }  — programId = fitness program _id
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
    let program = null;
    if (programId) {
      program = await findProgramById(programId);
      if (!program) {
        return res.status(404).json({
          success: false,
          message: 'Stretch program not found',
        });
      }
      if (!Number.isFinite(minutes) || minutes <= 0) {
        minutes = Number(program.durationMinutes);
      }
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'durationMinutes is required (or provide a valid programId)',
      });
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
  extractStretchesFromFitnessProgram,
  mapFitnessProgramToStretchProgram,
};
