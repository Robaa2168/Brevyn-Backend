// Import necessary modules
const express = require('express');
const router = express.Router();
const depositController = require('../controllers/DepositController');
const authMiddleware = require('../middlewares/authMiddleware');

// Existing routes
router.post("/deposit", authMiddleware,  depositController.initiateDeposit);
router.get("/deposit/:checkoutRequestId", authMiddleware,  depositController.getDepositStatus);
router.post("/confirm_esrftj", depositController.confirmTransaction);

// Route to fetch all deposits for the logged-in user
router.get("/deposits", authMiddleware, depositController.fetchAllDeposits);

// Route to fetch details of a specific deposit
router.get("/deposits/:depositId", authMiddleware, depositController.fetchDepositDetails);

module.exports = router;
