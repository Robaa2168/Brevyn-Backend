// routes/commentRoutes.js


const express = require('express');
const router = express.Router();
const CommentController = require('../controllers/CommentController');
const authMiddleware = require('../middlewares/authMiddleware');


router.patch('/:commentId/likes', authMiddleware, CommentController.toggleLikeOnComment);

module.exports = router;