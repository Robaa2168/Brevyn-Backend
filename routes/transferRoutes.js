//routes/transferRoutes.js

const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const authMiddleware = require('../middlewares/authMiddleware');

// Existing transfer-related routes
router.post("/transfer", authMiddleware, transferController.transferFunds);
router.get("/transfers", authMiddleware, transferController.fetchAllTransfers);
router.get("/transfer/:transferId", authMiddleware, transferController.fetchTransferDetails);

// New route to fetch user name by PayID
router.get("/:payId", authMiddleware, transferController.fetchUserNameByPayId);

module.exports = router;