const User = require('../model/userModel');
const Program = require('../model/programModel');
const WorkoutLog = require('../model/workoutLogModel');
const DailyExerciseCompletion = require('../model/dailyExerciseCompletionModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');
const { rewriteProgramMediaUrlsForResponse } = require('../../utils/programMediaUrls');

const MON_FIRST_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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

const guessLibraryFromScheduleToken = (exerciseLibrary, token) => {
  if (!exerciseLibrary || !token) return null;
  let body = String(token).trim().replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[\s,:-]*/i, '').trim();
  if (!body) body = String(token).trim();

  const direct = libraryLookup(exerciseLibrary, body);
  if (direct) return direct;

  const compact = body.replace(/\s+/g, '').toLowerCase();
  const underscored = body.replace(/\s+/g, '_').toLowerCase();
  const tryKeys = [underscored, compact, compact.replace(/^rest.*$/i, 'rest')];
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

const firstFiniteNumber = (...vals) => {
  for (const v of vals) {
    if (v === '' || v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const parseMusclesArray = (v) => {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  try {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.startsWith('[')) {
        const arr = JSON.parse(t);
        return Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : [];
      }
      return t
        .split(/[,|]/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
  } catch (_) {
    /* ignore */
  }
  return [];
};

const parseInstructionsArray = (v) => {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[\).\s]+\s*/, '').trim())
    .filter(Boolean);
};

/**
 * Reads one exercise from Program.exerciseLibrary (admin-defined).
 * Supports snake_case or camelCase; strings stay minimal.
 */
const parseExerciseSlotFromProgram = (raw, order, programId) => {
  if (typeof raw === 'string') {
    const name = raw.trim() || 'Exercise';
    const slotKey = slugKey(name) || `p_${programId}_order_${order}`;
    return {
      order,
      slotKey,
      name,
      targetSets: null,
      durationMin: null,
      caloriesEstimate: null,
      difficultyLevel: null,
      repRangeStr: null,
      muscles: [],
      instructionsList: [],
      videoPath: '',
      thumbPath: '',
      mediaType: '',
      notes: '',
    };
  }

  const o = raw || {};
  const name = String(o.name ?? o.title ?? 'Exercise').trim();

  const slotKey =
    String(o.slotKey ?? o.slug ?? o.code ?? o.id ?? o.programExerciseId ?? '').trim() ||
    slugKey(name) ||
    `p_${programId}_order_${order}`;

  const targetSets = firstFiniteNumber(o.target_sets, o.targetSets, o.sets);
  const repRangeRaw =
    o.target_reps_range ?? o.targetRepsRange ?? o.repRange ?? o.reps ?? '';
  const repRangeStr =
    repRangeRaw != null && String(repRangeRaw).trim() !== ''
      ? String(repRangeRaw).trim()
      : null;

  const durationMin = firstFiniteNumber(
    o.estimated_time,
    o.estimated_time_minutes,
    o.estimatedTimeMinutes,
    o.estimatedTime,
    o.durationMinutes,
    o.durationMin,
    o.timeMin
  );

  const caloriesEstimate = firstFiniteNumber(
    o.estimated_calories,
    o.estimatedCalories,
    o.caloriesEstimate,
    o.calories,
    o.kcal
  );

  const difficultyLevel =
    String(o.difficulty_level ?? o.difficultyLevel ?? o.difficulty ?? '').trim() || null;

  const muscles = parseMusclesArray(
    o.target_muscles ?? o.targetMuscles ?? o.muscles_involved ?? o.muscles
  );

  const instructionsList = parseInstructionsArray(o.instructions);

  const videoPath = String(
    o.video_url ?? o.videoUrl ?? o.mediaUrl ?? o.video ?? ''
  ).trim();
  const thumbPath = String(
    o.thumbnail_url ?? o.thumbnailUrl ?? o.thumbUrl ?? o.thumbnail ?? ''
  ).trim();
  const mediaType = String(o.media_type ?? o.mediaType ?? '').trim();
  const notes = o.notes ? String(o.notes) : '';

  return {
    order,
    slotKey,
    name,
    targetSets,
    durationMin,
    caloriesEstimate,
    difficultyLevel,
    repRangeStr,
    muscles,
    instructionsList,
    videoPath,
    thumbPath,
    mediaType,
    notes,
  };
};

const normalizeExerciseListFromProgram = (rawList, programId) => {
  if (!rawList) return [];
  const arr = Array.isArray(rawList) ? rawList : [rawList];
  return arr.map((item, idx) => {
    const ord =
      item?.order != null && !Number.isNaN(Number(item.order)) ? Number(item.order) : idx + 1;
    return parseExerciseSlotFromProgram(item, ord, programId);
  });
};

