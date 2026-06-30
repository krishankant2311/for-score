const User = require('../model/userModel');
const Program = require('../model/programModel');
const StretchProgram = require('../model/stretchProgramModel');
const StretchSessionLog = require('../model/stretchSessionLogModel');
const StretchMovementCompletion = require('../model/stretchMovementCompletionModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');

const STRETCHING_TIPS = [
  'Never bounce - use slow, controlled movements',
  'Breathe deeply and relax into each stretch',
  'Hold each stretch for 15-30 seconds minimum',
  'Stop if you feel sharp pain - mild tension is normal',
];

const truncateText = (text, max = 120) => {
  const value = String(text || '').trim();
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trim()}...`;
};

const getCardDescription = (program) => {
  const description = String(program.description || '').trim();
  const intro = String(program.intro || '').trim();
  if (description && description !== intro) return description;
  if (description) return truncateText(description, 120);
  return truncateText(intro, 120);
};

const normalizeDate = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (dateInput) => {
  const d = normalizeDate(dateInput);
  if (!d) return null;
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end;
};

const parseMinutesFromTimeLabel = (timeLabel, programDurationMinutes, totalSessions) => {
  const text = String(timeLabel || '').toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*min/);
  if (match) return Math.max(1, Math.round(Number(match[1])));
  const programMinutes = Number(programDurationMinutes) || 0;
  const count = Number(totalSessions) || 0;
  if (programMinutes > 0 && count > 0) return Math.max(1, Math.round(programMinutes / count));
  return 1;
};

const getProgramSessions = (program) => {
  if (Array.isArray(program.movements) && program.movements.length) {
    return program.movements.map((m, idx) => ({
      sequenceOrder: Number(m.sequenceOrder) || idx + 1,
      sequenceLabel: m.sequenceLabel || '',
      movementName: m.movementName || m.name || '',
      targetArea: m.targetArea || '',
      timeLabel: m.timeLabel || '',
    }));
  }

  if (Array.isArray(program.stretches) && program.stretches.length) {
    return program.stretches.map((s, idx) => ({
      sequenceOrder: Number(s.sequenceOrder) || idx + 1,
      sequenceLabel: s.sequenceLabel || '',
      movementName: s.movementName || s.name || '',
      targetArea: s.targetArea || '',
      timeLabel: s.timeLabel || s.detail || '',
    }));
  }

  return [];
};

const getProgramIdString = (program) => String(program._id || '');

const loadCompletionsForProgramDay = async (userId, programId, sessionDate) => {
  const start = normalizeDate(sessionDate);
  const end = endOfDay(sessionDate);
  if (!start || !end) return [];

  return StretchMovementCompletion.find({
    userId,
    programId,
    sessionDate: { $gte: start, $lte: end },
    status: { $ne: 'Deleted' },
  })
    .sort({ sequenceOrder: 1 })
    .lean();
};

const buildProgramSessionProgress = (sessions, completions) => {
  const completedOrders = new Set(completions.map((c) => Number(c.sequenceOrder)));
  const total = sessions.length;
  const completed = sessions.filter((s) => completedOrders.has(Number(s.sequenceOrder))).length;

  return {
    completed,
    total,
    allCompleted: total > 0 && completed >= total,
    label: `${completed}/${total} completed`,
  };
};

const mapSessionsWithCompletion = (program, completions, sessionDate) => {
  const sessions = getProgramSessions(program);
  const completionByOrder = new Map(
    completions.map((c) => [Number(c.sequenceOrder), c])
  );

  return sessions.map((session) => {
    const completion = completionByOrder.get(Number(session.sequenceOrder));
    const durationMinutes = parseMinutesFromTimeLabel(
      session.timeLabel,
      program.durationMinutes,
      sessions.length
    );

    return {
      ...session,
      durationMinutes,
      durationLabel: `${durationMinutes} min`,
      isCompleted: Boolean(completion),
      completedAt: completion?.completedAt || null,
      sessionDate: sessionDate ? normalizeDate(sessionDate).toISOString() : null,
    };
  });
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

const mapStandaloneStretchProgram = (doc) => {
  const movements = Array.isArray(doc.movements) ? doc.movements : [];
  const stretches = movements.map((m) => ({
    name: m.movementName,
    detail: [m.sequenceLabel, m.targetArea, m.timeLabel].filter(Boolean).join(' · '),
    sequenceOrder: m.sequenceOrder,
    sequenceLabel: m.sequenceLabel,
    movementName: m.movementName,
    targetArea: m.targetArea,
    timeLabel: m.timeLabel,
  }));

  return {
    _id: doc._id,
    fitnessProgramId: null,
    source: 'stretch_program',
    title: doc.title,
    description: String(doc.description || doc.intro || '').trim(),
    level: doc.level || 'All Levels',
    durationMinutes: Number(doc.durationMinutes) || 5,
    stretchCount: stretches.length || Number(doc.stretchCount) || 0,
    iconKey: doc.iconKey || slugIconKey(doc.title),
    mediaPath: doc.mediaPath || '',
    programCode: '',
    category: doc.category || 'Recover',
    intro: doc.intro || '',
    movements,
    stretches,
  };
};

const loadStretchProgramsFromCollection = async () => {
  const docs = await StretchProgram.find({ status: 'Active' })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();
  return docs.map(mapStandaloneStretchProgram);
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

const buildProgramCardForUi = (req, program) => {
  const stretchCount = Number(program.stretchCount) || 0;
  const durationMinutes = Number(program.durationMinutes) || 5;
  const mediaUrl = program.mediaPath ? toPublicFileUrl(req, program.mediaPath) : '';

  return {
    id: program._id ? String(program._id) : null,
    _id: program._id ? String(program._id) : null,
    title: program.title,
    description: getCardDescription(program),
    level: program.level || 'All Levels',
    levelLabel: program.level || 'All Levels',
    durationMinutes,
    durationLabel: `${durationMinutes} mins`,
    stretchCount,
    stretchesLabel: `${stretchCount} ${stretchCount === 1 ? 'stretch' : 'stretches'}`,
    thumbnailUrl: mediaUrl,
    iconUrl: mediaUrl,
    iconKey: program.iconKey || 'stretch_default',
    source: program.source || 'stretch_program',
    category: program.category || 'Recover',
  };
};

const buildProgramCard = (req, program, { includeStretches = false } = {}) => {
  const card = {
    ...buildProgramCardForUi(req, program),
    fitnessProgramId: program.fitnessProgramId || (program._id ? String(program._id) : null),
    intro: program.intro || program.description || '',
    programCode: program.programCode || '',
  };
  if (includeStretches && Array.isArray(program.stretches)) {
    card.stretches = program.stretches;
  }
  if (includeStretches && Array.isArray(program.movements)) {
    card.movements = program.movements;
  }
  return card;
};

const buildProgressForUi = (progress) => ({
  title: 'Your Progress',
  stats: [
    {
      key: 'sessions',
      value: progress.sessions,
      label: 'Sessions',
      display: `${progress.sessions} Sessions`,
    },
    {
      key: 'dayStreak',
      value: progress.dayStreak,
      label: 'Day Streak',
      display: `${progress.dayStreak} Day Streak`,
    },
    {
      key: 'totalMinutes',
      value: progress.totalMinutes,
      label: 'Total Mins',
      display: `${progress.totalMinutes} Total Mins`,
    },
  ],
  sessions: progress.sessions,
  dayStreak: progress.dayStreak,
  totalMinutes: progress.totalMinutes,
  labels: progress.labels,
});

const buildStretchingTipsForUi = () => ({
  title: 'Stretching Tips',
  tips: STRETCHING_TIPS.map((text, index) => ({
    order: index + 1,
    text,
  })),
});

const buildStretchProgramsPageResult = (req, programs, progress) => ({
  header: {
    title: 'Stretch Programs',
    subtitle: 'Choose a flexibility routine',
  },
  yourProgress: buildProgressForUi(progress),
  availablePrograms: {
    title: 'Available Programs',
    programs: programs.map((p) => buildProgramCardForUi(req, p)),
    total: programs.length,
  },
  stretchingTips: buildStretchingTipsForUi(),
});

const buildProgramDetail = (req, program, { sessions = [], sessionProgress = null } = {}) => {
  const movements = Array.isArray(program.movements) ? program.movements : [];
  const stretches = Array.isArray(program.stretches) ? program.stretches : [];
  const normalizedMovements = movements.map((m, idx) => ({
    sequenceOrder: Number(m.sequenceOrder) || idx + 1,
    sequenceLabel: m.sequenceLabel || '',
    movementName: m.movementName || m.name || '',
    targetArea: m.targetArea || '',
    timeLabel: m.timeLabel || '',
  }));

  const progress =
    sessionProgress ||
    buildProgramSessionProgress(
      getProgramSessions(program),
      sessions
        .filter((s) => s.isCompleted)
        .map((s) => ({ sequenceOrder: s.sequenceOrder }))
    );

  return {
    header: {
      title: program.title,
      subtitle: getCardDescription(program),
    },
    program: {
      ...buildProgramCardForUi(req, program),
      intro: program.intro || '',
      description: getCardDescription(program),
      fitnessProgramId: program.fitnessProgramId || null,
      programCode: program.programCode || '',
    },
    intro: program.intro || '',
    sessions,
    sessionProgress: progress,
    movements: normalizedMovements,
    stretches,
    meta: {
      level: program.level || 'All Levels',
      durationMinutes: Number(program.durationMinutes) || 5,
      durationLabel: `${Number(program.durationMinutes) || 5} mins`,
      stretchCount: Number(program.stretchCount) || normalizedMovements.length || stretches.length,
      stretchesLabel: `${Number(program.stretchCount) || normalizedMovements.length || stretches.length} stretches`,
      category: program.category || 'Recover',
    },
  };
};

const loadAllStretchPrograms = async ({ category = '', source = '' } = {}) => {
  const categoryFilter = String(category || '').trim().toLowerCase();
  const sourceFilter = String(source || '').trim().toLowerCase();

  const tasks = [];
  if (!sourceFilter || sourceFilter === 'stretch_program') {
    tasks.push(loadStretchProgramsFromCollection());
  } else {
    tasks.push(Promise.resolve([]));
  }
  if (!sourceFilter || sourceFilter === 'fitness_program') {
    tasks.push(loadStretchProgramsFromFitness());
  } else {
    tasks.push(Promise.resolve([]));
  }

  const [standalonePrograms, fitnessPrograms] = await Promise.all(tasks);
  let programs = [...standalonePrograms, ...fitnessPrograms];

  if (categoryFilter) {
    programs = programs.filter(
      (p) => String(p.category || '').trim().toLowerCase() === categoryFilter
    );
  }

  const withStretches = programs.filter((p) => p.stretchCount > 0);
  return withStretches.length ? withStretches : programs;
};

const computeDayStreak = (sessionDates) => {
  if (!sessionDates.length) return 0;

  const uniqueDays = new Set(sessionDates.map((d) => normalizeDate(d).toDateString()));
  const today = normalizeDate();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  let startDay = today;
  if (!uniqueDays.has(today.toDateString())) {
    if (!uniqueDays.has(yesterday.toDateString())) return 0;
    startDay = yesterday;
  }

  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() - i);
    if (uniqueDays.has(d.toDateString())) streak += 1;
    else break;
  }
  return streak;
};

const buildUserProgress = async (userId) => {
  const completions = await StretchMovementCompletion.find({
    userId,
    status: { $ne: 'Deleted' },
  })
    .select('sessionDate durationMinutes')
    .lean();

  const sessionsCount = completions.length;
  const totalMinutes = completions.reduce(
    (sum, s) => sum + Number(s.durationMinutes || 0),
    0
  );
  const dayStreak = computeDayStreak(completions.map((s) => s.sessionDate));

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

const createMovementCompletion = async ({
  userId,
  programId,
  session,
  program,
  sessionDate,
}) => {
  const durationMinutes = parseMinutesFromTimeLabel(
    session.timeLabel,
    program.durationMinutes,
    getProgramSessions(program).length
  );

  return StretchMovementCompletion.create({
    userId,
    programId,
    sequenceOrder: Number(session.sequenceOrder),
    movementName: session.movementName || '',
    sessionDate,
    completedAt: new Date(),
    durationMinutes,
  });
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
  const standalone = await StretchProgram.findOne({
    _id: programId,
    status: 'Active',
  }).lean();
  if (standalone) return mapStandaloneStretchProgram(standalone);

  const fitness = await Program.findOne({
    ...fitnessProgramFilter(),
    _id: programId,
  }).lean();
  if (!fitness) return null;
  return mapFitnessProgramToStretchProgram(fitness);
};

// GET /api/user/stretch-programs — list all active programs for mobile app
const getAllStretchProgramsForUser = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const category = req.query.category;
    const source = req.query.source;
    const programs = await loadAllStretchPrograms({ category, source });
    const items = programs.map((p) => buildProgramCardForUi(req, p));

    return res.json({
      success: true,
      message: 'Stretch programs fetched successfully',
      result: {
        title: 'Available Programs',
        programs: items,
        total: items.length,
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

// GET /api/user/stretch-programs/page
const getStretchProgramsPage = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const [standalonePrograms, progress] = await Promise.all([
      loadStretchProgramsFromCollection(),
      buildUserProgress(user._id),
    ]);

    const programs = standalonePrograms.filter((p) => p.stretchCount > 0);
    const availablePrograms = programs.length ? programs : standalonePrograms;

    return res.json({
      success: true,
      message: 'Stretch programs page fetched successfully',
      result: buildStretchProgramsPageResult(req, availablePrograms, progress),
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

    const program = await findProgramById(req.params.id);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Stretch program not found',
      });
    }

    const sessionDate = normalizeDate(req.query.date);
    const completions = await loadCompletionsForProgramDay(
      user._id,
      getProgramIdString(program),
      sessionDate
    );
    const sessions = mapSessionsWithCompletion(program, completions, sessionDate);
    const sessionProgress = buildProgramSessionProgress(getProgramSessions(program), completions);

    return res.json({
      success: true,
      message: 'Stretch program fetched successfully',
      result: buildProgramDetail(req, program, { sessions, sessionProgress }),
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

// POST /api/user/stretch-programs/:id/sessions/complete
// Body: { sequenceOrder, date? }
const completeStretchMovementSession = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const program = await findProgramById(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Stretch program not found' });
    }

    const sequenceOrder = Number(req.body?.sequenceOrder);
    if (!Number.isFinite(sequenceOrder) || sequenceOrder < 1) {
      return res.status(400).json({
        success: false,
        message: 'sequenceOrder is required',
      });
    }

    const sessionDate = normalizeDate(req.body?.date);
    if (!sessionDate) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const programSessions = getProgramSessions(program);
    const session = programSessions.find((s) => Number(s.sequenceOrder) === sequenceOrder);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found in program' });
    }

    const programId = getProgramIdString(program);
    const existing = await StretchMovementCompletion.findOne({
      userId: user._id,
      programId,
      sequenceOrder,
      sessionDate: { $gte: sessionDate, $lte: endOfDay(sessionDate) },
      status: { $ne: 'Deleted' },
    }).lean();

    let completion = existing;
    let alreadyCompleted = Boolean(existing);

    if (!existing) {
      completion = await createMovementCompletion({
        userId: user._id,
        programId,
        session,
        program,
        sessionDate,
      });
    }

    const completions = await loadCompletionsForProgramDay(user._id, programId, sessionDate);
    const sessions = mapSessionsWithCompletion(program, completions, sessionDate);
    const sessionProgress = buildProgramSessionProgress(programSessions, completions);
    const yourProgress = await buildUserProgress(user._id);

    return res.json({
      success: true,
      message: alreadyCompleted ? 'Session already completed' : 'Session completed successfully',
      result: {
        alreadyCompleted,
        completion,
        sessionProgress,
        sessions,
        yourProgress: buildProgressForUi(yourProgress),
      },
    });
  } catch (err) {
    if (err?.code === 11000) {
      const sessionDate = normalizeDate(req.body?.date);
      const program = await findProgramById(req.params.id);
      const programId = getProgramIdString(program);
      const completions = await loadCompletionsForProgramDay(req.token._id, programId, sessionDate);
      const sessions = mapSessionsWithCompletion(program, completions, sessionDate);
      const yourProgress = await buildUserProgress(req.token._id);
      return res.json({
        success: true,
        message: 'Session already completed',
        result: {
          alreadyCompleted: true,
          sessionProgress: buildProgramSessionProgress(getProgramSessions(program), completions),
          sessions,
          yourProgress: buildProgressForUi(yourProgress),
        },
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

// POST /api/user/stretch-programs/:id/sessions/complete-all
// Body: { date? }
const completeAllStretchMovementSessions = async (req, res) => {
  try {
    const userId = req.token?._id;
    const user = await User.findById(userId).select('_id');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const program = await findProgramById(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Stretch program not found' });
    }

    const sessionDate = normalizeDate(req.body?.date);
    if (!sessionDate) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const programId = getProgramIdString(program);
    const programSessions = getProgramSessions(program);
    if (!programSessions.length) {
      return res.status(400).json({ success: false, message: 'No sessions found in program' });
    }

    const existingCompletions = await loadCompletionsForProgramDay(
      user._id,
      programId,
      sessionDate
    );
    const completedOrders = new Set(
      existingCompletions.map((c) => Number(c.sequenceOrder))
    );

    const newlyCompleted = [];
    for (const session of programSessions) {
      if (completedOrders.has(Number(session.sequenceOrder))) continue;
      const completion = await createMovementCompletion({
        userId: user._id,
        programId,
        session,
        program,
        sessionDate,
      });
      newlyCompleted.push(completion);
    }

    const completions = await loadCompletionsForProgramDay(user._id, programId, sessionDate);
    const sessions = mapSessionsWithCompletion(program, completions, sessionDate);
    const sessionProgress = buildProgramSessionProgress(programSessions, completions);
    const yourProgress = await buildUserProgress(user._id);

    const addedMinutes = newlyCompleted.reduce(
      (sum, item) => sum + Number(item.durationMinutes || 0),
      0
    );

    return res.json({
      success: true,
      message: 'All sessions marked complete',
      result: {
        newlyCompletedCount: newlyCompleted.length,
        alreadyCompletedCount: existingCompletions.length,
        addedMinutes,
        sessionProgress,
        sessions,
        yourProgress: buildProgressForUi(yourProgress),
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
        yourProgress: buildProgressForUi(progress),
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
  getAllStretchProgramsForUser,
  getStretchProgramsPage,
  getStretchProgramByIdForUser,
  completeStretchMovementSession,
  completeAllStretchMovementSessions,
  logStretchSession,
  extractStretchesFromFitnessProgram,
  mapFitnessProgramToStretchProgram,
};
