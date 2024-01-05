// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware'); // Assuming you have an authentication middleware

// Route to handle report abuse
router.post('/report-abuse', authMiddleware, reportController.reportAbuse);

module.exports = router;
