//models/comments.js

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    impact: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Impact',
        required: true,
    },
    text: {
        type: String,
        required: true,
        trim: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CharityUser',
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    likes: {
        type: Number,
        default: 0,
    },
    dislikes: {
        type: Number,
        default: 0,
    },
});

const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
module.exports = Comment;
