// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const customerController = require('../controllers/CustomerController');
const authMiddleware = require('../middlewares/authMiddleware');

// Define the signup and login routes
router.post('/signup', authController.signupUser);
router.post('/login', authController.loginUser);
router.post('/change-password', authMiddleware, authController.changePassword);

// Define the submit KYC route with middleware
router.post('/submit-kyc', authMiddleware, customerController.saveKycData);
router.patch('/edit-kyc', authMiddleware, customerController.editKycData);


// Export the router
module.exports = router;
