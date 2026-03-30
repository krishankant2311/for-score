const User = require('../model/userModel');
const ProgressPhoto = require('../model/progressPhotoModel');

const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// 1. Upload progress photo
const addProgressPhoto = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Photo file is required',
      });
    }

    const { pose, takenDate, caption } = req.body;
    const allowedPoses = ['Front', 'Side', 'Back', 'Other'];
    const poseVal = pose && allowedPoses.includes(pose) ? pose : 'Other';
    const dateVal = normalizeDate(takenDate);

    const photo = await ProgressPhoto.create({
      userId: user_id,
      filePath: req.file.path,
      pose: poseVal,
      takenDate: dateVal,
      caption: (caption || '').trim(),
    });

    return res.json({
      success: true,
      message: 'Progress photo uploaded successfully',
      result: photo,
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

// 2. Get latest photos (for Latest Photos carousel)
const getLatestProgressPhotos = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const limit = Math.min(12, Math.max(1, parseInt(req.query.limit) || 6));

    const photos = await ProgressPhoto.find({
      userId: user_id,
      status: { $ne: 'Deleted' },
    })
      .sort({ takenDate: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      message: 'Latest progress photos fetched successfully',
      result: photos,
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

// 3. Get photo timeline (grouped by date)
const getProgressPhotoTimeline = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const photos = await ProgressPhoto.find({
      userId: user_id,
      status: { $ne: 'Deleted' },
    })
      .sort({ takenDate: -1, createdAt: -1 })
      .lean();

    const grouped = {};
    photos.forEach((p) => {
      const key = new Date(p.takenDate).toDateString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    const timeline = Object.keys(grouped)
      .sort((a, b) => new Date(b) - new Date(a))
      .map((dateKey) => ({
        date: dateKey,
        photos: grouped[dateKey],
      }));

    return res.json({
      success: true,
      message: 'Progress photo timeline fetched successfully',
      result: timeline,
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

// 4. Get single photo by id
const getProgressPhotoById = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const photo = await ProgressPhoto.findOne({
      _id: id,
      userId: user_id,
      status: { $ne: 'Deleted' },
    }).lean();

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Progress photo not found',
      });
    }

    return res.json({
      success: true,
      message: 'Progress photo fetched successfully',
      result: photo,
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

// 5. Soft delete photo
const deleteProgressPhoto = async (req, res) => {
  try {
    const token = req.token;
    const user_id = token?._id;

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
      });
    }

    const { id } = req.params;
    const photo = await ProgressPhoto.findOne({
      _id: id,
      userId: user_id,
    });

    if (!photo || photo.status === 'Deleted') {
      return res.status(404).json({
        success: false,
        message: 'Progress photo not found',
      });
    }

    photo.status = 'Deleted';
    await photo.save();

    return res.json({
      success: true,
      message: 'Progress photo deleted successfully',
      result: photo,
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
  addProgressPhoto,
  getLatestProgressPhotos,
  getProgressPhotoTimeline,
  getProgressPhotoById,
  deleteProgressPhoto,
};

