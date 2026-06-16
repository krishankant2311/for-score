const User = require('../model/userModel');
const Program = require('../model/programModel');
const WorkoutLog = require('../model/workoutLogModel');
const DailyExerciseCompletion = require('../model/dailyExerciseCompletionModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');
const { rewriteProgramMediaUrlsForResponse } = require('../../utils/programMediaUrls');

const MON_FIRST_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_LABELS = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** API keys: monday, tuesday, … (full English day names) */
const DAY_API_KEYS = {
  mon: 'monday',
  tue: 'tuesday',
  wed: 'wednesday',
  thu: 'thursday',
  fri: 'friday',
  sat: 'saturday',
  sun: 'sunday',
};

const getMondayOfWeek = (refDate) => {
  const d = normalizeCalendarDate(refDate);
  const js = d.getDay();
  const diff = js === 0 ? -6 : 1 - js;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
};

const addCalendarDays = (refDate, days) => {
  const d = new Date(refDate);
  d.setDate(d.getDate() + days);
  return d;
};

const toDateOnlyString = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const loadActiveProgramContext = async (user_id) => {
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
    isDeleted: { $ne: true },
  }).lean();

  if (!program) {
    return {
      error: {
        status: 404,
        body: { success: false, message: 'Active program no longer exists' },
      },
    };
  }

  return { user, program };
};

const buildDayWorkoutSummary = (slots, program, exercises) => {
  const exerciseCount = exercises.length;
  const completedCount = exercises.filter((e) => e.completed).length;
  const completionPercent = exerciseCount ? Math.round((completedCount / exerciseCount) * 100) : 0;
  const estimatedMinutes = exerciseCount ? estimateSessionMinutes(slots, program) : 0;
  const sumCals = slots.reduce(
    (a, s) =>
      a +
      (s.caloriesEstimate != null && !Number.isNaN(Number(s.caloriesEstimate))
        ? Number(s.caloriesEstimate)
        : 0),
    0
  );
  let estimatedCalories = sumCals > 0 ? Math.round(sumCals) : null;
  if (estimatedCalories == null && estimatedMinutes && program.avgSessionMinutes) {
    estimatedCalories = Math.round(
      (estimatedMinutes / Math.max(Number(program.avgSessionMinutes), 1)) * 300
    );
  } else if (estimatedCalories == null && exerciseCount) {
    estimatedCalories = exerciseCount * 45;
  }

  return {
    total_exercises: exerciseCount,
    completed_exercises: completedCount,
    completion_percent: completionPercent,
    estimated_minutes: estimatedMinutes,
    estimated_calories: estimatedCalories != null ? estimatedCalories : 0,
  };
};

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
  }
  // Substring fallback only for keys with >= 3 chars, so single-letter buckets
  // like "A"/"B"/"C" can't spuriously match tokens like "RECOVERY"/"REST".
  for (const key of Object.keys(exerciseLibrary)) {
    const keyLower = String(key).toLowerCase();
    if (keyLower.length < 3) continue;
    if (lower.includes(keyLower) || keyLower.includes(lower)) {
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
    if (kc === compact) return exerciseLibrary[libKey];
    if (kc.length < 3) continue;
    if (compact.includes(kc) || kc.includes(compact)) return exerciseLibrary[libKey];
  }
  return null;
};

const isCadenceRestToken = (token) =>
  /^rest$/i.test(String(token || '').trim());
const isCadenceRecoveryToken = (token) => {
  const t = String(token || '').trim();
  if (/^recover(y|ies)?$/i.test(t)) return true;
  if (/liss/i.test(t)) return true;
  if (/stretch/i.test(t)) return true;
  if (/^cardio$/i.test(t)) return true;
  if (/active\s*rest/i.test(t)) return true;
  return false;
};
const classifyCadenceDayType = (token) => {
  if (isCadenceRestToken(token)) return 'rest';
  if (isCadenceRecoveryToken(token)) return 'recovery';
  return 'workout';
};

