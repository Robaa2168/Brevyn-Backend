// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const customerController = require('../controllers/CustomerController');
const authMiddleware = require('../middlewares/authMiddleware');

// Define the signup and login routes
router.post('/signup', authController.signupUser);
router.post('/login', authController.loginUser);

// Define the submit KYC route with middleware
router.post('/submit-kyc', authMiddleware, customerController.saveKycData);
router.post('/create-link', authMiddleware, customerController.createDonationLink);


// Export the router
module.exports = router;
