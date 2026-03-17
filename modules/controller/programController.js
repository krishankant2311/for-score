const { Admin } = require('../model/adminModel');
const Program = require('../model/programModel');

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

    const skillAllowed = ['Beginner', 'Intermediate', 'Advanced'];
    if (!skillAllowed.includes(workoutSkillLevel)) {
      return res.status(400).json({
        success: false,
        message: 'workoutSkillLevel must be Beginner, Intermediate or Advanced',
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
      ['Beginner', 'Intermediate', 'Advanced'].includes(workoutSkillLevel)
    ) {
      program.workoutSkillLevel = workoutSkillLevel;
    }
    if (workoutPreference != null && workoutPreference !== '')
      program.workoutPreference = workoutPreference.trim();
    if (frequency != null && frequency !== '')
      program.frequency = frequency.trim();
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

module.exports = {
  addProgram,
  getAllPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
  getAllProgramsByUser,
  getProgramByUserAndId,
};


