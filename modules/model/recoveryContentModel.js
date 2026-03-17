const mongoose = require('mongoose');

const recoveryContentSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: [
        'Breathing',
        'Stretching',
        'Sleep',
        'Meditation',
        'Self-Massage',
        'Nutrition',
        'Yoga',
        'Therapy',
        'Relaxation',
      ],
    },
    contentType: {
      type: String,
      required: true,
      enum: ['Video', 'Article', 'Audio', 'Image'],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    mediaPath: {
      type: String,
      default: '',
    },
    durationOrTarget: {
      type: String,
      default: '',
      trim: true,
      // e.g. "7-9 hours", "8-10 glasses", "10 mins"
    },
    status: {
      type: String,
      enum: ['Active', 'Draft', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

const RecoveryContent = mongoose.model('RecoveryContent', recoveryContentSchema);

module.exports = RecoveryContent;
