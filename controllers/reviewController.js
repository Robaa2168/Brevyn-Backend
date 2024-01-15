const Review = require('../models/reviews');
const { faker } = require('@faker-js/faker');

// Function to get all reviews
exports.getAllReviews = async (req, res) => {
    try {
      // Sort reviews by a date field in descending order (newest first)
      const reviews = await Review.find().sort({ createdAt: -1 });
      res.status(200).json(reviews);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  


  exports.editReview = async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, reviewContent, rating, createdAt } = req.body;

    try {
        // Validation for createdAt
        if (createdAt && new Date(createdAt) > new Date()) {
            return res.status(400).json({ message: 'Created at date cannot be in the future' });
        }

        // Validation for rating
        if (rating > 5) {
            return res.status(400).json({ message: 'Rating cannot be more than 5' });
        }

        const updateObject = {
            firstName,
            lastName,
            reviewContent,
            rating
        };

        if (createdAt) {
            updateObject.createdAt = createdAt;
        }

        const updatedReview = await Review.findByIdAndUpdate(
            id,
            updateObject,
            { new: true }
        );

        if (!updatedReview) {
            return res.status(404).json({ message: 'Review not found' });
        }

        res.status(200).json(updatedReview);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



exports.getReviewById = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }
        res.status(200).json(review);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



/// Function to create a review with random name, date, and rating
const createReview = (reviewContent) => {
    const randomFirstName = faker.name.firstName();
    const randomLastName = faker.name.lastName();
    const randomRating = Math.floor(Math.random() * 5) + 1;
    const randomDate = faker.date.past(1);

    return new Review({
        firstName: randomFirstName,
        lastName: randomLastName,
        reviewContent,
        rating: randomRating,
        createdAt: randomDate,
    });
};

// Route to post a new review
exports.postReview = async (req, res) => {
    const { reviewContent } = req.body;

    if (!reviewContent) {
        return res.status(400).json({ message: 'Review content is required' });
    }

    try {
        const newReview = createReview(reviewContent);
        await newReview.save();

        res.status(201).json(newReview);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};