// controllers/NotificationController.js
const Notification = require('../models/Notification');
const CharityUser = require('../models/CharityUser');

// Fetch unread notifications for a specific user
exports.getUnreadNotifications = async (req, res) => {
    try {
        const userId = req.user;  // Extract user ID from request, set by authMiddleware
        // Validate that the user exists
        const user = await CharityUser.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const notifications = await Notification.find({ user: userId, isRead: false });
        return res.status(200).json(notifications);
    } catch (error) {
        console.error("Error fetching notifications: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



exports.getUnreadNotificationCount = async (req, res) => {
    try {
        const userId = req.user; // Extract user ID from request, set by authMiddleware

        // Validate that the user exists
        const user = await CharityUser.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const count = await Notification.countDocuments({ user: userId, isRead: false });
        res.status(200).json({ count });
    } catch (error) {
        console.error("Error getting notification count: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


exports.markNotificationAsRead = async (req, res) => {
    try {
        const notificationId = req.params.notificationId;
        const userId = req.user.id; 

        // Validate that the user exists
        const user = await CharityUser.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const updatedNotification = await Notification.findOneAndUpdate(
            { _id: notificationId, user: userId }, 
            { isRead: true },
            { new: true }
        );

        if (!updatedNotification) {
            return res.status(404).json({ message: "Notification not found or already read" });
        }

        res.status(200).json({ message: "Notification marked as read" });
    } catch (error) {
        console.error("Error marking notification as read: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
