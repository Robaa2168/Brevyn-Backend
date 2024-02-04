// routes/conversionRoutes.js

const express = require('express');
const router = express.Router();
const ConversionController = require('../controllers/ConversionController');
const authMiddleware = require('../middlewares/authMiddleware');

// Route to fetch all conversions for the logged-in user
router.get('/', authMiddleware, ConversionController.fetchUserConversions);

// Route to fetch details about a specific conversion
router.get('/:transactionId', authMiddleware, ConversionController.fetchConversionDetails);

// Assuming you have a performCurrencyConversion method in ConversionController
router.post('/convert', authMiddleware, ConversionController.performCurrencyConversion);

module.exports = router;
