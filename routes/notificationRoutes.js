// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const customerController = require('../controllers/CustomerController');
const notificationController = require('../controllers/NotificationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Define the route for fetching unread notifications
router.get('/unread', authMiddleware, notificationController.getUnreadNotifications);
// Define the route for getting the count of unread notifications
router.get('/count', authMiddleware, notificationController.getUnreadNotificationCount);
// Define the route for marking a notification as read
router.post('/mark-read/:notificationId', authMiddleware, notificationController.markNotificationAsRead);


// Export the router
module.exports = router;
