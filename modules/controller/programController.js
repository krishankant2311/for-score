const Program = require('../model/programModel');
const User = require('../model/userModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');
const {
  mergeRecoveryMediaUploads,
  mergeLibraryMediaUploads,
  mergeWorkoutMetaMediaUploads,
  syncExerciseLibraryWorkoutAliases,
  syncWorkoutsFromExerciseLibrary,
  rewriteProgramMediaUrlsForResponse,
  stripBlobMediaUrls,
} = require('../../utils/programMediaUrls');
const { sanitizeExerciseLibrary } = require('../../utils/exerciseDisplayHelpers');

// ---- Helpers ----------------------------------------------------------------

const safeJson = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
};

const toBool = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const s = String(value).toLowerCase().trim();
  if (['true', '1', 'yes'].includes(s)) return true;
  if (['false', '0', 'no'].includes(s)) return false;
  return fallback;
};

const toInt = (value, fallback = 0) => {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  const parsed = safeJson(value, null);
  if (Array.isArray(parsed)) return parsed;
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((s) => String(s).trim())
      .filter(Boolean);
  }
  return [];
};

const parseCsvString = (value) => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((v) => String(v).trim())
    .filter(Boolean);
};

/** Fields loaded for recommendation engine + Change Program list card UI */
const RECOMMENDED_PROGRAM_QUERY_SELECT =
  '_id programName subHeader overview durationWeeks avgSessionMinutes videoPath workoutSkillLevel locationTag primaryGoal workoutPreference tags isGymRequired isHomeFriendly isQuickProgram isPrenatalProgram programCode daysPerWeek frequency createdAt';

/** Slim payload for Change Program / recommended list (screenshot fields only) */
const toRecommendedProgramListItem = (req, program) => {
  const weeks = Math.max(0, Number(program.durationWeeks) || 0);
  const totalDays = weeks > 0 ? weeks * 7 : 0;
  const sessionMins = Math.max(0, Number(program.avgSessionMinutes) || 0);
  const imageRaw = program.videoPath || '';
  const description =
    (program.subHeader && String(program.subHeader).trim()) ||
    (program.overview && String(program.overview).trim()) ||
    '';

  return {
    _id: program._id,
    title: program.programName || '',
    description,
    imageUrl: imageRaw ? toPublicFileUrl(req, imageRaw) : '',
    sessionDuration: sessionMins > 0 ? `${sessionMins} min` : '',
    programDuration: totalDays > 0 ? `${totalDays} Days` : '',
    durationWeeks: weeks || null,
    avgSessionMinutes: sessionMins || null,
    totalDays: totalDays || null,
  };
};

const normalizePersistedMediaUrl = (req, raw) => {
  const s = raw != null ? String(raw).trim() : '';
  if (!s) return '';
  return toPublicFileUrl(req, s) || s;
};

const getProgramIntroVideoPathFromRequest = (req) => {
  if (req.files?.video?.[0]?.path) return req.files.video[0].path;
  return '';
};

const getProgramThumbnailPathFromRequest = (req) => {
  if (req.files?.media?.[0]?.path) return req.files.media[0].path;
  return '';
};

const ok = (res, data, message = 'OK') =>
  res.status(200).json({ success: true, statusCode: 200, message, result: data });

const fail = (res, status, message) =>
  res.status(status).json({ success: false, statusCode: status, message });

/**
 * Frontend admin form (FormData) sends:
 *  - Flat text fields (programName, overview, …)
 *  - JSON-string blobs (weekGrid, exerciseLibrary, recoveryProtocol, programDetail, page2/3/4)
 *  - Logic & engine fields nested inside `programDetail`
 *  - Files (recovery_media, library_media, video) + dot-path targets
 */