/** One line under exercise name — matches list UI: "4 sets × 8-12 • 15 min" */
const formatWorkoutListSubtitle = (slot) => {
  const parts = [];
  const sets =
    slot.targetSets != null && !Number.isNaN(Number(slot.targetSets)) ? Number(slot.targetSets) : null;
  const reps = slot.repRangeStr && String(slot.repRangeStr).trim() ? String(slot.repRangeStr).trim() : null;
  if (sets != null && reps) parts.push(`${sets} sets × ${reps}`);
  else if (sets != null) parts.push(`${sets} sets`);
  else if (reps) parts.push(reps);
  const dm = slot.durationMin != null && !Number.isNaN(Number(slot.durationMin)) ? Number(slot.durationMin) : null;
  if (dm != null) parts.push(`${dm} min`);
  return parts.length ? parts.join(' • ') : null;
};

const buildExercisePayloadForUser = (req, slot, { includeInstructions } = {}) => {
  const videoUrl = slot.videoPath ? toPublicFileUrl(req, slot.videoPath) : '';
  const thumbnailUrlNew = slot.thumbPath
    ? toPublicFileUrl(req, slot.thumbPath)
    : videoUrl;

  const hasVideo =
    !!slot.videoPath &&
    (String(slot.mediaType).toLowerCase() === 'video' ||
      /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(slot.videoPath));

  const listLine = formatWorkoutListSubtitle(slot);

  const base = {
    id: slot.slotKey,
    slotKey: slot.slotKey,
    order: slot.order,
    name: slot.name,
    video_url: videoUrl,
    thumbnail_url: thumbnailUrlNew,
    videoUrl,
    thumbnailUrl: thumbnailUrlNew,
    target_sets: slot.targetSets,
    target_reps_range: slot.repRangeStr,
    estimated_time_minutes: slot.durationMin,
    estimated_calories: slot.caloriesEstimate,
    difficulty_level: slot.difficultyLevel,
    targetSets: slot.targetSets,
    targetRepsRange: slot.repRangeStr,
    estimatedTimeMinutes: slot.durationMin,
    estimatedCalories: slot.caloriesEstimate,
    difficultyLevel: slot.difficultyLevel,
    muscles_involved: slot.muscles,
    musclesInvolved: slot.muscles,
    target_muscles: slot.muscles,
    targetMuscles: slot.muscles,
    target_muscles_text: Array.isArray(slot.muscles) && slot.muscles.length
      ? slot.muscles.join(', ')
      : '',
    listSummaryLine: listLine,
    hasVideo,
    notes: slot.notes,
  };

  if (includeInstructions) {
    base.instructions = slot.instructionsList;
  } else {
    base.instructions = [];
    base.instructions_count = slot.instructionsList.length;
  }

  return base;
};

