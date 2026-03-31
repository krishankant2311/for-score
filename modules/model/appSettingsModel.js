const mongoose = require('mongoose');

const appSettingsSchema = new mongoose.Schema(
  {
    appName: {
      type: String,
      default: 'FOUR Score',
      trim: true,
    },
    appDescription: {
      type: String,
      default: '',
      trim: true,
    },
    supportEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      default: '',
      trim: true,
    },
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      sessionTimeoutMinutes: { type: Number, default: 60 },
      enforceStrongPasswords: { type: Boolean, default: true },
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const AppSettings = mongoose.model('AppSettings', appSettingsSchema);

module.exports = AppSettings;

