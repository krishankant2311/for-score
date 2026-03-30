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
    return [parsed.trim()];
  }
  return [];
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
      quickStats,
      weekGrid,
      exerciseLibrary,
      recoveryProtocol,
    } = req.body;

    if (
      !programName ||
      !primaryGoal ||
      !locationTag ||
      !workoutSkillLevel ||
      !workoutPreference ||
      !frequency
    ) {
      return res.status(400).json({
        success: false,
        message:
          'programName, primaryGoal, locationTag, workoutSkillLevel, workoutPreference and frequency are required',
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
      status && ['Active', 'Draft'].includes(status) ? status : 'Active';

    const program = await Program.create({
      programName: programName.trim(),
      primaryGoal: primaryGoal.trim(),
      locationTag: locationTag.trim(),
      workoutSkillLevel,
      workoutPreference: workoutPreference.trim(),
      frequency: frequency.trim(),
      subHeader: (subHeader || '').trim(),
      overview: (overview || '').trim(),
      whatsInside: parseStringArray(whatsInside),
      isThisForYou: parseStringArray(isThisForYou),
      goalText: (goalText || '').trim(),
      quickStats: parseJsonIfString(quickStats, {}),
      weekGrid: parseJsonIfString(weekGrid, {}),
      exerciseLibrary: parseJsonIfString(exerciseLibrary, {}),
      recoveryProtocol: parseJsonIfString(recoveryProtocol, {}),
      status: statusVal,
    });

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
      query.$or = [{ programName: regex }, { primaryGoal: regex }];
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
      quickStats,
      weekGrid,
      exerciseLibrary,
      recoveryProtocol,
    } = req.body;

    const program = await Program.findById(id);
    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found',
      });
    }

    if (programName != null && programName !== '')
      program.programName = programName.trim();
    if (primaryGoal != null && primaryGoal !== '')
      program.primaryGoal = primaryGoal.trim();
    if (locationTag != null && locationTag !== '')
      program.locationTag = locationTag.trim();
    if (
      workoutSkillLevel &&
      ['Beginner', 'Intermediate', 'Advanced', 'Any', 'Beg / Int'].includes(workoutSkillLevel)
    ) {
      program.workoutSkillLevel = workoutSkillLevel;
    }
    if (workoutPreference != null && workoutPreference !== '')
      program.workoutPreference = workoutPreference.trim();
    if (frequency != null && frequency !== '')
      program.frequency = frequency.trim();
    if (subHeader != null) program.subHeader = String(subHeader || '').trim();
    if (overview != null) program.overview = String(overview || '').trim();
    if (whatsInside != null) program.whatsInside = parseStringArray(whatsInside);
    if (isThisForYou != null) program.isThisForYou = parseStringArray(isThisForYou);
    if (goalText != null) program.goalText = String(goalText || '').trim();
    if (quickStats != null) program.quickStats = parseJsonIfString(quickStats, {});
    if (weekGrid != null) program.weekGrid = parseJsonIfString(weekGrid, {});
    if (exerciseLibrary != null)
      program.exerciseLibrary = parseJsonIfString(exerciseLibrary, {});
    if (recoveryProtocol != null)
      program.recoveryProtocol = parseJsonIfString(recoveryProtocol, {});
    if (status && ['Active', 'Draft', 'Deleted'].includes(status))
      program.status = status;

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

// 6. Get all programs for user (only non-deleted)
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

    const programs = await Program.find({ status: { $ne: 'Deleted' } })
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

// 7. Get single program for user by id (only non-deleted)
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
      status: { $ne: 'Deleted' },
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