const buildProgramDocFromBody = (req) => {
  const body = req.body || {};
  const files = req.files || {};
  const detail = safeJson(body.programDetail ?? body.program_detail, {}) || {};

  const weekGridParsed = safeJson(
    body.weekGrid ?? body.logicGrid ?? body.week_grid ?? body.logic_grid,
    detail.weekGrid ?? null
  );
  const exerciseLibraryParsed = safeJson(
    body.exerciseLibrary ?? body.library ?? body.exercise_library,
    detail.exerciseLibrary ?? null
  );
  const recoveryProtocolParsed = safeJson(
    body.recoveryProtocol ?? body.recovery_protocol ?? body.recovery,
    detail.recoveryProtocol ?? null
  );

  const doc = {
    // ---- Copy ----
    programName: String(body.programName || body.title || body.name || '').trim(),
    subHeader: String(body.subHeader || body.sub_header || '').trim(),
    overview: String(body.overview || body.description || '').trim(),
    whatsInside: String(body.whatsInside || body.whats_inside || '').trim(),
    isThisForYou: String(body.isThisForYou || body.is_this_for_you || '').trim(),
    theGoal: String(body.theGoal || body.the_goal || body.goalText || body.goal_text || '').trim(),
    missionStatement: String(body.missionStatement || detail.missionStatement || '').trim(),
    primaryGoal: String(body.primaryGoal || body.primary_goal || '').trim(),

    // ---- Quick stats ----
    workoutSkillLevel: String(
      body.workoutSkillLevel || body.level || body.workout_skill_level || ''
    ).trim(),
    workoutSkillType: String(
      body.workoutSkillType || body.workout_skill_type || detail.workoutSkillType || ''
    ).trim(),
    workoutPreference: String(
      body.workoutPreference || body.workout_preference || detail.workoutPreference || ''
    ).trim(),
    primaryGoals: asArray(body.primaryGoals || body.primary_goals || detail.primaryGoals),

    durationWeeks: toInt(body.durationWeeks || body.duration_weeks, 4),
    frequencyPerWeek: toInt(body.frequencyPerWeek || body.frequency_per_week, 5),
    avgSessionMinutes: toInt(body.avgSessionMinutes || body.avg_session_minutes, 35),
    frequencyCaption: String(body.frequencyCaption || body.frequency_caption || '').trim(),
    frequency: String(body.frequency || '').trim(),
    daysPerWeek: String(body.daysPerWeek || body.days_per_week || '').trim(),

    locationTag: String(body.locationTag || body.location_tag || '').trim(),
    equipment: String(body.equipment || '').trim(),
    equipmentList: asArray(body.equipmentList || body.equipment_list || detail.equipmentList),
    equipmentNote: String(body.equipmentNote || body.equipment_note || '').trim(),
    noEquipmentRequired: toBool(body.noEquipmentRequired || detail.noEquipmentRequired, false),

    status: String(body.status || 'Active').trim(),
    implementationNote: String(body.implementationNote || body.implementation_note || '').trim(),

    // ---- Logic / engine ----
    phaseCount: toInt(detail.phaseCount, 1),
    phaseStructure:
      detail.phaseStructure ?? {
        transitionTrigger: 'At week number (fixed)',
        changeNotification: '',
        phases: [],
      },
    frequencyRules:
      detail.frequencyRules ?? {
        trainingDaysPerWeek: '',
        recoveryDaysPerWeek: '',
        restDaysPerWeek: '',
        flexibleSchedule: false,
        libraryMode: false,
      },
    progressTracking:
      detail.progressTracking ?? {
        primaryMetric: 'Sets × Reps progression',
        secondaryMetric: '',
        photoCheckIn: false,
        leaderboard: false,
        pbTracker: false,
        habitTracker: false,
      },
    engineSettings: detail.engineSettings ?? { timerTypes: [], uiFeatures: [] },

    // ---- Schedule ----
    schedule: Array.isArray(detail.schedule) ? detail.schedule : [],
    weekGrid: weekGridParsed,

    // ---- Workouts ----
    workouts:
      (detail.workouts && typeof detail.workouts === 'object' && detail.workouts) || {
        A: [],
        B: [],
        C: [],
      },
    workoutsMeta: detail.workoutsMeta ?? null,
    exerciseLibrary: exerciseLibraryParsed,

    // ---- Recovery ----
    recovery:
      (detail.recovery && typeof detail.recovery === 'object' && detail.recovery) || {
        lissMinutes: 20,
        lissPrompt: '',
        lissOptions: '',
        stretches: [],
        mediaUrls: [],
      },
    recoveryProtocol: recoveryProtocolParsed,
    recoveryBlocks: Array.isArray(detail.recoveryBlocks) ? detail.recoveryBlocks : [],
    restDayConfig:
      detail.restDayConfig ?? {
        type: 'Full rest (no activity)',
        message: '',
        deepRecovery: false,
        outdoorActivity: false,
      },
    injuryPrevention:
      detail.injuryPrevention ?? {
        notes: '',
        prenatalMode: false,
        weightGuard: false,
        deloadWeeks: false,
      },
    recoveryTips: Array.isArray(detail.recoveryTips) ? detail.recoveryTips : [],

    // ---- Carry blobs ----
    page2: safeJson(body.page2, detail.page2 ?? null),
    page3: safeJson(body.page3, detail.page3 ?? null),
    page4: safeJson(body.page4, detail.page4 ?? null),
    programDetail: detail,

    // ---- Legacy matching-engine flags / hints (kept so recommender keeps working)
    programCode: String(body.programCode || body.program_code || detail.programCode || '').trim(),
    tags: asArray(body.tags || detail.tags),
    isGymRequired: toBool(body.isGymRequired ?? detail.isGymRequired, false),
    isHomeFriendly: toBool(body.isHomeFriendly ?? detail.isHomeFriendly, false),
    isQuickProgram: toBool(body.isQuickProgram ?? detail.isQuickProgram, false),
    isPrenatalProgram: toBool(body.isPrenatalProgram ?? detail.isPrenatalProgram, false),
    minSessionMinutes:
      body.minSessionMinutes != null && body.minSessionMinutes !== ''
        ? toInt(body.minSessionMinutes, null)
        : detail.minSessionMinutes ?? null,
    maxSessionMinutes:
      body.maxSessionMinutes != null && body.maxSessionMinutes !== ''
        ? toInt(body.maxSessionMinutes, null)
        : detail.maxSessionMinutes ?? null,
    goalText: String(body.goalText || body.goal_text || detail.goalText || '').trim(),
    quickStats: safeJson(body.quickStats, detail.quickStats ?? null),

    videoPath: normalizePersistedMediaUrl(
      req,
      getProgramIntroVideoPathFromRequest(req) ||
        (body.videoPath != null ? String(body.videoPath).trim() : '')
    ),
    thumbnail_url: normalizePersistedMediaUrl(
      req,
      getProgramThumbnailPathFromRequest(req) ||
        (body.thumbnail_url != null ? String(body.thumbnail_url).trim() : '') ||
        (detail.thumbnail_url != null ? String(detail.thumbnail_url).trim() : '') ||
        (detail.programThumbnailUrl != null ? String(detail.programThumbnailUrl).trim() : '')
    ),

    createdByEmail: String(body.email || req.token?.email || '').trim(),
  };

  // ---- File uploads: write public URLs straight into the right slots ----
  if (doc.recoveryProtocol && typeof doc.recoveryProtocol === 'object') {
    mergeRecoveryMediaUploads(req, doc.recoveryProtocol);
    stripBlobMediaUrls(doc.recoveryProtocol);
  }
  if (doc.exerciseLibrary && typeof doc.exerciseLibrary === 'object') {
    mergeLibraryMediaUploads(req, doc.exerciseLibrary);
    stripBlobMediaUrls(doc.exerciseLibrary);
    syncExerciseLibraryWorkoutAliases(doc.exerciseLibrary);
    sanitizeExerciseLibrary(doc.exerciseLibrary, doc.workoutSkillLevel);
  }
  if (doc.workoutsMeta && typeof doc.workoutsMeta === 'object') {
    mergeWorkoutMetaMediaUploads(req, doc.workoutsMeta);
    stripBlobMediaUrls(doc.workoutsMeta);
  }

  if (doc.workouts && typeof doc.workouts === 'object') {
    doc.workouts = syncWorkoutsFromExerciseLibrary(doc.workouts, doc.exerciseLibrary);
  }
  if (doc.page3 && typeof doc.page3 === 'object') {
    for (const letter of ['A', 'B', 'C']) {
      const list = doc.workouts?.[letter];
      if (Array.isArray(list)) {
        doc.page3[letter] = list;
        doc.page3[`workout${letter}`] = list;
      }
    }
  }
  if (doc.programDetail && typeof doc.programDetail === 'object') {
    doc.programDetail.exerciseLibrary = doc.exerciseLibrary;
    doc.programDetail.workouts = doc.workouts;
    doc.programDetail.workoutsMeta = doc.workoutsMeta;
    if (doc.thumbnail_url) doc.programDetail.programThumbnailUrl = doc.thumbnail_url;
    if (doc.page3) doc.programDetail.page3 = doc.page3;
  }

  // Also fold recovery_media into doc.recovery.mediaUrls (matches new model)
  const recoveryFilesRaw = req.files?.recovery_media;
  const recoveryFiles = Array.isArray(recoveryFilesRaw)
    ? recoveryFilesRaw
    : recoveryFilesRaw
    ? [recoveryFilesRaw]
    : [];
  if (recoveryFiles.length) {
    const recovery =
      doc.recovery && typeof doc.recovery === 'object'
        ? doc.recovery
        : { lissMinutes: 20, lissPrompt: '', lissOptions: '', stretches: [], mediaUrls: [] };
    const existing = Array.isArray(recovery.mediaUrls) ? recovery.mediaUrls : [];
    const uploaded = recoveryFiles
      .map((f) => normalizePersistedMediaUrl(req, f.path))
      .filter(Boolean);
    recovery.mediaUrls = [
      ...existing.filter((u) => !!u && !String(u).startsWith('blob:')),
      ...uploaded,
    ];
    doc.recovery = recovery;
  }

  return doc;
};