/** Slim payload for GET /workouts/today (list screen only). Detail: GET /workouts/today/exercise */
const buildTodayWorkoutListItem = (req, slot, completed) => {
  const thumb = slot.thumbPath ? toPublicFileUrl(req, slot.thumbPath) : '';
  const thumbnailUrl = thumb || (slot.videoPath ? toPublicFileUrl(req, slot.videoPath) : '');
  return {
    slotKey: slot.slotKey,
    name: slot.name,
    thumbnail_url: thumbnailUrl,
    sets: slot.targetSets,
    reps_range: slot.repRangeStr,
    duration_minutes: slot.durationMin,
    difficulty: slot.difficultyLevel,
    subtitle: formatWorkoutListSubtitle(slot),
    completed,
  };
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
    return {
      strategy: 'cadence',
      scheduleToken,
      workoutTitle,
      libraryToken: scheduleToken,
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

  return {
    strategy: 'unmapped',
    scheduleToken: null,
    workoutTitle: program.programName,
    libraryToken: null,
  };
};

const estimateSessionMinutes = (exercises, program) => {
  let sum = 0;
  exercises.forEach((ex) => {
    if (ex.durationMin != null && !Number.isNaN(Number(ex.durationMin))) {
      sum += Number(ex.durationMin);
    }
  });
  if (sum > 0) return Math.round(sum);
  if (program.avgSessionMinutes != null && !Number.isNaN(Number(program.avgSessionMinutes))) {
    return Math.round(Number(program.avgSessionMinutes));
  }
  return Math.max(15, exercises.length * 10);
};

const resolveTodaysExerciseSlots = (program, programStartedAt, refDate, programIdStr) => {
  const weekGrid = program.weekGrid && typeof program.weekGrid === 'object' ? program.weekGrid : {};
  const exerciseLibrary =
    program.exerciseLibrary && typeof program.exerciseLibrary === 'object'
      ? program.exerciseLibrary
      : {};

  const dayKey = mondayFirstDayKey(refDate);
  const { weekNum, maxWeek } = resolveWeekNumber(program, weekGrid, refDate, programStartedAt);

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

  let slots = normalizeExerciseListFromProgram(listRaw, programIdStr);
  let resolutionStrategy = inferred.strategy;

  if (!slots.length && Array.isArray(inferred.scheduleToken) === false && inferred.scheduleToken) {
    resolutionStrategy =
      inferred.strategy +
      (inferred.scheduleToken ? '_unmapped_library' : '');
  }

  return {
    slots,
    inferred,
    weekNum,
    maxWeek,
    dayKey,
    exerciseLibrary,
    resolutionStrategy,
  };
};

const getPreviousPerformanceForExercise = async (userId, exerciseName, dayDate) => {
  const cutoff = normalizeCalendarDate(dayDate);
  const log = await WorkoutLog.findOne({
    userId,
    exerciseName: String(exerciseName).trim(),
    date: { $lt: cutoff },
    status: { $ne: 'Deleted' },
  })
    .sort({ date: -1 })
    .lean();

  if (!log?.sets?.length) return null;

  const rows = log.sets;
  const headline = `${rows[0].weight} lbs × ${rows[0].reps} reps • ${rows.length} sets total`;

  return {
    lastSessionDate: log.date,
    summaryText: headline,
    sets: rows.map((s) => ({
      setNumber: s.setNumber,
      weight: s.weight,
      reps: s.reps,
      previousWeight: s.previousWeight,
      previousReps: s.previousReps,
    })),
    notes: log.notes || '',
  };
};

const getTodaysWorkoutLogForExercise = async (userId, exerciseName, dayDate) => {
  const d = normalizeCalendarDate(dayDate);
  return WorkoutLog.findOne({
    userId,
    exerciseName: String(exerciseName).trim(),
    date: d,
    status: { $ne: 'Deleted' },
  }).lean();
};

const loadTodayExerciseContext = async (user_id, slotKey, refDateInput) => {
  const key = String(slotKey || '').trim();
  if (!key) {
    return {
      error: { status: 400, body: { success: false, message: 'slotKey is required' } },
    };
  }
  const refDate = refDateInput ? new Date(refDateInput) : new Date();
  if (Number.isNaN(refDate.getTime())) {
    return {
      error: { status: 400, body: { success: false, message: 'Invalid date' } },
    };
  }
  const user = await User.findById(user_id).select('activeProgramId programStartedAt').lean();
  if (!user) {
    return { error: { status: 400, body: { success: false, message: 'User not found' } } };
  }
  if (!user.activeProgramId || !user.programStartedAt) {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message: 'No active program. POST /api/user/programs/active with programId first.',
        },
      },
    };
  }
  const program = await Program.findOne({
    _id: user.activeProgramId,
    status: 'Active',
  }).lean();
  if (!program) {
    return {
      error: {
        status: 404,
        body: { success: false, message: 'Active program no longer exists' },
      },
    };
  }
  const programIdStr = String(program._id);
  const { slots, inferred, weekNum, maxWeek, dayKey } = resolveTodaysExerciseSlots(
    program,
    user.programStartedAt,
    refDate,
    programIdStr
  );
  const slot = slots.find((s) => s.slotKey === key);
  if (!slot) {
    return {
      error: {
        status: 404,
        body: {
          success: false,
          message: 'Exercise not in today’s program list (check slotKey from GET /workouts/today)',
        },
      },
    };
  }
  const normalizedDate = normalizeCalendarDate(refDate);
  return {
    user,
    program,
    slot,
    inferred,
    weekNum,
    maxWeek,
    dayKey,
    normalizedDate,
  };
};

