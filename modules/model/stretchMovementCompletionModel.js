const mongoose = require('mongoose');

const stretchMovementCompletionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    sequenceOrder: {
      type: Number,
      required: true,
      min: 1,
    },
    movementName: {
      type: String,
      default: '',
      trim: true,
    },
    sessionDate: {
      type: Date,
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['Active', 'Deleted'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

stretchMovementCompletionSchema.index({ userId: 1, sessionDate: -1 });
stretchMovementCompletionSchema.index(
  { userId: 1, programId: 1, sequenceOrder: 1, sessionDate: 1 },
  { unique: true, partialFilterExpression: { status: 'Active' } }
);

const StretchMovementCompletion = mongoose.model(
  'StretchMovementCompletion',
  stretchMovementCompletionSchema
);

module.exports = StretchMovementCompletion;