// ---- Admin CRUD -------------------------------------------------------------

const create = async (req, res) => {
  try {
    if (!String(req.body?.programName || req.body?.title || req.body?.name || '').trim()) {
      return fail(res, 400, 'Program name is required.');
    }
    const doc = buildProgramDocFromBody(req);
    const created = await Program.create(doc);
    return ok(
      res,
      rewriteProgramMediaUrlsForResponse(req, created),
      'Program created.'
    );
  } catch (err) {
    console.error('create program error:', err);
    return fail(res, 500, err.message || 'Failed to create program');
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return fail(res, 400, 'Missing program id.');

    const existing = await Program.findById(id);
    if (!existing || existing.isDeleted) {
      return fail(res, 404, 'Program not found.');
    }

    const incoming = buildProgramDocFromBody(req);
    Object.assign(existing, incoming);

    await existing.save();
    return ok(
      res,
      rewriteProgramMediaUrlsForResponse(req, existing),
      'Program updated.'
    );
  } catch (err) {
    console.error('update program error:', err);
    return fail(res, 500, err.message || 'Failed to update program');
  }
};

const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Program.findById(id).lean();
    if (!doc || doc.isDeleted) return fail(res, 404, 'Program not found.');
    return ok(res, rewriteProgramMediaUrlsForResponse(req, doc));
  } catch (err) {
    return fail(res, 500, err.message || 'Failed to fetch program');
  }
};

