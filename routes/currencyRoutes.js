const express = require('express');
const router = express.Router();
const CurrencyController = require('../controllers/CurrencyController');
const authMiddleware = require('../middlewares/authMiddleware');

// Route to activate a currency
router.patch('/activate/:currencyId', authMiddleware, CurrencyController.activateCurrency);

// Route to fetch all currencies for the logged-in user
router.get('/', authMiddleware, CurrencyController.fetchCurrencies);
// Add this route to your existing currency routes
router.get('/:currencyId', authMiddleware, CurrencyController.fetchCurrencyDetails);


module.exports = router;
