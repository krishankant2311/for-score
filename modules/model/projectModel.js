const mongoose = require('mongoose');

const OPEN_PROJECT_STATUSES = ['Open', 'InProgress'];

const projectSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    projectCode: { type: String, required: true, trim: true },
    title: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['Open', 'InProgress', 'Closed', 'Deleted'],
      default: 'Open',
    },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

projectSchema.index({ customerId: 1, projectCode: 1 });
projectSchema.index({ status: 1 });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
module.exports.OPEN_PROJECT_STATUSES = OPEN_PROJECT_STATUSES;