const list = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(1000, Math.max(1, toInt(req.query.limit, 25)));
    const q = String(req.query.q || req.query.search || '').trim();
    const statusRaw = String(req.query.status || '').trim().toLowerCase();
    const levelRaw = String(req.query.level || '').trim();

    const filter = { isDeleted: { $ne: true } };
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { programName: regex },
        { subHeader: regex },
        { overview: regex },
        { workoutSkillLevel: regex },
      ];
    }
    if (levelRaw && levelRaw.toLowerCase() !== 'all') {
      const levelRegex = new RegExp(
        `^${levelRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      );
      filter.workoutSkillLevel = levelRegex;
    }
    if (statusRaw === 'active') filter.status = 'Active';
    else if (statusRaw === 'inactive') filter.status = 'Inactive';
    else if (statusRaw === 'draft') filter.status = 'Draft';
    else if (statusRaw === 'archived') filter.status = 'Archived';

    const [programs, total] = await Promise.all([
      Program.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Program.countDocuments(filter),
    ]);

    return ok(res, {
      programs: programs.map((p) => rewriteProgramMediaUrlsForResponse(req, p)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return fail(res, 500, err.message || 'Failed to fetch programs');
  }
};

const remove = async (req, res) => {
  try {
    const id =
      req.params.id || req.body?.id || req.body?.programId || req.body?._id;
    if (!id) return fail(res, 400, 'Missing program id.');

    const doc = await Program.findById(id);
    if (!doc) return fail(res, 404, 'Program not found.');

    doc.isDeleted = true;
    doc.deletedAt = new Date();
    doc.status = 'Deleted';
    await doc.save();

    return ok(res, { id: String(doc._id) }, 'Program deleted.');
  } catch (err) {
    return fail(res, 500, err.message || 'Failed to delete program');
  }
};

// ---- User-side ---------------------------------------------------------------

const userProgramFilter = (extra = {}) => ({
  status: 'Active',
  isDeleted: { $ne: true },
  ...extra,
});

const RECOMMENDED_USER_SELECT =
  'trainingLocation workoutSkillLevel workoutPreferences fitnessTarget workoutFrequency workoutDuration';

/**
 * Same rules as GET /programs/recommended/me — returns ordered programs that match the user profile.
 */
const computeRecommendedProgramsForUser = (user, activePrograms) => {
  if (!user || !Array.isArray(activePrograms) || !activePrograms.length) {
    return { programs: [], ruleApplied: 'NoUserOrPrograms' };
  }

  const location = (user.trainingLocation || '').toLowerCase();
  const userSkill = (user.workoutSkillLevel || '').toUpperCase();
  const preferenceRaw = (user.workoutPreferences || '').toLowerCase();
  const preferenceItems = parseCsvString(user.workoutPreferences).map((x) => x.toLowerCase());
  const allPreferenceTerms = [...new Set([preferenceRaw, ...preferenceItems].filter(Boolean))];
  const target = (user.fitnessTarget || '').toUpperCase();
  const frequency = Number(user.workoutFrequency || 0);

  const hasTerm = (...terms) =>
    terms.some((term) => allPreferenceTerms.some((pref) => pref.includes(term)));

  const sortByNewest = (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  if (hasTerm('prenatal', 'postpartum')) {
    const prenatalList = activePrograms
      .filter(
        (p) =>
          p.isPrenatalProgram === true ||
          /prenatal|postpartum|radiant forge/i.test(`${p.programName} ${p.programCode || ''}`)
      )
      .sort(sortByNewest);
    if (prenatalList.length) {
      return { programs: prenatalList, ruleApplied: 'SafetyFlagPrenatalPostpartum' };
    }
  }

  const workoutDuration = Number(user.workoutDuration || 0);
  if (
    (workoutDuration > 0 && workoutDuration < 20) ||
    hasTerm('quick', 'quickies', 'limited time', 'express')
  ) {
    const quickList = activePrograms
      .filter(
        (p) =>
          p.isQuickProgram === true ||
          /15[- ]?minute|quick hits|quickies|express/i.test(`${p.programName} ${p.programCode || ''}`)
      )
      .sort(sortByNewest);
    if (quickList.length) {
      return { programs: quickList, ruleApplied: 'QuickiePriority' };
    }
  }

  const skillMap = {
    BEGINNER: ['Beginner', 'Beg / Int', 'Any'],
    INTERMEDIATE: ['Intermediate', 'Beg / Int', 'Any'],
    ADVANCED: ['Advanced', 'Any'],
  };
  const allowedSkills = skillMap[userSkill] || ['Any', 'Beg / Int'];

  const goalTerms = [];
  if (target === 'WEIGHTLOSS') goalTerms.push('weight loss', 'hiit', 'shred', 'burn');
  else if (target === 'MUSCLEGAIN') goalTerms.push('muscle', 'strength', 'weight lifting');
  else if (target === 'STRENGTH') goalTerms.push('strength', 'weight lifting');
  else goalTerms.push('general fitness', 'functional', 'core', 'flow');

  if (allPreferenceTerms.length) goalTerms.push(...allPreferenceTerms);

  let candidates = activePrograms.filter((p) => {
    const loc = (p.locationTag || '').toLowerCase();
    const pSkill = p.workoutSkillLevel;
    const pGoal = `${p.primaryGoal || ''} ${p.workoutPreference || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
    const gymRequired =
      p.isGymRequired === true || /gym required|commercial gym required/i.test(loc);
    const homeFriendly =
      p.isHomeFriendly === true || /home|anywhere|no equipment|home friendly/.test(loc);

    const locationOk =
      location === 'home_workouts'
        ? homeFriendly && !gymRequired
        : location === 'gym_training'
          ? loc.includes('gym') || loc.includes('any') || gymRequired
          : true;

    const skillOk = allowedSkills.includes(pSkill);
    const goalOk = goalTerms.some((term) => pGoal.includes(String(term).toLowerCase()));

    return locationOk && skillOk && goalOk;
  });

  if (location === 'home_workouts') {
    candidates = candidates.filter(
      (p) =>
        !/elite strength|functional strength and mastery|crossfit|shred to stage/i.test(
          `${p.programName} ${p.programCode || ''}`
        )
    );
  }

  if (frequency === 3 && candidates.length > 1) {
    const priorityNames = [
      /foundations/i,
      /ignite/i,
      /shred\s*&\s*burn|shred and burn/i,
      /bodyweight basics/i,
    ];
    const prioritized = candidates.filter((p) => priorityNames.some((rx) => rx.test(p.programName)));
    if (prioritized.length) candidates = prioritized;
  }

  if (!candidates.length) {
    const fallback = activePrograms.find((p) => /28-day full body foundations/i.test(p.programName));
    if (fallback) {
      return { programs: [fallback], ruleApplied: 'NoMatchFallback' };
    }
    const latestList = [...activePrograms].sort(sortByNewest);
    return { programs: latestList, ruleApplied: 'LatestActiveFallback' };
  }

  const scoreProgram = (p) => {
    let score = 0;
    const blob = `${p.programName || ''} ${p.primaryGoal || ''} ${p.workoutPreference || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
    if (allowedSkills.includes(p.workoutSkillLevel)) score += 3;
    if (goalTerms.some((term) => blob.includes(String(term).toLowerCase()))) score += 4;
    if (
      location === 'home_workouts' &&
      (p.isHomeFriendly || /home|anywhere|no equipment/i.test(p.locationTag || ''))
    ) {
      score += 3;
    }
    if (location === 'gym_training' && (p.isGymRequired || /gym/i.test(p.locationTag || ''))) {
      score += 3;
    }
    if (frequency && p.daysPerWeek && Number(p.daysPerWeek) === frequency) score += 2;
    if (frequency && p.frequency && String(p.frequency).includes(String(frequency))) score += 1;
    return score;
  };

  const ranked = candidates
    .map((p) => ({ p, score: scoreProgram(p) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.p.createdAt).getTime() - new Date(a.p.createdAt).getTime();
    })
    .map((x) => x.p);

  return { programs: ranked, ruleApplied: 'ProfileMatch' };
};

const attachRecommendationStatus = (programs, recommendedPrograms) => {
  const recommendedIds = new Set(recommendedPrograms.map((p) => String(p._id)));
  return programs.map((program) => {
    const isRecommended = recommendedIds.has(String(program._id));
    return {
      ...program,
      isRecommended,
      recommendationStatus: isRecommended ? 'Recommended' : 'Not Recommended',
    };
  });
};

const getAllProgramsByUser = async (req, res) => {
  try {
    const user_id = req.token?._id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const [user, programs] = await Promise.all([
      User.findById(user_id).select(RECOMMENDED_USER_SELECT).lean(),
      Program.find(userProgramFilter()).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    ]);

    const programsForReco = programs.map((p) => ({
      _id: p._id,
      programName: p.programName,
      programCode: p.programCode,
      primaryGoal: p.primaryGoal,
      workoutPreference: p.workoutPreference,
      workoutSkillLevel: p.workoutSkillLevel,
      locationTag: p.locationTag,
      tags: p.tags,
      isGymRequired: p.isGymRequired,
      isHomeFriendly: p.isHomeFriendly,
      isQuickProgram: p.isQuickProgram,
      isPrenatalProgram: p.isPrenatalProgram,
      daysPerWeek: p.daysPerWeek,
      frequency: p.frequency,
      createdAt: p.createdAt,
    }));

    const { programs: recommendedPrograms } = computeRecommendedProgramsForUser(user, programsForReco);

    const withMedia = programs.map((p) => rewriteProgramMediaUrlsForResponse(req, p));
    const result = attachRecommendationStatus(withMedia, recommendedPrograms);

    return res.json({
      success: true,
      message: 'Programs fetched successfully',
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

const getProgramByUserAndId = async (req, res) => {
  try {
    const user_id = req.token?._id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { id } = req.params;
    const [user, program, allPrograms] = await Promise.all([
      User.findById(user_id).select(RECOMMENDED_USER_SELECT).lean(),
      Program.findOne(userProgramFilter({ _id: id })).lean(),
      Program.find(userProgramFilter()).select(RECOMMENDED_PROGRAM_QUERY_SELECT).lean(),
    ]);

    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    const { programs: recommendedPrograms } = computeRecommendedProgramsForUser(user, allPrograms);
    const [withStatus] = attachRecommendationStatus(
      [rewriteProgramMediaUrlsForResponse(req, program)],
      recommendedPrograms
    );

    return res.json({
      success: true,
      message: 'Program fetched successfully',
      result: withStatus,
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

const getRecommendedProgramByUserProfile = async (req, res) => {
  try {
    const toListItem = (p) => toRecommendedProgramListItem(req, p);

    const parsePositiveInt = (v, fallback) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    const page = parsePositiveInt(req.query?.page, 1);
    const rawLimit = parsePositiveInt(req.query?.limit, 10);
    const limit = Math.min(rawLimit, 50);

    const paginate = (list, ruleApplied) => {
      const total = list.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
      const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
      const startIdx = (safePage - 1) * limit;
      const slice = list.slice(startIdx, startIdx + limit).map(toListItem);
      const top = list[0] ? toListItem(list[0]) : null;
      return {
        success: true,
        message: 'Recommended programs fetched successfully',
        result: slice,
        top,
        pagination: {
          page: safePage,
          limit,
          total,
          totalPages,
          hasNext: safePage < totalPages,
          hasPrev: safePage > 1,
        },
        meta: { ruleApplied },
      };
    };

    const user_id = req.token?._id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await User.findById(user_id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const activePrograms = await Program.find(userProgramFilter())
      .select(RECOMMENDED_PROGRAM_QUERY_SELECT)
      .lean();
    if (!activePrograms.length) {
      return res
        .status(404)
        .json({ success: false, message: 'No active programs available' });
    }

    const { programs: ranked, ruleApplied } = computeRecommendedProgramsForUser(
      user,
      activePrograms
    );

    return res.json(paginate(ranked, ruleApplied));
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
  // ---- New admin CRUD ----
  create,
  update,
  getOne,
  list,
  remove,

  // ---- Legacy admin names (so existing routes/imports keep working) ----
  addProgram: create,
  updateProgram: update,
  getProgramById: getOne,
  getAllPrograms: list,
  deleteProgram: remove,

  // ---- User-side ----
  getAllProgramsByUser,
  getProgramByUserAndId,
  getRecommendedProgramByUserProfile,
};
