const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // required: true,
    },
    title: {
      type: String,
      // required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      // e.g. Chest, Legs, Back, Shoulders, Arms, Core
    },
    difficultyLevel: {
      type: String,
      required: true,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
    },
    mediaType: {
      type: String,
      required: true,
      enum: ['Video', 'Image', 'GIF'],
    },
    mediaUrl: {
      type: String,
      default: '',
      // path/URL of uploaded file (MP4, MOV, image, GIF)
    },
    instructions: {
      type: String,
      required: true,
      trim: true,
    },
    alternateExercise: {
      type: String,
      default: '',
      trim: true,
      // optional – title or reference to another exercise
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const Exercise = mongoose.model('Exercise', exerciseSchema);

module.exports = Exercise;
