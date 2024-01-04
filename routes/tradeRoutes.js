// routes/tradeRoutes.js

const express = require('express');
const router = express.Router();
const TradeController = require('../controllers/TradeController');
const authMiddleware = require('../middlewares/authMiddleware');

// Route to handle starting a new trade
router.post('/start', authMiddleware, TradeController.startTrade);

// New route to handle fetching trade details
router.get('/:tradeId', authMiddleware, TradeController.getTradeDetails);

router.patch('/:tradeId/confirm-payment', authMiddleware, TradeController.confirmPayment);

// Route to handle cancellation of trade
router.patch('/:tradeId/cancel', authMiddleware, TradeController.cancelTrade);

router.patch('/:tradeId/restart', authMiddleware, TradeController.restartTrade);



module.exports = router;
