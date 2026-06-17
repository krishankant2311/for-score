const User = require('../model/userModel');
const ProgressPhoto = require('../model/progressPhotoModel');
const { PROGRESS_PHOTO_MAX_COUNT } = require('../../middleware/multer');

const normalizeDate = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const collectUploadedPhotoFiles = (req) => {
  const bucket = req.files && typeof req.files === 'object' ? req.files : {};
  const fromPhoto = Array.isArray(bucket.photo) ? bucket.photo : req.file ? [req.file] : [];
  const fromPhotos = Array.isArray(bucket.photos) ? bucket.photos : [];
  return [...fromPhoto, ...fromPhotos];
};

// 1. Upload one or more progress photos (max 12 per request)
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

    const files = collectUploadedPhotoFiles(req);
    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one photo file is required.',
      });
    }

    if (files.length > PROGRESS_PHOTO_MAX_COUNT) {
      return res.status(400).json({
        success: false,
        message: `You can upload up to ${PROGRESS_PHOTO_MAX_COUNT} photos at a time.`,
      });
    }

    const { pose, takenDate, caption } = req.body || {};
    const allowedPoses = ['Front', 'Side', 'Back', 'Other'];
    const poseVal = pose && allowedPoses.includes(pose) ? pose : 'Other';
    const dateVal = normalizeDate(takenDate);
    if (!dateVal) {
      return res.status(400).json({
        success: false,
        message: 'Invalid takenDate. Use a valid date (YYYY-MM-DD).',
      });
    }

    const captionVal = (caption || '').trim();
    const created = [];

    for (const file of files) {
      const photo = await ProgressPhoto.create({
        userId: user_id,
        filePath: file.path,
        pose: poseVal,
        takenDate: dateVal,
        caption: captionVal,
      });
      created.push(photo);
    }

    const message =
      created.length === 1
        ? 'Progress photo uploaded successfully'
        : `${created.length} progress photos uploaded successfully`;

    return res.json({
      success: true,
      message,
      result:
        created.length === 1
          ? created[0]
          : {
              uploaded_count: created.length,
              photos: created,
            },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Could not upload progress photos. Please try again.',
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

    const limit = Math.min(PROGRESS_PHOTO_MAX_COUNT, Math.max(1, parseInt(req.query.limit, 10) || 6));

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
