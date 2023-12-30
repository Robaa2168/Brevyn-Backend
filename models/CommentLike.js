// models/CommentLike.js
const mongoose = require('mongoose');

const CommentLikeSchema = new mongoose.Schema({
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
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

// Ensure that the combination of user and comment is unique
CommentLikeSchema.index({ comment: 1, user: 1 }, { unique: true });

const CommentLike = mongoose.models.CommentLike || mongoose.model('CommentLike', CommentLikeSchema);

module.exports = CommentLike;