const buildTodayExerciseDetailScreen = (
  req,
  {
    program,
    slot,
    inferred,
    weekNum,
    maxWeek,
    dayKey,
    normalizedDate,
    completed,
    previousPerformance,
    todaySessionLog,
  }
) => {
  const videoUrl = slot.videoPath ? toPublicFileUrl(req, slot.videoPath) : '';
  const thumbUrl = slot.thumbPath ? toPublicFileUrl(req, slot.thumbPath) : videoUrl;
  const muscles = Array.isArray(slot.muscles) ? slot.muscles : [];

  let todayLogPayload = null;
  if (todaySessionLog?._id) {
    todayLogPayload = {
      log_id: String(todaySessionLog._id),
      notes: todaySessionLog.notes || '',
      sets: (todaySessionLog.sets || []).map((s) => ({
        set: s.setNumber,
        weight_lbs: s.weight,
        reps: s.reps,
        previous_compact:
          s.previousWeight != null && s.previousReps != null
            ? `${s.previousWeight}×${s.previousReps}`
            : '',
        previous_weight_lbs: s.previousWeight ?? null,
        previous_reps: s.previousReps ?? null,
      })),
    };
  }

  let lastWorkoutPayload = null;
  if (previousPerformance?.sets?.length) {
    const rows = previousPerformance.sets;
    lastWorkoutPayload = {
      last_session_date: previousPerformance.lastSessionDate,
      summary_line: previousPerformance.summaryText,
      sets: rows.map((s) => ({
        set: s.setNumber,
        weight_lbs: s.weight,
        reps: s.reps,
        previous_compact:
          s.previousWeight != null && s.previousReps != null
            ? `${s.previousWeight}×${s.previousReps}`
            : '',
      })),
    };
  }

  return {
    date: normalizedDate,
    workout_title: inferred.workoutTitle || program.programName || '',
    schedule_context: {
      week_number: weekNum,
      week_count: maxWeek,
      day_key: dayKey,
      slot_label: inferred.scheduleToken,
    },
    slot_key: slot.slotKey,
    exercise: {
      name: slot.name,
      video_url: videoUrl,
      thumbnail_url: thumbUrl,
      target_sets: slot.targetSets,
      reps_range: slot.repRangeStr,
      time_minutes: slot.durationMin,
      estimated_calories: slot.caloriesEstimate,
      difficulty: slot.difficultyLevel,
      target_muscles_line: muscles.length ? muscles.join(', ') : '',
      target_muscles: muscles,
      muscles_tags: muscles,
      instructions: slot.instructionsList || [],
      completed,
      notes_program: slot.notes || '',
    },
    logging: {
      exercise_name_used_in_logs: slot.name.trim(),
      last_workout: lastWorkoutPayload,
      today_saved_log: todayLogPayload,
    },
  };
};

