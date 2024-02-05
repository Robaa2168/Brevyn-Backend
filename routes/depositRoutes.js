const express = require('express');
const router = express.Router();
const depositController = require('../controllers/DepositController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post("/deposit", authMiddleware,  depositController.initiateDeposit);
router.get("/deposit/:checkoutRequestId", authMiddleware,  depositController.getDepositStatus);
router.post("/confirm_esrftj", depositController.confirmTransaction);


module.exports = router;
