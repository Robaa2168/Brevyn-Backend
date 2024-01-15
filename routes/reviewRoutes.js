const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// Route to get a specific review by ID
router.get('/:id', reviewController.getReviewById);

// Route to update a specific review by ID
router.patch('/:id', reviewController.editReview);

// Route to get all reviews
router.get('/', reviewController.getAllReviews);

router.post('/post-review', reviewController.postReview);

module.exports = router;