const parseBodySetsArray = (sets) => {
  let parsedSets = [];
  if (Array.isArray(sets)) parsedSets = sets;
  else if (typeof sets === 'string' && sets.trim()) {
    try {
      parsedSets = JSON.parse(sets);
    } catch (_) {
      return { error: 'sets must be a valid JSON array' };
    }
  }
  if (!parsedSets.length) return { error: 'At least one set is required' };
  const cleaned = parsedSets.map((s, idx) => ({
    setNumber: Number(s.setNumber ?? s.set ?? idx + 1),
    weight: Number(s.weight ?? 0),
    reps: Number(s.reps ?? 0),
    previousWeight:
      s.previousWeight != null && s.previousWeight !== '' ? Number(s.previousWeight) : null,
    previousReps:
      s.previousReps != null && s.previousReps !== '' ? Number(s.previousReps) : null,
  }));
  if (cleaned.some((s) => Number.isNaN(s.weight) || Number.isNaN(s.reps) || Number.isNaN(s.setNumber))) {
    return { error: 'Each set needs numeric setNumber, weight, reps' };
  }
  return { cleaned };
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
        program: rewriteProgramMediaUrlsForResponse(req, program),
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

    const programIdStr = String(program._id);
    const { slots, inferred } = resolveTodaysExerciseSlots(
      program,
      user.programStartedAt,
      refDate,
      programIdStr
    );

    const normalizedDate = normalizeCalendarDate(refDate);
    const completion = await DailyExerciseCompletion.findOne({
      userId: user_id,
      date: normalizedDate,
    }).lean();
    const doneKeys = new Set(
      (completion?.completedSlotKeys || []).map((k) => String(k).trim()).filter(Boolean)
    );

    const exercises = slots.map((slot) =>
      buildTodayWorkoutListItem(req, slot, doneKeys.has(slot.slotKey))
    );

    const exerciseCount = exercises.length;
    const completedCount = exercises.filter((e) => e.completed).length;
    const completionPercent = exerciseCount ? Math.round((completedCount / exerciseCount) * 100) : 0;

    const estimatedMinutes = estimateSessionMinutes(slots, program);
    const sumCals = slots.reduce(
      (a, s) =>
        a +
        (s.caloriesEstimate != null && !Number.isNaN(Number(s.caloriesEstimate))
          ? Number(s.caloriesEstimate)
          : 0),
      0
    );
    let estimatedCalories =
      sumCals > 0 ? Math.round(sumCals) : null;
    if (estimatedCalories == null && estimatedMinutes && program.avgSessionMinutes) {
      estimatedCalories = Math.round(
        (estimatedMinutes / Math.max(Number(program.avgSessionMinutes), 1)) * 300
      );
    } else if (estimatedCalories == null && exerciseCount) {
      estimatedCalories = exerciseCount * 45;
    }

    const workoutTitle = inferred.workoutTitle || program.programName || '';

    return res.json({
      success: true,
      message: "Today's workout",
      result: {
        date: normalizedDate,
        workout_title: workoutTitle,
        summary: {
          total_exercises: exerciseCount,
          completed_exercises: completedCount,
          completion_percent: completionPercent,
          estimated_minutes: estimatedMinutes,
          estimated_calories: estimatedCalories != null ? estimatedCalories : 0,
        },
        exercises,
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

const getTodayExerciseDetailFromProgram = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const slotKey = String(req.query.slotKey || '').trim();
    if (!slotKey) {
      return res.status(400).json({
        success: false,
        message: 'Query slotKey is required (use slotKey from GET /workouts/today)',
      });
    }

    const refDate = req.query.date ? new Date(req.query.date) : new Date();
    const ctx = await loadTodayExerciseContext(user_id, slotKey, refDate);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const completion = await DailyExerciseCompletion.findOne({
      userId: user_id,
      date: ctx.normalizedDate,
    }).lean();
    const doneKeys = new Set(
      (completion?.completedSlotKeys || []).map((k) => String(k).trim()).filter(Boolean)
    );

    const [previousPerformance, todaySessionLog] = await Promise.all([
      getPreviousPerformanceForExercise(user_id, ctx.slot.name, ctx.normalizedDate),
      getTodaysWorkoutLogForExercise(user_id, ctx.slot.name, ctx.normalizedDate),
    ]);

    const result = buildTodayExerciseDetailScreen(req, {
      program: ctx.program,
      slot: ctx.slot,
      inferred: ctx.inferred,
      weekNum: ctx.weekNum,
      maxWeek: ctx.maxWeek,
      dayKey: ctx.dayKey,
      normalizedDate: ctx.normalizedDate,
      completed: doneKeys.has(ctx.slot.slotKey),
      previousPerformance,
      todaySessionLog,
    });

    return res.json({
      success: true,
      message: 'Exercise detail for today',
      result,
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

/**
 * POST body: slotKey (required), date (optional), sets: [{ weight, reps, setNumber? }], notes (optional).
 * Saves WorkoutLog for this exercise display name — same calendar day as today's workout resolution.
 */
const saveTodayExercisePerformance = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const { slotKey, date, sets, notes } = req.body || {};
    const refDate = date ? new Date(date) : new Date();
    const ctx = await loadTodayExerciseContext(user_id, slotKey, refDate);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const parsed = parseBodySetsArray(sets);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });

    const exerciseName = ctx.slot.name.trim();
    const normalizedDate = ctx.normalizedDate;

    let log = await WorkoutLog.findOne({
      userId: user_id,
      date: normalizedDate,
      exerciseName,
      status: { $ne: 'Deleted' },
    });

    if (!log) {
      log = await WorkoutLog.create({
        userId: user_id,
        date: normalizedDate,
        exerciseName,
        notes: (notes != null ? String(notes) : '').trim(),
        sets: parsed.cleaned,
      });
    } else {
      log.sets = parsed.cleaned;
      if (notes != null) log.notes = String(notes).trim();
      await log.save();
    }

    const leanLog = await WorkoutLog.findById(log._id).lean();
    const today_saved_log = leanLog
      ? {
          log_id: String(leanLog._id),
          notes: leanLog.notes || '',
          sets: (leanLog.sets || []).map((s) => ({
            set: s.setNumber,
            weight_lbs: s.weight,
            reps: s.reps,
            previous_compact:
              s.previousWeight != null && s.previousReps != null
                ? `${s.previousWeight}×${s.previousReps}`
                : '',
          })),
        }
      : null;

    return res.json({
      success: true,
      message: 'Performance saved',
      result: {
        date: normalizedDate,
        slot_key: ctx.slot.slotKey,
        exercise_name: exerciseName,
        today_saved_log,
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
  getActiveProgramForUser: getSelectedProgramForUser,
  getTodayWorkout,
  getTodayExerciseDetailFromProgram,
  saveTodayExercisePerformance,
};