const MODULE_KEYS_BY_LETTER = {
  A: 'module1',
  B: 'module2',
  C: 'module3',
  D: 'module4',
  E: 'module5',
};

/**
 * Human-readable workout title for dashboard / today card (not library key "A"/"B"/"C").
 */
const resolveWorkoutDisplayTitle = (scheduleToken, weekGrid, program, dayKey) => {
  const token =
    scheduleToken != null && scheduleToken !== '' ? String(scheduleToken).trim() : '';
  const grid = weekGrid && typeof weekGrid === 'object' ? weekGrid : {};

  if (!token) return program?.programName || '';

  if (isCadenceRestToken(token)) return 'Rest Day';
  if (isCadenceRecoveryToken(token)) return 'Recovery';

  const dayEntry = dayKey && grid[dayKey] != null ? String(grid[dayKey]).trim() : '';
  if (dayEntry && !/^[A-E]$/i.test(dayEntry)) {
    return dayEntry;
  }

  if (/^[A-E]$/i.test(token)) {
    const modKey = MODULE_KEYS_BY_LETTER[token.toUpperCase()];
    const modLabel = modKey && grid[modKey] != null ? String(grid[modKey]).trim() : '';
    if (modLabel) return modLabel;

    const whatsInside = String(program?.whatsInside ?? '').trim();
    const moduleNames = [
      'Full Body Ignite',
      'Posterior Power',
      'Upper Body Sculpt',
      'Lower Body Burn',
      'Core & Conditioning',
    ];
    const letterIdx = token.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    if (letterIdx >= 0 && letterIdx < moduleNames.length && whatsInside.includes(moduleNames[letterIdx])) {
      return moduleNames[letterIdx];
    }

    const meta =
      program?.workoutsMeta?.[token.toUpperCase()] ?? program?.workoutsMeta?.[token];
    const fmt = meta?.format ? String(meta.format).trim() : '';
    if (fmt && !/^standard sets$/i.test(fmt)) {
      const short = fmt.split(/\s*[—–-]\s*/)[0].trim();
      return short || fmt;
    }
  }

  const meta = program?.workoutsMeta?.[token] ?? program?.workoutsMeta?.[token.toUpperCase()];
  if (meta && typeof meta === 'object') {
    const fmt = String(meta.format ?? meta.title ?? '').trim();
    if (fmt) {
      const short = fmt.split(/\s*[—–-]\s*/)[0].trim();
      return short || fmt;
    }
  }

  if (token.length > 1 && !/^[A-E]$/i.test(token)) {
    return token.charAt(0).toUpperCase() + token.slice(1);
  }

  return program?.programName || token;
};

/**
 * Builds virtual exercise slots from program.recoveryProtocol so the user can
 * see/complete a cardio item + stretches on RECOVERY days using the exact same
 * UI/flow (slotKey, completion, detail) as workout days.
 */
