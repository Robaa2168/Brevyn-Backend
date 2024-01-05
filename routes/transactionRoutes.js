//routes/transactionRoutes.js

const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middlewares/authMiddleware');

// Route to handle withdrawal requests
router.post('/withdraw', authMiddleware, transactionController.handleWithdraw);

// Add other transaction-related routes as needed

module.exports = router;
