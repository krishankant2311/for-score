const multer = require('multer');
const path = require('path');

// Upload folder - yahan files save hongi
const uploadDir = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname) || '.jpg');
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/i;
  const ext = path.extname(file.originalname).slice(1);
  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('only images are allowed (jpeg, jpg, png, gif, webp)'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

const PROGRESS_PHOTO_MAX_COUNT = 12;
const PROGRESS_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const uploadProgressPhotos = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: PROGRESS_PHOTO_MAX_BYTES,
    files: PROGRESS_PHOTO_MAX_COUNT,
  },
}).fields([
  { name: 'photo', maxCount: PROGRESS_PHOTO_MAX_COUNT },
  { name: 'photos', maxCount: PROGRESS_PHOTO_MAX_COUNT },
]);

const handleMulterProgressPhotoUpload = (req, res, next) => {
  uploadProgressPhotos(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Each photo must be 5 MB or smaller. Please choose smaller images and try again.',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: `You can upload up to ${PROGRESS_PHOTO_MAX_COUNT} photos at a time.`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Invalid photo upload (${err.code}). Please try again with up to ${PROGRESS_PHOTO_MAX_COUNT} images.`,
      });
    }

    const msg = String(err.message || '');
    if (/only images are allowed/i.test(msg)) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed (JPEG, PNG, GIF, WEBP).',
      });
    }

    return res.status(400).json({
      success: false,
      message: msg || 'Invalid photo upload. Please try again.',
    });
  });
};

// Exercise media: video (mp4, mov), image, gif – max 50 MB
const exerciseFileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|webm|m4v|mkv|avi/i;
  const ext = path.extname(file.originalname).slice(1);
  const mime = String(file.mimetype || '').toLowerCase();
  if (
    allowed.test(ext) ||
    mime.startsWith('image/') ||
    mime.startsWith('video/')
  ) {
    cb(null, true);
  } else {
    cb(new Error('Allowed: images (jpeg, png, gif, webp), video (mp4, mov, webm)'), false);
  }
};

const uploadExerciseMedia = multer({
  storage,
  fileFilter: exerciseFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

module.exports = upload;
module.exports.uploadExerciseMedia = uploadExerciseMedia;
module.exports.handleMulterProgressPhotoUpload = handleMulterProgressPhotoUpload;
module.exports.PROGRESS_PHOTO_MAX_COUNT = PROGRESS_PHOTO_MAX_COUNT;
