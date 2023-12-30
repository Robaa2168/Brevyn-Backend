// controllers/CommentController.js
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const CommentLike = require('../models/CommentLike');

exports.toggleLikeOnComment = async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        let updatedComment;
        let newLikeStatus;

        // Check if the user has already liked the comment
        const existingLike = await CommentLike.findOne({ comment: commentId, user: userId }).session(session);

        if (existingLike) {
            // User has liked this comment, so remove the like
            await CommentLike.deleteOne({ _id: existingLike._id }).session(session);
            updatedComment = await Comment.findByIdAndUpdate(commentId, { $inc: { likes: -1 } }, { new: true }).session(session);
            newLikeStatus = false;
        } else {
            // User hasn't liked this comment, so add a new like
            const newLike = new CommentLike({ comment: commentId, user: userId });
            await newLike.save({ session });
            updatedComment = await Comment.findByIdAndUpdate(commentId, { $inc: { likes: 1 } }, { new: true }).session(session);
            newLikeStatus = true;
        }

        await session.commitTransaction();

        res.status(200).json({
            likes: updatedComment.likes, // updated likes count
            userHasLiked: newLikeStatus // whether the user has liked the comment after toggling
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error toggling like on comment: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};
