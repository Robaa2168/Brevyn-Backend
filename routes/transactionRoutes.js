const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const authMiddleware = require('../middlewares/authMiddleware');

// Route to handle bank withdrawal requests
router.post('/withdraw/bank', authMiddleware, transactionController.handleWithdraw);

// Route to handle PayPal withdrawal requests
router.post('/withdraw/paypal', authMiddleware, transactionController.handlePaypalWithdraw);

// Route to handle Mobile Money withdrawal requests
router.post('/withdraw/mobile', authMiddleware, transactionController.handleMobileMoneyWithdraw);

router.get('/withdraw/user-withdrawals', authMiddleware, transactionController.getUserWithdrawals);

router.get('/withdrawals/:withdrawalId', authMiddleware, transactionController.getWithdrawalDetails);


module.exports = router;
