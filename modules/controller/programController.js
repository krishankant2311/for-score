const { Admin } = require('../model/adminModel');
const Program = require('../model/programModel');
const User = require('../model/userModel');

const parseJsonIfString = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return fallback;
    }
  }
  return value;
};

const parseStringArray = (value) => {
  const parsed = parseJsonIfString(value, value);
  if (Array.isArray(parsed)) {
    return parsed.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof parsed === 'string' && parsed.trim()) {
    return parsed
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const parseOptionalNumber = (value) => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isNonEmptyObject = (value) => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
};

/**
 * UI step aliases:
 * - schedule/logic grid -> `weekGrid` (also accept `logicGrid`)
 * - workouts library -> `exerciseLibrary` (also accept `library`)
 * - recovery step -> `recoveryProtocol` (also accept `recovery`)
 */
const pickProgramStepPayload = (body) => {
  const isBlankString = (v) => typeof v === 'string' && !v.trim();
  const normalizeMaybe = (v) => (isBlankString(v) ? null : v);

  const weekGrid = normalizeMaybe(
    body.weekGrid ??
      body.week_grid ??
      body.logicGrid ??
      body.logic_grid ??
      body.schedule ??
      body.scheduleGrid ??
      body.programSchedule ??
      body.page2 ??
      body.step2 ??
      null
  );
  const exerciseLibrary = normalizeMaybe(
    body.exerciseLibrary ??
      body.exercise_library ??
      body.library ??
      body.workouts ??
      body.workoutLibrary ??
      body.workoutsLibrary ??
      body.page3 ??
      body.step3 ??
      null
  );
  const recoveryProtocol = normalizeMaybe(
    body.recoveryProtocol ??
      body.recovery_protocol ??
      body.recovery ??
      body.recoveryStep ??
      body.recoveryPlan ??
      body.recovery_plan ??
      body.recoveryGrid ??
      body.recovery_grid ??
      body.page4 ??
      body.step4 ??
      body.fourthPage ??
      body.fourth_page ??
      null
  );
  return { weekGrid, exerciseLibrary, recoveryProtocol };
};

/** Keeps `quickStats` in sync with top-level fields for mobile badges / legacy clients */
const syncQuickStatsFromProgramFields = (p) => {
  const equipment = Array.isArray(p.equipment) ? p.equipment : [];
  p.quickStats = {
    level: p.workoutSkillLevel || '',
    duration: p.durationWeeks != null ? String(p.durationWeeks) : '',
    frequency: p.daysPerWeek != null ? String(p.daysPerWeek) : '',
    avgSessionMinutes: p.avgSessionMinutes,
    locationTag: (p.locationTag || '').trim(),
    necessaryEquipment: equipment,
  };
};

// 1. Add Program
const addProgram = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }
    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const {
      programName,
      primaryGoal,
      locationTag,
      workoutSkillLevel,
      workoutPreference,
      frequency,
      status,
      subHeader,
      overview,
      whatsInside,
      isThisForYou,
      goalText,
      durationWeeks,
      daysPerWeek,
      avgSessionMinutes,
      equipment,
      quickStats,
    } = req.body;
    const { weekGrid, exerciseLibrary, recoveryProtocol } = pickProgramStepPayload(req.body);

    if (
      !programName?.trim() ||
      !String(subHeader ?? '').trim() ||
      !String(overview ?? '').trim() ||
      !workoutSkillLevel
    ) {
      return res.status(400).json({
        success: false,
        message:
          'programName, subHeader, overview and workoutSkillLevel (Level) are required',
      });
    }

    // Save ONLY when all 4 pages are provided (page2/page3/page4 must be present).
    const weekGridParsed = parseJsonIfString(weekGrid, null);
    const exerciseLibraryParsed = parseJsonIfString(exerciseLibrary, null);
    const recoveryProtocolParsed = parseJsonIfString(recoveryProtocol, null);
    if (
      !isNonEmptyObject(weekGridParsed) ||
      !isNonEmptyObject(exerciseLibraryParsed) ||
      !isNonEmptyObject(recoveryProtocolParsed)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Please submit all program pages (weekGrid/exerciseLibrary/recoveryProtocol) before saving.',
      });
    }

    const skillAllowed = ['Beginner', 'Intermediate', 'Advanced', 'Any', 'Beg / Int'];
    if (!skillAllowed.includes(workoutSkillLevel)) {
      return res.status(400).json({
        success: false,
        message: 'workoutSkillLevel must be Beginner, Intermediate, Advanced, Any or Beg / Int',
      });
    }

    const statusVal =
      status && ['Active', 'Inactive', 'Draft'].includes(status) ? status : 'Active';

    const goalTrim = (goalText || '').trim();
    const primaryGoalVal =
      (primaryGoal && String(primaryGoal).trim()) || goalTrim || '';
    const durationWeeksNum = parseOptionalNumber(durationWeeks);
    const daysPerWeekNum = parseOptionalNumber(daysPerWeek);
    const avgSessionNum = parseOptionalNumber(avgSessionMinutes);
    const equipmentArr = parseStringArray(equipment);
    const freqStr =
      (frequency && String(frequency).trim()) ||
      (daysPerWeekNum != null ? String(daysPerWeekNum) : '');

    const doc = {
      programName: programName.trim(),
      primaryGoal: primaryGoalVal,
      locationTag: (locationTag != null ? String(locationTag) : '').trim(),
      workoutSkillLevel,
      workoutPreference: (workoutPreference != null ? String(workoutPreference) : '').trim(),
      frequency: freqStr,
      durationWeeks: durationWeeksNum,
      daysPerWeek: daysPerWeekNum,
      avgSessionMinutes: avgSessionNum,
      equipment: equipmentArr,
      subHeader: String(subHeader).trim(),
      overview: String(overview).trim(),
      whatsInside: parseStringArray(whatsInside),
      isThisForYou: parseStringArray(isThisForYou),
      goalText: goalTrim,
      weekGrid: weekGridParsed,
      exerciseLibrary: exerciseLibraryParsed,
      recoveryProtocol: recoveryProtocolParsed,
      status: statusVal,
    };
    syncQuickStatsFromProgramFields(doc);
    if (quickStats != null) {
      const qsExtra = parseJsonIfString(quickStats, {});
      if (Object.keys(qsExtra).length) {
        doc.quickStats = { ...doc.quickStats, ...qsExtra };
        if (
          qsExtra.necessaryEquipment &&
          (!equipmentArr || !equipmentArr.length)
        ) {
          doc.equipment = Array.isArray(qsExtra.necessaryEquipment)
            ? qsExtra.necessaryEquipment.map((x) => String(x).trim()).filter(Boolean)
            : parseStringArray(qsExtra.necessaryEquipment);
        }
      }
    }

    const program = await Program.create(doc);

    return res.json({
      success: true,
      message: 'Program added successfully',
      result: program,
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

// 2. Get all Programs (search + filters + pagination)
const getAllPrograms = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }
    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const primaryGoal = (req.query.primaryGoal || '').trim();
    const locationTag = (req.query.locationTag || '').trim();
    const workoutSkillLevel = req.query.workoutSkillLevel;
    const workoutPreference = (req.query.workoutPreference || '').trim();
    const statusFilter = (req.query.status || 'all').toLowerCase();

    const query = {};
    if (search) {
      const regex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      query.$or = [
        { programName: regex },
        { primaryGoal: regex },
        { subHeader: regex },
      ];
    }
    if (primaryGoal) {
      query.primaryGoal = new RegExp(
        primaryGoal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
    }
    if (locationTag) {
      query.locationTag = new RegExp(
        locationTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
    }
    if (workoutSkillLevel) query.workoutSkillLevel = workoutSkillLevel;
    if (workoutPreference) {
      query.workoutPreference = new RegExp(
        workoutPreference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
    }
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'inactive') query.status = 'Inactive';
    else if (statusFilter === 'draft') query.status = 'Draft';
    else if (statusFilter === 'deleted') query.status = 'Deleted';

    const [programs, total] = await Promise.all([
      Program.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Program.countDocuments(query),
    ]);

    return res.json({
      success: true,
      message: 'Programs fetched successfully',
      result: {
        programs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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

// 3. Get Program by ID
const getProgramById = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }
    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const { id } = req.params;
    const program = await Program.findById(id).lean();
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    return res.json({
      success: true,
      message: 'Program fetched successfully',
      result: program,
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

// 4. Update Program
const updateProgram = async (req, res) => {
  try {
    const token = req.token;
    const admin_id = token._id;

    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(400).json({
        success: false,
        message: 'Admin not found',
      });
    }
    if (admin.status === 'Deleted') {
      return res.status(400).json({
        success: false,
        message: 'Admin account has been deleted',
      });
    }

    const { id } = req.params;
    const {
      programName,
      primaryGoal,
      locationTag,
      workoutSkillLevel,
      workoutPreference,
      frequency,
      status,
      subHeader,
      overview,
      whatsInside,
      isThisForYou,
      goalText,
      durationWeeks,
      daysPerWeek,
      avgSessionMinutes,
      equipment,
      quickStats,
    } = req.body;
    const { weekGrid, exerciseLibrary, recoveryProtocol } = pickProgramStepPayload(req.body);

    const program = await Program.findById(id);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    if (programName != null && programName !== '')
      program.programName = programName.trim();
    if (primaryGoal != null) program.primaryGoal = String(primaryGoal || '').trim();
    if (locationTag != null) program.locationTag = String(locationTag || '').trim();
    if (
      workoutSkillLevel &&
      ['Beginner', 'Intermediate', 'Advanced', 'Any', 'Beg / Int'].includes(workoutSkillLevel)
    ) {
      program.workoutSkillLevel = workoutSkillLevel;
    }
    if (workoutPreference != null) program.workoutPreference = String(workoutPreference || '').trim();
    if (frequency != null) program.frequency = String(frequency || '').trim();
    if (subHeader != null) program.subHeader = String(subHeader || '').trim();
    if (overview != null) program.overview = String(overview || '').trim();
    if (whatsInside != null) program.whatsInside = parseStringArray(whatsInside);
    if (isThisForYou != null) program.isThisForYou = parseStringArray(isThisForYou);
    if (goalText != null) program.goalText = String(goalText || '').trim();
    if (durationWeeks !== undefined)
      program.durationWeeks = parseOptionalNumber(durationWeeks);
    if (daysPerWeek !== undefined)
      program.daysPerWeek = parseOptionalNumber(daysPerWeek);
    if (avgSessionMinutes !== undefined)
      program.avgSessionMinutes = parseOptionalNumber(avgSessionMinutes);
    if (equipment != null)
      program.equipment = parseStringArray(equipment);

    // If any step-payload is provided, enforce that ALL 3 step-payloads are provided together.
    const anyStepProvided = weekGrid != null || exerciseLibrary != null || recoveryProtocol != null;
    if (anyStepProvided) {
      const weekGridParsed = parseJsonIfString(weekGrid, null);
      const exerciseLibraryParsed = parseJsonIfString(exerciseLibrary, null);
      const recoveryProtocolParsed = parseJsonIfString(recoveryProtocol, null);

      if (
        !isNonEmptyObject(weekGridParsed) ||
        !isNonEmptyObject(exerciseLibraryParsed) ||
        !isNonEmptyObject(recoveryProtocolParsed)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Please submit all program pages (weekGrid/exerciseLibrary/recoveryProtocol) together when updating steps.',
        });
      }

      program.weekGrid = weekGridParsed;
      program.exerciseLibrary = exerciseLibraryParsed;
      program.recoveryProtocol = recoveryProtocolParsed;
    }
    if (status && ['Active', 'Inactive', 'Draft', 'Deleted'].includes(status))
      program.status = status;

    syncQuickStatsFromProgramFields(program);
    if (quickStats != null) {
      const qsExtra = parseJsonIfString(quickStats, {});
      program.quickStats = { ...program.quickStats, ...qsExtra };
      if (
        qsExtra.necessaryEquipment &&
        (!program.equipment || !program.equipment.length)
      ) {
        program.equipment = Array.isArray(qsExtra.necessaryEquipment)
          ? qsExtra.necessaryEquipment.map((x) => String(x).trim()).filter(Boolean)
          : parseStringArray(qsExtra.necessaryEquipment);
      }
    }
    program.markModified('quickStats');

    await program.save();

    return res.json({
      success: true,
      message: 'Program updated successfully',
      result: program,
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

// 5. Delete Program (soft delete)
const deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const program = await Program.findByIdAndUpdate(
      id,
      { status: 'Deleted' },
      { new: true }
    ).lean();

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    return res.json({
      success: true,
      message: 'Program deleted successfully',
      result: program,
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

// 6. Get all programs for user (published only)
const getAllProgramsByUser = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const programs = await Program.find({ status: 'Active' })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Programs fetched successfully',
      result: programs,
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

// 7. Get single program for user by id (published only)
const getProgramByUserAndId = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { id } = req.params;
    const program = await Program.findOne({
      _id: id,
      status: 'Active',
    }).lean();

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    return res.json({
      success: true,
      message: 'Program fetched successfully',
      result: program,
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

// 8. Recommend best program for user by profile + tie-breaker rules
const getRecommendedProgramByUserProfile = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    if (!user_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const user = await User.findById(user_id).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const location = (user.trainingLocation || '').toLowerCase(); // home_workouts | gym_training
    const userSkill = (user.workoutSkillLevel || '').toUpperCase(); // BEGINNER | INTERMEDIATE | ADVANCED
    const preference = (user.workoutPreferences || '').toLowerCase();
    const target = (user.fitnessTarget || '').toUpperCase();
    const frequency = Number(user.workoutFrequency || 0);

    const activePrograms = await Program.find({ status: 'Active' }).lean();
    if (!activePrograms.length) {
      return res.status(404).json({
        success: false,
        message: 'No active programs available',
      });
    }

    // Rule 1: Safety flag (Prenatal/Postpartum highest priority)
    if (preference.includes('prenatal') || preference.includes('postpartum')) {
      const prenatal = activePrograms.find((p) => /prenatal|postpartum/i.test(p.programName));
      if (prenatal) {
        return res.json({
          success: true,
          message: 'Recommended program fetched successfully',
          result: prenatal,
          meta: { ruleApplied: 'SafetyFlagPrenatalPostpartum' },
        });
      }
    }

    // Rule 2: Quickie priority
    if (
      preference.includes('quick') ||
      preference.includes('limited time') ||
      preference.includes('quickies')
    ) {
      const quickie = activePrograms.find((p) => /15-minute quick hits|quick hits/i.test(p.programName));
      if (quickie) {
        return res.json({
          success: true,
          message: 'Recommended program fetched successfully',
          result: quickie,
          meta: { ruleApplied: 'QuickiePriority' },
        });
      }
    }

    // Base filters by location + skill + goal/preference
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

    if (preference) {
      goalTerms.push(preference);
    }

    let candidates = activePrograms.filter((p) => {
      const loc = (p.locationTag || '').toLowerCase();
      const pSkill = p.workoutSkillLevel;
      const pGoal = `${p.primaryGoal || ''} ${p.workoutPreference || ''}`.toLowerCase();

      const locationOk =
        location === 'home_workouts'
          ? loc.includes('home') || loc.includes('any')
          : location === 'gym_training'
          ? loc.includes('gym') || loc.includes('any')
          : true;

      const skillOk = allowedSkills.includes(pSkill);
      const goalOk = goalTerms.some((term) => pGoal.includes(term.toLowerCase()));

      return locationOk && skillOk && goalOk;
    });

    // Rule 3: Location overrule (home users should not get gym-heavy programs)
    if (location === 'home_workouts') {
      candidates = candidates.filter(
        (p) =>
          !/elite strength|functional strength and mastery|crossfit|shred to stage/i.test(
            p.programName
          )
      );
    }

    // Rule 4: Frequency tie-breaker (3 days)
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
      if (prioritized.length) {
        candidates = prioritized;
      }
    }

    if (!candidates.length) {
      // Rule 5: No-match backup
      const fallback = activePrograms.find((p) => /28-day full body foundations/i.test(p.programName));
      if (fallback) {
        return res.json({
          success: true,
          message: 'Recommended program fetched successfully',
          result: fallback,
          meta: { ruleApplied: 'NoMatchFallback' },
        });
      }

      // final fallback: newest active
      const latest = activePrograms.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      return res.json({
        success: true,
        message: 'Recommended program fetched successfully',
        result: latest,
        meta: { ruleApplied: 'LatestActiveFallback' },
      });
    }

    const recommended = candidates.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    return res.json({
      success: true,
      message: 'Recommended program fetched successfully',
      result: recommended,
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
  addProgram,
  getAllPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
  getAllProgramsByUser,
  getProgramByUserAndId,
  getRecommendedProgramByUserProfile,
};


