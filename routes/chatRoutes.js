//routes/chatRoutes.js

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/get-messages', authMiddleware, chatController.getMessages);
router.post('/send-message', authMiddleware, chatController.sendMessage);


module.exports = router;
