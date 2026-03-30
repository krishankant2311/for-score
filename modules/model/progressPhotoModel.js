const mongoose = require('mongoose');

const progressPhotoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    pose: {
      type: String,
      enum: ['Front', 'Side', 'Back', 'Other'],
      default: 'Other',
    },
    takenDate: {
      type: Date,
      required: true,
    },
    caption: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

progressPhotoSchema.index({ userId: 1, takenDate: -1 });

const ProgressPhoto = mongoose.model('ProgressPhoto', progressPhotoSchema);

module.exports = ProgressPhoto;

