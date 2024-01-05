// controllers/ImpactController.js
const mongoose = require('mongoose');
const Impact = require('../models/Impact');
const CharityUser = require('../models/CharityUser');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Kyc = require('../models/Kyc');
const CommentLike = require('../models/CommentLike');
const fs = require('fs');
const path = require('path');

exports.createImpact = async (req, res) => {
    const { impactTitle, description, image, likes, views, shares } = req.body; // Ensure names match
    const userId = req.user;

    try {
        // Check if title or description is undefined, null, or just empty strings after trimming
        if (!impactTitle?.trim() || !description?.trim() || !image) {
            return res.status(400).json({ message: "Please ensure all fields are filled." });
        }

        const user = await CharityUser.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const newImpact = new Impact({
            title: impactTitle,
            description,
            imageUrl: image,
            likes,
            views,
            shares,
        });

        const savedImpact = await newImpact.save();
        res.status(201).json(savedImpact);
    } catch (error) {
        console.error("Error creating impact: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


exports.getImpacts = async (req, res) => {
    const currentUserId = req.user ? req.user : null;

    try {
        const impacts = await Impact.find({});

        // Fetch comment count for each impact
        const commentCounts = await Promise.all(impacts.map(async (impact) => {
            const count = await Comment.countDocuments({ impact: impact._id });
            return { impactId: impact._id.toString(), count };
        }));

        // Fetch likes for the current user related to the impacts, if logged in
        let likedImpactIds = new Set();
        if (currentUserId) {
            const userLikes = await Like.find({
                user: currentUserId,
                impact: { $in: impacts.map(impact => impact._id) }
            });
            likedImpactIds = new Set(userLikes.map(like => like.impact.toString()));
        }

        // Combine impacts with their comment counts and liked status
        const impactsWithCommentCountsAndLikes = impacts.map(impact => {
            const commentCount = commentCounts.find(c => c.impactId === impact._id.toString())?.count || 0;
            return {
                ...impact.toObject(),
                commentCount,
                userHasLiked: likedImpactIds.has(impact._id.toString())
            };
        });

        res.status(200).json(impactsWithCommentCountsAndLikes);
    } catch (error) {
        console.error("Error fetching impacts: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};





exports.toggleLike = async (req, res) => {
    const { impactId } = req.params;
    const userId = req.user;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        let updatedImpact;
        let newLikeStatus;

        const existingLike = await Like.findOne({ impact: impactId, user: userId }).session(session);

        if (existingLike) {
            await Like.deleteOne({ _id: existingLike._id }).session(session);
            updatedImpact = await Impact.findByIdAndUpdate(impactId, { $inc: { likes: -1 } }, { new: true, session });
            newLikeStatus = false;
        } else {
            const newLike = new Like({ impact: impactId, user: userId });
            await newLike.save({ session });
            updatedImpact = await Impact.findByIdAndUpdate(impactId, { $inc: { likes: 1 } }, { new: true, session });
            newLikeStatus = true;
        }

        await session.commitTransaction();

        if (updatedImpact) {
            res.status(200).json({
                likes: updatedImpact.likes,
                userHasLiked: newLikeStatus
            });
        } else {
            res.status(200).json({
                message: "Failed to update likes, returning last known state.",
                likes: (existingLike) ? existingLike.likes : 0,
                userHasLiked: existingLike ? !newLikeStatus : newLikeStatus
            });
        }

    } catch (error) {
        await session.abortTransaction();
        console.error("Error toggling like: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};



exports.getCommentsForImpact = async (req, res) => {
    const { impactId } = req.params;
    const currentUserId = req.user ? req.user : null;


    try {
        console.log(currentUserId)
        let comments = await Comment.find({ impact: impactId })
            .populate({
                path: 'user',
                select: 'profileImage username' // Customize as necessary
            })
            .sort({ date: -1 });

        comments = comments.map(comment => comment.toObject());

        // Fetch additional user details if necessary, e.g., KYC information
        const userIds = comments.map(comment => comment.user._id);
        const kycDataList = await Kyc.find({ user: { $in: userIds } });
        const kycDataMap = kycDataList.reduce((acc, kycData) => {
            acc[kycData.user.toString()] = kycData;
            return acc;
        }, {});

        comments.forEach(comment => {
            const kycData = kycDataMap[comment.user._id.toString()];
            comment.user.displayName = kycData && kycData.firstName && kycData.lastName
                ? `${kycData.firstName} ${kycData.lastName}`
                : comment.user.username;
        });

        // Fetch likes for the current user in relation to the comments
        // If user is logged in, fetch likes
        if (currentUserId) {
            const userLikes = await CommentLike.find({
                user: currentUserId,
                comment: { $in: comments.map(comment => comment._id) }
            });
            const likedCommentIds = new Set(userLikes.map(like => like.comment.toString()));
            comments.forEach(comment => {
                comment.likedByCurrentUser = likedCommentIds.has(comment._id.toString());
            });
        } else {
            comments.forEach(comment => {
                comment.likedByCurrentUser = false;
            });
        }


        res.status(200).json(comments);
    } catch (error) {
        console.error("Error fetching comments: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



exports.createCommentForImpact = async (req, res) => {
    const { impactId } = req.params;
    const { text } = req.body;
    const userId = req.user;

    if (!text.trim()) return res.status(400).json({ message: "Comment text cannot be empty" });

    // Read the list of filter words
    const filterWords = fs.readFileSync(path.join(__dirname, 'filter_words.txt'), 'utf-8')
    .split('\n')
    .map(word => word.trim().toLowerCase());

// Prepare a regular expression for word boundary detection and case insensitivity
// Using \\b for word boundaries, but also considering punctuation and other boundary characters
const regex = new RegExp('(?:\\s|^)(' + filterWords.join('|') + ')(?:\\s|$|[.,!?])', 'i');

// Check if comment contains any filter words
const containsFilteredWord = regex.test(text.trim());

if (containsFilteredWord) {
    return res.status(400).json({ message: "Comment contains inappropriate content" });
}

    try {
        const impact = await Impact.findById(impactId);
        if (!impact) return res.status(404).json({ message: "Impact not found" });

        // Create and save the new comment
        const newComment = new Comment({
            impact: impactId,
            user: userId,
            text: text.trim(),
        });

        const savedComment = await newComment.save();

        // Respond with the newly created comment
        res.status(201).json(savedComment);
    } catch (error) {
        console.error("Error creating comment: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};