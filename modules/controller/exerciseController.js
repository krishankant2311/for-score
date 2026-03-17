const { Admin } = require('../model/adminModel');
const Exercise = require('../model/exerciseModel');

// 1. Add Exercise
const addExercise = async (req, res) => {
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

    const { title, category, difficultyLevel, mediaType, instructions, alternateExercise } = req.body;

    if (!title || !category || !difficultyLevel || !mediaType || !instructions) {
      return res.status(400).json({
        success: false,
        message: 'title, category, difficultyLevel, mediaType and instructions are required',
      });
    }

    const difficultyAllowed = ['Beginner', 'Intermediate', 'Advanced'];
    const mediaAllowed = ['Video', 'Image', 'GIF'];
    if (!difficultyAllowed.includes(difficultyLevel)) {
      return res.status(400).json({
        success: false,
        message: 'difficultyLevel must be Beginner, Intermediate or Advanced',
      });
    }
    if (!mediaAllowed.includes(mediaType)) {
      return res.status(400).json({
        success: false,
        message: 'mediaType must be Video, Image or GIF',
      });
    }

    let mediaUrl = '';
    if (req.file && req.file.filename) {
      mediaUrl = req.file.filename;
    }

    const exercise = await Exercise.create({
      title: title.trim(),
      category: category.trim(),
      difficultyLevel,
      mediaType,
      mediaUrl,
      instructions: instructions.trim(),
      alternateExercise: (alternateExercise || '').trim(),
    });

    return res.json({
      success: true,
      message: 'Exercise added successfully',
      result: exercise,
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

// 2. Get All Exercises (search, pagination, filter)
const getAllExercises = async (req, res) => {
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
    const category = (req.query.category || '').trim();
    const difficultyLevel = req.query.difficultyLevel;
    const mediaType = req.query.mediaType;
    const statusFilter = (req.query.status || 'all').toLowerCase();

    const query = {};
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.title = regex;
    }
    if (category) query.category = new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (difficultyLevel) query.difficultyLevel = difficultyLevel;
    if (mediaType) query.mediaType = mediaType;
    if (statusFilter === 'active') query.status = 'Active';
    else if (statusFilter === 'deleted') query.status = 'Deleted';

    const [exercises, total] = await Promise.all([
      Exercise.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Exercise.countDocuments(query),
    ]);

    return res.json({
      success: true,
      message: 'Exercises fetched successfully',
      result: {
        exercises,
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

// 3. Get Exercise by ID
const getExerciseById = async (req, res) => {
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
    const exercise = await Exercise.findById(id).lean();
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found',
      });
    }

    return res.json({
      success: true,
      message: 'Exercise fetched successfully',
      result: exercise,
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

// 4. Update Exercise
const updateExercise = async (req, res) => {
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
    const { title, category, difficultyLevel, mediaType, instructions, alternateExercise } = req.body;

    const exercise = await Exercise.findById(id);
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found',
      });
    }

    if (title != null && title !== '') exercise.title = title.trim();
    if (category != null && category !== '') exercise.category = category.trim();
    if (difficultyLevel && ['Beginner', 'Intermediate', 'Advanced'].includes(difficultyLevel)) {
      exercise.difficultyLevel = difficultyLevel;
    }
    if (mediaType && ['Video', 'Image', 'GIF'].includes(mediaType)) exercise.mediaType = mediaType;
    if (instructions != null && instructions !== '') exercise.instructions = instructions.trim();
    if (alternateExercise != null) exercise.alternateExercise = alternateExercise.trim();

    if (req.file && req.file.filename) {
      exercise.mediaUrl = req.file.filename;
    }

    await exercise.save();

    return res.json({
      success: true,
      message: 'Exercise updated successfully',
      result: exercise,
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

// 5. Delete Exercise (soft delete)
const deleteExercise = async (req, res) => {
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
    const exercise = await Exercise.findByIdAndUpdate(id, { status: 'Deleted' }, { new: true }).lean();
    if (!exercise) {
      return res.status(404).json({
        success: false,
        message: 'Exercise not found',
      });
    }

    return res.json({
      success: true,
      message: 'Exercise deleted successfully',
      result: exercise,
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
  addExercise,
  getAllExercises,
  getExerciseById,
  updateExercise,
  deleteExercise,
};
