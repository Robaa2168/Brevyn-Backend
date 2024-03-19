// routes/adminCustomerRoutes.js
const express = require('express');
const router = express.Router();
const adminCustomerController = require('../controllers/AdminCustomerController');
const authMiddleware = require('../middlewares/authMiddleware');

// Route to get user statistics for the dashboard
router.get('/user-stats', authMiddleware, adminCustomerController.getUserStats);

// Route to toggle user ban status
router.patch('/:userId/toggleBan', authMiddleware, adminCustomerController.banUser);

// New route to delete a user
router.delete('/delete-user/:userId', authMiddleware, adminCustomerController.deleteUser);


router.get('/users', authMiddleware, adminCustomerController.getUsers);

module.exports = router;
