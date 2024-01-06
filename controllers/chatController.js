const Chat = require('../models/Chat');
const { v4: uuidv4 } = require('uuid');

exports.sendMessage = async (req, res) => {
    const { tradeId, message } = req.body;
    const senderId = req.user;
    const receiverId = req.body.receiver;

    try {
        // Generate a unique chat ID
        const chatId = `CHT${uuidv4().substring(0, 8).toUpperCase()}`;

        const newMessage = new Chat({
            chatId, // Use the generated chatId
            tradeId,
            sender: senderId,
            receiver: receiverId,
            message,
        });

        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

exports.getMessages = async (req, res) => {
    const { tradeId } = req.query; // Assuming tradeId is sent as a query param

    try {
        const messages = await Chat.find({ tradeId }).sort({ createdAt: 1 }); // Sorting oldest to newest
        res.status(200).json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};