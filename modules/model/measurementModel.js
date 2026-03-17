const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    weight: {
      type: Number,
      default: null,
      // lbs
    },
    waist: {
      type: Number,
      default: null,
      // inches
    },
    chest: {
      type: Number,
      default: null,
      // inches
    },
    biceps: {
      type: Number,
      default: null,
      // inches
    },
    thighs: {
      type: Number,
      default: null,
      // inches
    },
    glutes: {
      type: Number,
      default: null,
      // inches
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const Measurement = mongoose.model('Measurement', measurementSchema);

module.exports = Measurement;
