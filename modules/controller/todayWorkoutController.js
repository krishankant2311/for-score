const User = require('../model/userModel');
const Program = require('../model/programModel');

const MON_FIRST_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Match nutrition/workout controllers: calendar day start */
const normalizeCalendarDate = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const mondayFirstDayKey = (d) => {
  const js = d.getDay();
  const idx = js === 0 ? 6 : js - 1;
  return MON_FIRST_KEYS[idx];
};

const getMaxWeekFromGrid = (weekGrid) => {
  if (!weekGrid || typeof weekGrid !== 'object' || Array.isArray(weekGrid)) return 0;
  let max = 0;
  for (const k of Object.keys(weekGrid)) {
    const m = /^week\s*(\d+)$/i.exec(String(k).trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
};

const pickDayColumn = (dayRow, dayKey) => {
  if (!dayRow || typeof dayRow !== 'object') return null;
  const dk = String(dayKey).toLowerCase();
  const direct = dayRow[dayKey] ?? dayRow[dk] ?? dayRow[dayKey.toUpperCase()];
  if (direct != null && direct !== '') return direct;
  const matchKey = Object.keys(dayRow).find(
    (k) => String(k).toLowerCase() === dk || String(k).toLowerCase().startsWith(dk)
  );
  return matchKey != null ? dayRow[matchKey] : null;
};

const resolveWeekNumber = (program, weekGrid, refDate, startedAt) => {
  const start = normalizeCalendarDate(startedAt);
  const today = normalizeCalendarDate(refDate);
  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  let weekNum = diffDays < 0 ? 1 : Math.floor(diffDays / 7) + 1;

  const maxFromGrid = getMaxWeekFromGrid(weekGrid);
  const maxFromProgram = program.durationWeeks != null ? Number(program.durationWeeks) : 0;
  const maxWeek = Math.max(maxFromGrid, maxFromProgram, 1);

  if (weekNum > maxWeek) {
    weekNum = ((weekNum - 1) % maxWeek) + 1;
  }
  return { weekNum, maxWeek };
};

const slugKey = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const libraryLookup = (exerciseLibrary, token) => {
  if (!exerciseLibrary || typeof exerciseLibrary !== 'object') return null;
  if (!token && token !== 0) return null;
  const t = String(token).trim();
  if (!t) return null;

  if (Array.isArray(exerciseLibrary[t])) return exerciseLibrary[t];
  if (exerciseLibrary[t] != null) return exerciseLibrary[t];

  const slug = slugKey(t);
  if (slug && exerciseLibrary[slug] != null) return exerciseLibrary[slug];

  const lower = t.toLowerCase();
  for (const key of Object.keys(exerciseLibrary)) {
    if (String(key).toLowerCase() === lower) return exerciseLibrary[key];
    if (lower.includes(String(key).toLowerCase()) || String(key).toLowerCase().includes(lower)) {
      return exerciseLibrary[key];
    }
  }
  return null;
};

/** Strip "Mon " prefix and fuzzy-match "Upper A" -> upperA style keys */
const guessLibraryFromScheduleToken = (exerciseLibrary, token) => {
  if (!exerciseLibrary || !token) return null;
  let body = String(token).trim().replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[\s,:-]*/i, '').trim();
  if (!body) body = String(token).trim();

  const direct = libraryLookup(exerciseLibrary, body);
  if (direct) return direct;

  const compact = body.replace(/\s+/g, '').toLowerCase();
  const underscored = body.replace(/\s+/g, '_').toLowerCase();
  const tryKeys = [
    underscored,
    compact,
    compact.replace(/^rest.*$/i, 'rest'),
  ];
  for (const k of tryKeys) {
    const hit = libraryLookup(exerciseLibrary, k);
    if (hit) return hit;
  }

  for (const libKey of Object.keys(exerciseLibrary)) {
    const kc = libKey.replace(/_/g, '').toLowerCase();
    if (!kc || kc === 'alternatives' || kc === 'cardio') continue;
    if (kc === compact || compact.includes(kc) || kc.includes(compact)) return exerciseLibrary[libKey];
  }
  return null;
};

const formatExerciseEntry = (raw, order) => {
  if (typeof raw === 'string') {
    return { order, name: raw.trim() || 'Exercise', sets: null, reps: null, durationMin: null, difficulty: null };
  }
  if (raw && typeof raw === 'object') {
    return {
      order: raw.order != null ? Number(raw.order) : order,
      name: String(raw.name || raw.title || 'Exercise').trim(),
      sets: raw.sets != null && raw.sets !== '' ? Number(raw.sets) : null,
      reps: raw.reps != null ? String(raw.reps) : raw.repRange != null ? String(raw.repRange) : null,
      durationMin:
        raw.durationMin != null
          ? Number(raw.durationMin)
          : raw.timeMin != null
            ? Number(raw.timeMin)
            : null,
      difficulty: raw.difficulty || raw.difficultyLevel || null,
      notes: raw.notes ? String(raw.notes) : '',
    };
  }
  return { order, name: String(raw), sets: null, reps: null, durationMin: null, difficulty: null };
};

const normalizeExerciseList = (rawList) => {
  if (!rawList) return [];
  const arr = Array.isArray(rawList) ? rawList : [rawList];
  return arr.map((item, idx) => formatExerciseEntry(item, idx + 1));
};

const inferScheduleStrategy = (weekGrid, weekNum, dayKey, program) => {
  if (!weekGrid || typeof weekGrid !== 'object') {
    return { strategy: 'empty', scheduleToken: null, workoutTitle: null };
  }

  const cadence = weekGrid.cadence ?? weekGrid.Cadence;
  if (Array.isArray(cadence) && cadence.length) {
    const idx = MON_FIRST_KEYS.indexOf(dayKey);
    const scheduleTokenRaw = cadence[idx % cadence.length];
    const scheduleToken =
      scheduleTokenRaw != null && scheduleTokenRaw !== '' ? String(scheduleTokenRaw) : '';

    const workoutTitle = scheduleToken || program.programName;
    let libraryToken = scheduleToken;

    return {
      strategy: 'cadence',
      scheduleToken,
      workoutTitle,
      libraryToken,
    };
  }

  const wkExact = weekGrid[`week${weekNum}`] ?? weekGrid[`Week ${weekNum}`];
  let weekBucket = wkExact;
  if (!weekBucket || typeof weekBucket !== 'object') {
    const keys = Object.keys(weekGrid).filter((k) => /^week\s*\d+/i.test(k));
    if (keys.length) {
      const sorted = [...keys].sort((a, b) => {
        const na = Number(String(a).replace(/\D/g, '')) || 0;
        const nb = Number(String(b).replace(/\D/g, '')) || 0;
        return na - nb;
      });
      const pick = sorted[(weekNum - 1) % sorted.length];
      weekBucket = weekGrid[pick];
    }
  }

  if (weekBucket && typeof weekBucket === 'object') {
    const slot = pickDayColumn(weekBucket, dayKey);
    return {
      strategy: 'weekGrid',
      scheduleToken: slot != null ? String(slot) : null,
      workoutTitle: slot != null ? String(slot) : program.programName,
      libraryToken: slot != null ? String(slot) : null,
    };
  }

  const topSlot = pickDayColumn(weekGrid, dayKey);
  if (topSlot != null) {
    return {
      strategy: 'flatGrid',
      scheduleToken: String(topSlot),
      workoutTitle: String(topSlot),
      libraryToken: String(topSlot),
    };
  }

  return { strategy: 'unmapped', scheduleToken: null, workoutTitle: program.programName, libraryToken: null };
};

const estimateSessionMinutes = (exercises, program) => {
  let sum = 0;
  let n = 0;
  exercises.forEach((ex) => {
    if (ex.durationMin != null && !Number.isNaN(Number(ex.durationMin))) {
      sum += Number(ex.durationMin);
      n += 1;
    }
  });
  if (sum > 0) return Math.round(sum);
  if (program.avgSessionMinutes != null && !Number.isNaN(Number(program.avgSessionMinutes))) {
    return Math.round(Number(program.avgSessionMinutes));
  }
  return Math.max(15, exercises.length * 10);
};

// --- HTTP handlers ----------------------------------------------------------

const selectActiveProgram = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const { programId, startedAt } = req.body || {};

    if (!programId) {
      return res.status(400).json({ success: false, message: 'programId is required' });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const program = await Program.findOne({ _id: programId, status: 'Active' }).lean();
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found or not available',
      });
    }

    const start = startedAt ? normalizeCalendarDate(startedAt) : normalizeCalendarDate();
    user.activeProgramId = program._id;
    user.programStartedAt = start;
    await user.save();

    return res.json({
      success: true,
      message: 'Active program saved',
      result: {
        activeProgramId: user.activeProgramId,
        programStartedAt: user.programStartedAt,
        program: {
          _id: program._id,
          programName: program.programName,
          subHeader: program.subHeader,
          durationWeeks: program.durationWeeks,
          daysPerWeek: program.daysPerWeek,
          avgSessionMinutes: program.avgSessionMinutes,
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

/** User’s chosen program (full document for weekGrid / exerciseLibrary) */
const getSelectedProgramForUser = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const user = await User.findById(user_id).select('activeProgramId programStartedAt').lean();
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (!user.activeProgramId) {
      return res.json({
        success: true,
        message: 'No program selected',
        result: null,
      });
    }

    const program = await Program.findOne({
      _id: user.activeProgramId,
      status: 'Active',
    }).lean();

    if (!program) {
      return res.json({
        success: true,
        message: 'Selected program is no longer available',
        result: {
          activeProgramId: user.activeProgramId,
          programStartedAt: user.programStartedAt,
          program: null,
        },
      });
    }

    return res.json({
      success: true,
      message: 'Selected program fetched successfully',
      result: {
        activeProgramId: user.activeProgramId,
        programStartedAt: user.programStartedAt,
        program,
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

const getTodayWorkout = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const user = await User.findById(user_id).select('activeProgramId programStartedAt').lean();
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (!user.activeProgramId || !user.programStartedAt) {
      return res.status(400).json({
        success: false,
        message: 'No active program. POST /api/user/programs/active with programId first.',
      });
    }

    const program = await Program.findOne({
      _id: user.activeProgramId,
      status: 'Active',
    }).lean();

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Active program no longer exists',
      });
    }

    const refDate = req.query.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(refDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date query' });
    }

    const weekGrid = program.weekGrid && typeof program.weekGrid === 'object' ? program.weekGrid : {};
    const exerciseLibrary =
      program.exerciseLibrary && typeof program.exerciseLibrary === 'object'
        ? program.exerciseLibrary
        : {};

    const dayKey = mondayFirstDayKey(refDate);
    const { weekNum, maxWeek } = resolveWeekNumber(program, weekGrid, refDate, user.programStartedAt);

    const inferred = inferScheduleStrategy(weekGrid, weekNum, dayKey, program);
    let listRaw = libraryLookup(exerciseLibrary, inferred.libraryToken);
    if (!listRaw && inferred.scheduleToken) {
      listRaw = libraryLookup(exerciseLibrary, inferred.scheduleToken);
    }
    if (!listRaw && inferred.scheduleToken) {
      listRaw = guessLibraryFromScheduleToken(exerciseLibrary, inferred.scheduleToken);
    }
    if (
      !listRaw &&
      inferred.strategy === 'weekGrid' &&
      inferred.scheduleToken &&
      /^[\d\sxX+-]+$/.test(String(inferred.scheduleToken).trim())
    ) {
      const daySlugMap = {
        mon: ['monday', 'legs'],
        wed: ['wednesday', 'upper'],
        fri: ['friday', 'fullbody', 'full'],
        tue: ['tuesday', 'recovery', 'cardio'],
        thu: ['thursday'],
        sat: ['saturday'],
        sun: ['sunday'],
      };
      const parts = daySlugMap[dayKey] || [];
      for (const p of parts) {
        const hit = Object.keys(exerciseLibrary).find((k) => k.toLowerCase().includes(p));
        if (hit) {
          listRaw = exerciseLibrary[hit];
          inferred.resolvedVia = `dayFallback:${hit}`;
          break;
        }
      }
    }

    let exercises = normalizeExerciseList(listRaw);
    let resolutionStrategy = inferred.strategy;

    if (!exercises.length && Array.isArray(inferred.scheduleToken) === false && inferred.scheduleToken) {
      resolutionStrategy =
        inferred.strategy +
        (inferred.scheduleToken ? '_unmapped_library' : '');
    }

    const exerciseCount = exercises.length;
    const estimatedMinutes = estimateSessionMinutes(exercises, program);
    let estimatedCalories = null;
    if (estimatedMinutes && program.avgSessionMinutes) {
      estimatedCalories = Math.round((estimatedMinutes / Math.max(Number(program.avgSessionMinutes), 1)) * 300);
    } else if (exerciseCount) {
      estimatedCalories = exerciseCount * 45;
    }

    return res.json({
      success: true,
      message: "Today's workout resolved",
      result: {
        date: normalizeCalendarDate(refDate),
        program: {
          _id: program._id,
          programName: program.programName,
        },
        schedule: {
          weekNumber: weekNum,
          weekCount: maxWeek,
          dayKey,
          slotLabel: inferred.scheduleToken,
          workoutTitle: inferred.workoutTitle || program.programName,
        },
        exercises,
        summary: {
          exerciseCount,
          estimatedMinutes,
          estimatedCalories,
        },
        meta: {
          resolutionStrategy,
          libraryKeys: Object.keys(exerciseLibrary).slice(0, 30),
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
  selectActiveProgram,
  getSelectedProgramForUser,
  /** @deprecated alias — use GET /programs/selected */
  getActiveProgramForUser: getSelectedProgramForUser,
  getTodayWorkout,
};
