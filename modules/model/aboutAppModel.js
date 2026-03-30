const mongoose = require('mongoose');

const aboutAppSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: '',
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    lastUpdated: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const AboutApp = mongoose.model('AboutApp', aboutAppSchema);

module.exports = AboutApp;

