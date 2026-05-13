const Program = require('../model/programModel');
const User = require('../model/userModel');
const { toPublicFileUrl } = require('../../utils/publicFileUrl');
const {
  mergeRecoveryMediaUploads,
  mergeLibraryMediaUploads,
  rewriteProgramMediaUrlsForResponse,
  stripBlobMediaUrls,
} = require('../../utils/programMediaUrls');

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

const normalizePersistedMediaUrl = (req, raw) => {
  const s = raw != null ? String(raw).trim() : '';
  if (!s) return '';
  return toPublicFileUrl(req, s) || s;
};

const getProgramVideoPathFromRequest = (req) => {
  if (req.file?.path) return req.file.path;
  if (req.files?.video?.[0]?.path) return req.files.video[0].path;
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
      getProgramVideoPathFromRequest(req) ||
        (body.videoPath != null ? String(body.videoPath).trim() : '')
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

    const filter = { isDeleted: { $ne: true } };
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ programName: regex }, { subHeader: regex }, { overview: regex }];
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

const getAllProgramsByUser = async (req, res) => {
  try {
    const user_id = req.token?._id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const programs = await Program.find(userProgramFilter())
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Programs fetched successfully',
      result: programs.map((p) => rewriteProgramMediaUrlsForResponse(req, p)),
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
    const program = await Program.findOne(userProgramFilter({ _id: id })).lean();
    if (!program) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }

    return res.json({
      success: true,
      message: 'Program fetched successfully',
      result: rewriteProgramMediaUrlsForResponse(req, program),
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
    const withMedia = (p) => rewriteProgramMediaUrlsForResponse(req, p);
    const user_id = req.token?._id;
    if (!user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await User.findById(user_id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const location = (user.trainingLocation || '').toLowerCase();
    const userSkill = (user.workoutSkillLevel || '').toUpperCase();
    const preferenceRaw = (user.workoutPreferences || '').toLowerCase();
    const preferenceItems = parseCsvString(user.workoutPreferences).map((x) =>
      x.toLowerCase()
    );
    const allPreferenceTerms = [
      ...new Set([preferenceRaw, ...preferenceItems].filter(Boolean)),
    ];
    const target = (user.fitnessTarget || '').toUpperCase();
    const frequency = Number(user.workoutFrequency || 0);
    const workoutDuration = Number(user.workoutDuration || 0);

    const activePrograms = await Program.find(userProgramFilter()).lean();
    if (!activePrograms.length) {
      return res
        .status(404)
        .json({ success: false, message: 'No active programs available' });
    }

    const hasTerm = (...terms) =>
      terms.some((term) => allPreferenceTerms.some((pref) => pref.includes(term)));

    if (hasTerm('prenatal', 'postpartum')) {
      const prenatal = activePrograms.find(
        (p) =>
          p.isPrenatalProgram === true ||
          /prenatal|postpartum|radiant forge/i.test(
            `${p.programName} ${p.programCode || ''}`
          )
      );
      if (prenatal) {
        return res.json({
          success: true,
          message: 'Recommended program fetched successfully',
          result: withMedia(prenatal),
          meta: { ruleApplied: 'SafetyFlagPrenatalPostpartum' },
        });
      }
    }

    if (
      (workoutDuration > 0 && workoutDuration < 20) ||
      hasTerm('quick', 'quickies', 'limited time', 'express')
    ) {
      const quickie = activePrograms.find(
        (p) =>
          p.isQuickProgram === true ||
          /15[- ]?minute|quick hits|quickies|express/i.test(
            `${p.programName} ${p.programCode || ''}`
          )
      );
      if (quickie) {
        return res.json({
          success: true,
          message: 'Recommended program fetched successfully',
          result: withMedia(quickie),
          meta: { ruleApplied: 'QuickiePriority' },
        });
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
    else if (target === 'MUSCLEGAIN')
      goalTerms.push('muscle', 'strength', 'weight lifting');
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
        p.isHomeFriendly === true ||
        /home|anywhere|no equipment|home friendly/.test(loc);

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
      const prioritized = candidates.filter((p) =>
        priorityNames.some((rx) => rx.test(p.programName))
      );
      if (prioritized.length) candidates = prioritized;
    }

    if (!candidates.length) {
      const fallback = activePrograms.find((p) =>
        /28-day full body foundations/i.test(p.programName)
      );
      if (fallback) {
        return res.json({
          success: true,
          message: 'Recommended program fetched successfully',
          result: withMedia(fallback),
          meta: { ruleApplied: 'NoMatchFallback' },
        });
      }
      const latest = activePrograms.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      return res.json({
        success: true,
        message: 'Recommended program fetched successfully',
        result: withMedia(latest),
        meta: { ruleApplied: 'LatestActiveFallback' },
      });
    }

    const scoreProgram = (p) => {
      let score = 0;
      const blob = `${p.programName || ''} ${p.primaryGoal || ''} ${p.workoutPreference || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
      if (allowedSkills.includes(p.workoutSkillLevel)) score += 3;
      if (goalTerms.some((term) => blob.includes(String(term).toLowerCase()))) score += 4;
      if (
        location === 'home_workouts' &&
        (p.isHomeFriendly || /home|anywhere|no equipment/i.test(p.locationTag || ''))
      )
        score += 3;
      if (
        location === 'gym_training' &&
        (p.isGymRequired || /gym/i.test(p.locationTag || ''))
      )
        score += 3;
      if (frequency && p.daysPerWeek && Number(p.daysPerWeek) === frequency) score += 2;
      if (frequency && p.frequency && String(p.frequency).includes(String(frequency)))
        score += 1;
      return score;
    };

    const recommended = candidates
      .map((p) => ({ p, score: scoreProgram(p) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.p.createdAt).getTime() - new Date(a.p.createdAt).getTime();
      })[0]?.p;

    return res.json({
      success: true,
      message: 'Recommended program fetched successfully',
      result: withMedia(recommended),
      meta: { ruleApplied: 'ProfileMatch' },
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
