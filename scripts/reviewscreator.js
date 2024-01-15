//scripts/reviewscreator.js

require('dotenv').config({ path: __dirname + '/../.env' });
console.log(process.env.MONGODB_URI); // Check if the URI is loaded
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const fs = require('fs');
const Review = require('../models/reviews');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Read review contents from the file
const reviewContents = JSON.parse(fs.readFileSync('charity_reviews.json', 'utf8'));

// Function to create a review with random name, date, and rating
const createReview = (reviewContent) => {
  // Generate dates in the desired range manually if faker.date.between is deprecated
  const startDate = new Date('2017-01-01').getTime();
  const endDate = new Date().getTime();
  const randomDate = new Date(startDate + Math.random() * (endDate - startDate));

  return new Review({
    firstName: faker.person.firstName(), // Update according to new API
    lastName: faker.person.lastName(), // Update according to new API
    reviewContent,
    rating: Math.floor(Math.random() * 5) + 1,
    createdAt: randomDate 
  });
};


// Function to save reviews to the database
const saveReviews = async () => {
  let count = 0; // Initialize a counter

  for (const content of reviewContents) {
    const review = createReview(content);
    await review.save();
    count++; // Increment the counter after each save
  }

  // Log the number of reviews saved
  console.log(`${count} reviews have been saved.`);
};

saveReviews().then(() => {
  console.log('Finished saving reviews.');
  mongoose.disconnect();
});

