const mongoose = require('mongoose');

const projectWallActivitySchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    title: { type: String, default: '', trim: true },
    message: { type: String, required: true, trim: true },
    activityType: {
      type: String,
      enum: ['Update', 'Task', 'Note', 'Milestone', 'Other'],
      default: 'Update',
    },
    authorName: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

projectWallActivitySchema.index({ projectId: 1, createdAt: -1 });

const ProjectWallActivity = mongoose.model('ProjectWallActivity', projectWallActivitySchema);

module.exports = ProjectWallActivity;
