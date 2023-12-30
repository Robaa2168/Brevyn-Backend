const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  impact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Impact',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharityUser',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

LikeSchema.index({ impact: 1, user: 1 }, { unique: true });

const Like = mongoose.models.Like || mongoose.model('Like', LikeSchema);

module.exports = Like;
