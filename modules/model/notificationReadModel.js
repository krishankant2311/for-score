const mongoose = require('mongoose');

const notificationReadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
    },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

notificationReadSchema.index({ userId: 1, notificationId: 1 }, { unique: true });

const NotificationRead = mongoose.model('NotificationRead', notificationReadSchema);

module.exports = NotificationRead;

