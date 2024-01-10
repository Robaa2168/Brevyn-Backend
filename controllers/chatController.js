//controllers/chatController.js
const Pusher = require('pusher');
const Chat = require('../models/Chat');
const { v4: uuidv4 } = require('uuid');

// Initialize Pusher
const pusher = new Pusher({
  appId: "1735796",
  key: "8230d8927179fce2bde6",
  secret: "1c0dd061dd835336fddb",
  cluster: "ap2",
  useTLS: true
});



exports.sendMessage = async (req, res) => {
    const { tradeId, message } = req.body;
    const senderId = req.user;
    const receiverId = req.body.receiver;

    try {
        const chatId = `CHT${uuidv4().substring(0, 8).toUpperCase()}`;

        const newMessage = new Chat({
            chatId,
            tradeId,
            sender: senderId,
            receiver: receiverId,
            message,
        });

        await newMessage.save();

        // Emit the new message to all clients (or you could target specific ones)
        global.io.emit('newMessage', newMessage);

        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



exports.getMessages = async (req, res) => {
    const { tradeId } = req.query;

    try {
        const messages = await Chat.find({ tradeId }).sort({ createdAt: 1 });

        // Optionally, you might emit this too, depending on your needs
        global.io.emit('fetchedMessages', messages);

        res.status(200).json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