const buildRecoverySlotsFromProgram = (program, programIdStr) => {
  const protocol =
    program && program.recoveryProtocol && typeof program.recoveryProtocol === 'object'
      ? program.recoveryProtocol
      : null;
  if (!protocol) return [];

  const slots = [];
  let order = 1;

  const cardio =
    protocol.cardio && typeof protocol.cardio === 'object' ? protocol.cardio : null;
  if (cardio) {
    const durationMin = firstFiniteNumber(
      cardio.durationMinutes,
      cardio.duration_minutes,
      cardio.duration
    );
    const coachPrompt = String(cardio.coachPrompt ?? cardio.coach_prompt ?? '').trim();
    const activityOptions = Array.isArray(cardio.activityOptions)
      ? cardio.activityOptions
      : Array.isArray(cardio.activity_options)
      ? cardio.activity_options
      : [];
    const instructions = [];
    if (coachPrompt) instructions.push(coachPrompt);
    activityOptions
      .map((x) => String(x).trim())
      .filter(Boolean)
      .forEach((opt) => instructions.push(`Option: ${opt}`));

    const mediaPath = String(
      cardio.media_url ?? cardio.mediaUrl ?? cardio.video_url ?? ''
    ).trim();
    const isVideo = /\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(mediaPath);

    slots.push({
      order: order++,
      slotKey: 'recovery_cardio',
      name: 'Recovery Cardio',
      targetSets: null,
      durationMin: durationMin != null ? durationMin : null,
      caloriesEstimate: null,
      difficultyLevel: null,
      repRangeStr: null,
      muscles: ['cardio'],
      instructionsList: instructions,
      videoPath: isVideo ? mediaPath : '',
      thumbPath: isVideo ? '' : mediaPath,
      mediaType: isVideo ? 'video' : mediaPath ? 'image' : '',
      notes: '',
    });
  }

  const stretches = Array.isArray(protocol.stretches) ? protocol.stretches : [];
  stretches.forEach((s, idx) => {
    const name = String(s?.name ?? '').trim() || `Stretch ${idx + 1}`;
    const detail = String(s?.detail ?? '').trim();
    const slug = slugKey(name) || `stretch_${idx + 1}`;
    slots.push({
      order: order++,
      slotKey: `recovery_stretch_${idx + 1}_${slug}`,
      name,
      targetSets: null,
      durationMin: null,
      caloriesEstimate: null,
      difficultyLevel: null,
      repRangeStr: null,
      muscles: ['stretch'],
      instructionsList: detail ? [detail] : [],
      videoPath: '',
      thumbPath: '',
      mediaType: '',
      notes: '',
    });
  });

  return slots;
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

const parseOptionalString = (v) => {
  if (v == null || v === '') return '';
  return String(v).trim();
};

/** Tempo, rest, alternative, notes — admin program fields for mobile exercise detail. */
const buildExerciseCoachingFields = (slot) => {
  const tempo = slot.tempo || '';
  const rest = slot.restPerExercise || '';
  const alternative = slot.alternative || '';
  const notes = slot.notes || '';
  return {
    tempo,
    rest,
    rest_per_exercise: rest,
    restPerExercise: rest,
    alternative,
    alternative_exercise: alternative,
    notes,
    notes_program: notes,
  };
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
      tempo: '',
      restPerExercise: '',
      alternative: '',
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

  let videoPath = String(
    o.video_url ?? o.videoUrl ?? o.mediaUrl ?? o.video ?? ''
  ).trim();
  let thumbPath = String(
    o.thumbnail_url ?? o.thumbnailUrl ?? o.thumbUrl ?? o.thumbnail ?? ''
  ).trim();
  if (!videoPath && !thumbPath && Array.isArray(o.mediaUrls)) {
    for (const u of o.mediaUrls) {
      const s = String(u || '').trim();
      if (!s) continue;
      if (/\.(mp4|webm|ogg|mov|m4v|mkv|avi)(\?|#|$)/i.test(s)) {
        if (!videoPath) videoPath = s;
      } else if (!thumbPath) {
        thumbPath = s;
      }
    }
  }
  const mediaType = String(o.media_type ?? o.mediaType ?? '').trim();
  const notes = parseOptionalString(o.notes);
  const tempo = parseOptionalString(o.tempo);
  const restPerExercise = parseOptionalString(
    o.restPerExercise ?? o.rest_per_exercise ?? o.rest ?? o.restPerSet
  );
  const alternative = parseOptionalString(
    o.alternative ?? o.alternative_exercise ?? o.alt
  );

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
    tempo,
    restPerExercise,
    alternative,
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
    ...buildExerciseCoachingFields(slot),
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

    const workoutTitle = resolveWorkoutDisplayTitle(
      scheduleToken,
      weekGrid,
      program,
      dayKey
    );
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
    const token = slot != null ? String(slot).trim() : '';
    return {
      strategy: 'weekGrid',
      scheduleToken: token || null,
      workoutTitle: resolveWorkoutDisplayTitle(token, weekGrid, program, dayKey),
      libraryToken: token || null,
    };
  }

  const topSlot = pickDayColumn(weekGrid, dayKey);
  if (topSlot != null) {
    const token = String(topSlot).trim();
    return {
      strategy: 'flatGrid',
      scheduleToken: token,
      workoutTitle: resolveWorkoutDisplayTitle(token, weekGrid, program, dayKey),
      libraryToken: token,
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
  const dayType = classifyCadenceDayType(inferred.scheduleToken);

  // Rest / Recovery cadence tokens should never resolve to a workout library —
  // otherwise loose substring matches can leak the wrong day's exercises.
  // Both keep exercises[] empty; RECOVERY days surface content via a separate
  // `recovery` block (cardio + stretches) attached to the response.
  if (dayType !== 'workout') {
    return {
      slots: [],
      inferred,
      weekNum,
      maxWeek,
      dayKey,
      exerciseLibrary,
      resolutionStrategy: dayType,
      dayType,
    };
  }

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
    dayType,
  };
};

const buildRecoveryPayloadForResponse = (req, program) => {
  const protocol =
    program && program.recoveryProtocol && typeof program.recoveryProtocol === 'object'
      ? program.recoveryProtocol
      : null;
  if (!protocol) return null;

  const cardio =
    protocol.cardio && typeof protocol.cardio === 'object' ? protocol.cardio : null;
  const stretches = Array.isArray(protocol.stretches) ? protocol.stretches : [];

  const cardioMediaPath = cardio
    ? String(cardio.media_url ?? cardio.mediaUrl ?? cardio.video_url ?? '').trim()
    : '';

  return {
    cardio: cardio
      ? {
          duration_minutes: firstFiniteNumber(cardio.durationMinutes, cardio.duration_minutes),
          coach_prompt: String(cardio.coachPrompt ?? cardio.coach_prompt ?? '').trim(),
          activity_options: Array.isArray(cardio.activityOptions)
            ? cardio.activityOptions
                .map((x) => String(x).trim())
                .filter(Boolean)
            : Array.isArray(cardio.activity_options)
            ? cardio.activity_options
                .map((x) => String(x).trim())
                .filter(Boolean)
            : [],
          media_url: cardioMediaPath ? toPublicFileUrl(req, cardioMediaPath) : '',
        }
      : null,
    stretches: stretches.map((s) => ({
      name: String(s?.name ?? '').trim(),
      detail: String(s?.detail ?? '').trim(),
    })),
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
    isDeleted: { $ne: true },
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
  const { slots, inferred, weekNum, maxWeek, dayKey, dayType } = resolveTodaysExerciseSlots(
    program,
    user.programStartedAt,
    refDate,
    programIdStr
  );
  if (dayType && dayType !== 'workout') {
    return {
      error: {
        status: 400,
        body: {
          success: false,
          message:
            dayType === 'rest'
              ? 'Today is a REST day — no exercises scheduled.'
              : 'Today is a RECOVERY day — use the `recovery` block from GET /workouts/today.',
          day_type: dayType,
        },
      },
    };
  }
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
      ...buildExerciseCoachingFields(slot),
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
  const cleaned = parsedSets.map((s, idx) => {
    const setNumberRaw = s?.setNumber ?? s?.set ?? idx + 1;

    // Important: blank (null/''/undefined) should trigger validation error.
    // We should NOT default to 0, otherwise frontend can't show "required" validation.
    const weightRaw = s?.weight ?? s?.weight_lbs ?? s?.weightLbs;
    const repsRaw = s?.reps ?? s?.targetReps ?? s?.repsRange ?? s?.target_reps;

    const weightProvided = weightRaw != null && String(weightRaw).trim() !== '';
    const repsProvided = repsRaw != null && String(repsRaw).trim() !== '';

    const weight = weightProvided ? Number(weightRaw) : null;
    const reps = repsProvided ? Number(repsRaw) : null;

    return {
      setNumber: Number(setNumberRaw),
      weight,
      reps,
      previousWeight:
        s?.previousWeight != null && s.previousWeight !== '' ? Number(s.previousWeight) : null,
      previousReps:
        s?.previousReps != null && s.previousReps !== '' ? Number(s.previousReps) : null,
    };
  });

  if (cleaned.some((s) => Number.isNaN(s.setNumber) || !Number.isFinite(s.setNumber))) {
    return { error: 'Each set needs a numeric setNumber' };
  }

  if (
    cleaned.some(
      (s) =>
        s.weight == null ||
        s.reps == null ||
        Number.isNaN(s.weight) ||
        Number.isNaN(s.reps) ||
        !Number.isFinite(s.weight) ||
        !Number.isFinite(s.reps)
    )
  ) {
    return { error: 'Weight and reps are required for each set' };
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

    const program = await Program.findOne({
      _id: programId,
      status: 'Active',
      isDeleted: { $ne: true },
    }).lean();
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
      isDeleted: { $ne: true },
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

const LIBRARY_ALIAS_KEYS = new Set([
  'workouta',
  'workoutb',
  'workoutc',
  'upper',
  'lower',
  'full',
  'fullbody',
  'alternatives',
  'cardio',
]);

const isExerciseArray = (value) => Array.isArray(value) && value.length > 0;

const resolveSlotsForScheduleToken = (program, programIdStr, scheduleToken, dayKey) => {
  const exerciseLibrary =
    program.exerciseLibrary && typeof program.exerciseLibrary === 'object'
      ? program.exerciseLibrary
      : {};
  const weekGrid = program.weekGrid && typeof program.weekGrid === 'object' ? program.weekGrid : {};

  const token = scheduleToken != null && scheduleToken !== '' ? String(scheduleToken).trim() : '';
  const dayType = classifyCadenceDayType(token);
  if (dayType !== 'workout') {
    return {
      dayType,
      slots: [],
      workoutTitle: resolveWorkoutDisplayTitle(token, weekGrid, program, dayKey),
      scheduleToken: token || null,
    };
  }

  let listRaw = libraryLookup(exerciseLibrary, token);
  if (!listRaw && token) {
    listRaw = guessLibraryFromScheduleToken(exerciseLibrary, token);
  }
  if (!listRaw && /^[A-E]$/i.test(token)) {
    const letter = token.toUpperCase();
    listRaw =
      program.workouts?.[letter] ??
      program.workouts?.[letter.toLowerCase()] ??
      null;
  }

  const slots = normalizeExerciseListFromProgram(listRaw, programIdStr);
  return {
    dayType,
    slots,
    workoutTitle: resolveWorkoutDisplayTitle(token, weekGrid, program, dayKey),
    scheduleToken: token || null,
  };
};

const collectWorkoutModulesFromProgram = (req, program, programIdStr) => {
  const weekGrid = program.weekGrid && typeof program.weekGrid === 'object' ? program.weekGrid : {};
  const exerciseLibrary =
    program.exerciseLibrary && typeof program.exerciseLibrary === 'object'
      ? program.exerciseLibrary
      : {};
  const workoutsObj =
    program.workouts && typeof program.workouts === 'object' && !Array.isArray(program.workouts)
      ? program.workouts
      : {};

  const modules = {};
  const seenSlotSignatures = new Set();

  const addModule = (key, rawList) => {
    const moduleKey = String(key || '').trim();
    if (!moduleKey || !isExerciseArray(rawList)) return;

    const slots = normalizeExerciseListFromProgram(rawList, programIdStr);
    if (!slots.length) return;

    const signature = slots.map((s) => s.slotKey).join('|');
    if (seenSlotSignatures.has(signature)) return;
    seenSlotSignatures.add(signature);

    const meta =
      program.workoutsMeta?.[moduleKey] ??
      program.workoutsMeta?.[moduleKey.toUpperCase()] ??
      null;

    const listItems = slots.map((slot) => buildTodayWorkoutListItem(req, slot, false));

    modules[moduleKey] = {
      module_key: moduleKey,
      workout_title: resolveWorkoutDisplayTitle(moduleKey, weekGrid, program, null),
      day_type: 'workout',
      meta,
      exercise_count: slots.length,
      summary: buildDayWorkoutSummary(slots, program, listItems),
      workouts: listItems,
      exercises: listItems,
    };
  };

  for (const letter of ['A', 'B', 'C', 'D', 'E']) {
    const raw =
      workoutsObj[letter] ??
      exerciseLibrary[letter] ??
      exerciseLibrary[`workout${letter}`] ??
      null;
    addModule(letter, raw);
  }

  for (const key of Object.keys(exerciseLibrary)) {
    if (LIBRARY_ALIAS_KEYS.has(String(key).toLowerCase())) continue;
    if (/^[A-E]$/i.test(key)) continue;
    addModule(key, exerciseLibrary[key]);
  }

  return modules;
};

const buildProgramWeeklyTemplate = (req, program, programIdStr) => {
  const weekGrid = program.weekGrid && typeof program.weekGrid === 'object' ? program.weekGrid : {};
  const weekly_template = {};

  MON_FIRST_KEYS.forEach((dayKey) => {
    const apiDayKey = DAY_API_KEYS[dayKey] || dayKey;
    const inferred = inferScheduleStrategy(weekGrid, 1, dayKey, program);
    const resolved = resolveSlotsForScheduleToken(
      program,
      programIdStr,
      inferred.scheduleToken,
      dayKey
    );

    const workouts = resolved.slots.map((slot) => buildTodayWorkoutListItem(req, slot, false));

    weekly_template[apiDayKey] = {
      day_key: dayKey,
      day_label: DAY_LABELS[dayKey] || dayKey,
      day_type: resolved.dayType,
      schedule_token: resolved.scheduleToken,
      workout_title: resolved.workoutTitle || inferred.workoutTitle || program.programName || '',
      is_rest_day: resolved.dayType === 'rest',
      is_recovery_day: resolved.dayType === 'recovery',
      workouts,
      exercises: workouts,
      recovery:
        resolved.dayType === 'recovery' ? buildRecoveryPayloadForResponse(req, program) : null,
      summary: buildDayWorkoutSummary(resolved.slots, program, workouts),
    };
  });

  return weekly_template;
};

/**
 * GET /api/user/programs/:id/workouts
 * All workouts in a program by program id (modules + weekly template + recovery).
 */
const getProgramWorkoutsById = async (req, res) => {
  try {
    const user_id = req.token?._id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Program id is required' });
    }

    const program = await Program.findOne({
      _id: id,
      status: 'Active',
      isDeleted: { $ne: true },
    }).lean();

    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    const programIdStr = String(program._id);
    const workout_modules = collectWorkoutModulesFromProgram(req, program, programIdStr);
    const weekly_template = buildProgramWeeklyTemplate(req, program, programIdStr);
    const recovery = buildRecoveryPayloadForResponse(req, program);

    const all_workouts = [];
    const seenKeys = new Set();
    Object.values(workout_modules).forEach((mod) => {
      (mod.workouts || []).forEach((item) => {
        const dedupeKey = `${mod.module_key}::${item.slotKey || item.name}`;
        if (seenKeys.has(dedupeKey)) return;
        seenKeys.add(dedupeKey);
        all_workouts.push({
          ...item,
          module_key: mod.module_key,
          workout_title: mod.workout_title,
        });
      });
    });

    return res.json({
      success: true,
      message: 'Program workouts fetched successfully',
      result: {
        program: {
          _id: program._id,
          programName: program.programName,
          programCode: program.programCode,
          durationWeeks: program.durationWeeks,
          daysPerWeek: program.daysPerWeek,
          frequencyPerWeek: program.frequencyPerWeek,
          avgSessionMinutes: program.avgSessionMinutes,
        },
        workout_modules,
        weekly_template,
        recovery,
        all_workouts,
        total_workout_modules: Object.keys(workout_modules).length,
        total_exercises: all_workouts.length,
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

/**
 * GET /api/user/programs/active/weekly-schedule?date=YYYY-MM-DD
 * Returns Mon–Sun workouts for the user's selected (active) program.
 */
const getWeeklyScheduleForActiveProgram = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const ctx = await loadActiveProgramContext(user_id);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    const { user, program } = ctx;
    const refDate = req.query.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(refDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date query' });
    }

    const weekStart = getMondayOfWeek(refDate);
    const weekEnd = addCalendarDays(weekStart, 6);
    const programIdStr = String(program._id);

    const completionDocs = await DailyExerciseCompletion.find({
      userId: user_id,
      date: {
        $gte: normalizeCalendarDate(weekStart),
        $lte: normalizeCalendarDate(weekEnd),
      },
    }).lean();

    const completionByDate = new Map(
      completionDocs.map((doc) => [toDateOnlyString(normalizeCalendarDate(doc.date)), doc])
    );

    const weekly_schedule = {};
    const days = [];

    MON_FIRST_KEYS.forEach((dayKey, index) => {
      const dayDate = addCalendarDays(weekStart, index);
      const normalizedDate = normalizeCalendarDate(dayDate);
      const dateKey = toDateOnlyString(normalizedDate);
      const apiDayKey = DAY_API_KEYS[dayKey] || dayKey;

      const { slots, inferred, weekNum, maxWeek, dayType } = resolveTodaysExerciseSlots(
        program,
        user.programStartedAt,
        dayDate,
        programIdStr
      );

      const completion = completionByDate.get(dateKey);
      const doneKeys = new Set(
        (completion?.completedSlotKeys || []).map((k) => String(k).trim()).filter(Boolean)
      );

      const workouts = slots.map((slot) =>
        buildTodayWorkoutListItem(req, slot, doneKeys.has(slot.slotKey))
      );

      const dayPayload = {
        day_key: dayKey,
        day_label: DAY_LABELS[dayKey] || dayKey,
        date: normalizedDate,
        date_string: dateKey,
        schedule_token: inferred.scheduleToken || null,
        workout_title: inferred.workoutTitle || program.programName || '',
        day_type: dayType,
        week_number: weekNum,
        week_count: maxWeek,
        is_rest_day: dayType === 'rest',
        is_recovery_day: dayType === 'recovery',
        workouts,
        exercises: workouts,
        recovery: dayType === 'recovery' ? buildRecoveryPayloadForResponse(req, program) : null,
        summary: buildDayWorkoutSummary(slots, program, workouts),
      };

      weekly_schedule[apiDayKey] = dayPayload;
      days.push(dayPayload);
    });

    return res.json({
      success: true,
      message: 'Weekly workout schedule fetched successfully',
      result: {
        activeProgramId: user.activeProgramId,
        programStartedAt: user.programStartedAt,
        program: {
          _id: program._id,
          programName: program.programName,
          programCode: program.programCode,
          durationWeeks: program.durationWeeks,
          daysPerWeek: program.daysPerWeek,
        },
        week_start: toDateOnlyString(weekStart),
        week_end: toDateOnlyString(weekEnd),
        weekly_schedule,
        days,
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
      isDeleted: { $ne: true },
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
    const { slots, inferred, dayType } = resolveTodaysExerciseSlots(
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

    const estimatedMinutes = exerciseCount ? estimateSessionMinutes(slots, program) : 0;
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

    const result = {
      date: normalizedDate,
      workout_title: workoutTitle,
      day_type: dayType,
      is_rest_day: dayType === 'rest',
      is_recovery_day: dayType === 'recovery',
      summary: {
        total_exercises: exerciseCount,
        completed_exercises: completedCount,
        completion_percent: completionPercent,
        estimated_minutes: estimatedMinutes,
        estimated_calories: estimatedCalories != null ? estimatedCalories : 0,
      },
      exercises,
    };

    if (dayType === 'recovery') {
      result.recovery = buildRecoveryPayloadForResponse(req, program);
    }

    return res.json({
      success: true,
      message: "Today's workout",
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

const getTodayExerciseDetailFromProgram = async (req, res) => {
  try {
    const user_id = req.token?._id;
    const refDate = req.query.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(refDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date query' });
    }

    const user = await User.findById(user_id)
      .select('activeProgramId programStartedAt')
      .lean();
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
      isDeleted: { $ne: true },
    }).lean();
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Active program no longer exists',
      });
    }

    const programIdStr = String(program._id);
    const { slots, inferred, weekNum, maxWeek, dayKey, dayType } =
      resolveTodaysExerciseSlots(program, user.programStartedAt, refDate, programIdStr);

    const normalizedDate = normalizeCalendarDate(refDate);
    const scheduleContext = {
      week_number: weekNum,
      week_count: maxWeek,
      day_key: dayKey,
      slot_label: inferred.scheduleToken,
    };

    // RECOVERY day → return recovery payload so the same screen can render it.
    if (dayType === 'recovery') {
      return res.json({
        success: true,
        message: 'Recovery day',
        result: {
          date: normalizedDate,
          workout_title: inferred.workoutTitle || 'RECOVERY',
          day_type: 'recovery',
          is_rest_day: false,
          is_recovery_day: true,
          schedule_context: scheduleContext,
          recovery: buildRecoveryPayloadForResponse(req, program),
        },
      });
    }

    // REST day → no exercise content, just the day flags.
    if (dayType === 'rest') {
      return res.json({
        success: true,
        message: 'Rest day',
        result: {
          date: normalizedDate,
          workout_title: inferred.workoutTitle || 'REST',
          day_type: 'rest',
          is_rest_day: true,
          is_recovery_day: false,
          schedule_context: scheduleContext,
        },
      });
    }

    // Workout day → slotKey required, look up the slot.
    const slotKey = String(req.query.slotKey || '').trim();
    if (!slotKey) {
      return res.status(400).json({
        success: false,
        message: 'Query slotKey is required (use slotKey from GET /workouts/today)',
      });
    }
    const slot = slots.find((s) => s.slotKey === slotKey);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not in today’s program list (check slotKey from GET /workouts/today)',
      });
    }

    const completion = await DailyExerciseCompletion.findOne({
      userId: user_id,
      date: normalizedDate,
    }).lean();
    const doneKeys = new Set(
      (completion?.completedSlotKeys || []).map((k) => String(k).trim()).filter(Boolean)
    );

    const [previousPerformance, todaySessionLog] = await Promise.all([
      getPreviousPerformanceForExercise(user_id, slot.name, normalizedDate),
      getTodaysWorkoutLogForExercise(user_id, slot.name, normalizedDate),
    ]);

    const result = buildTodayExerciseDetailScreen(req, {
      program,
      slot,
      inferred,
      weekNum,
      maxWeek,
      dayKey,
      normalizedDate,
      completed: doneKeys.has(slot.slotKey),
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

    const slotKeyToStore = String(ctx.slot.slotKey || '').trim();

    if (!log) {
      log = await WorkoutLog.create({
        userId: user_id,
        date: normalizedDate,
        exerciseName,
        slotKey: slotKeyToStore,
        notes: (notes != null ? String(notes) : '').trim(),
        sets: parsed.cleaned,
      });
    } else {
      log.sets = parsed.cleaned;
      if (notes != null) log.notes = String(notes).trim();
      if (slotKeyToStore) log.slotKey = slotKeyToStore;
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
  getWeeklyScheduleForActiveProgram,
  getProgramWorkoutsById,
  getTodayWorkout,
  getTodayExerciseDetailFromProgram,
  saveTodayExercisePerformance,
  // Helpers exported for reuse by the unified user dashboard controller so
  // the dashboard "Today's Workout" card and the dedicated endpoint stay
  // in sync without duplicating the slot resolution logic.
  resolveTodaysExerciseSlots,
  normalizeCalendarDate,
  estimateSessionMinutes,
  buildTodayWorkoutListItem,
  buildRecoveryPayloadForResponse,
};
