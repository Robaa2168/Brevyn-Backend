// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const customerController = require('../controllers/CustomerController');
const authMiddleware = require('../middlewares/authMiddleware');

// Define the signup and login routes
router.post('/signup', authController.signupUser);
router.post('/login', authController.loginUser);
router.patch('/upgrade-membership', authMiddleware, customerController.upgradeMembership);
router.post('/change-password', authMiddleware, authController.changePassword);
router.post('/verify-first-time-user', authController.verifyFirstTimeUser);
router.post('/verify-phone', authController.verifyPhoneNumber);
router.get('/info', authMiddleware, authController.getUserInfo);


// Define the submit KYC route with middleware
router.post('/submit-kyc', authMiddleware, customerController.saveKycData);
router.patch('/edit-kyc', authMiddleware, customerController.editKycData);
router.get('/check-phone', customerController.checkPhoneInUse);
router.get('/check-email', customerController.checkEmailInUse);



router.post('/forgot-password', authController.forgotPassword);

// Define the route for verifying reset password code
router.post('/verify-code', authController.verifyResetCode);
router.post('/change-phone', authController.changePhoneNumber);

// Define the reset password route
router.post('/reset-password', authController.resetPassword);

// Define the route for resending verification code
router.post('/resend-verification-code', authController.resendVerificationCode);



// Export the router
module.exports = router;
