const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  reviewContent: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  // Include other fields as needed
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create the model or use the existing one
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

module.exports = Review;
