const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    target: {
      type: String,
      enum: ['All', 'Users'],
      default: 'All',
    },
    userIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    onesignal: {
      notificationId: { type: String, default: '' },
      raw: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    status: {
      type: String,
      enum: ['Sent', 'Failed'],
      default: 'Sent',
    },
    error: { type: String, default: '' },
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ target: 1, createdAt: -1 });
notificationSchema.index({ userIds: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;

