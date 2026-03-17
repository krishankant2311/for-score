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

// Exercise media: video (mp4, mov), image, gif – max 50 MB
const exerciseFileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|mp4|mov/i;
  const ext = path.extname(file.originalname).slice(1);
  if (allowed.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Allowed: images (jpeg, png, gif, webp), video (mp4, mov)'), false);
  }
};

const uploadExerciseMedia = multer({
  storage,
  fileFilter: exerciseFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

module.exports = upload;
module.exports.uploadExerciseMedia = uploadExerciseMedia;
