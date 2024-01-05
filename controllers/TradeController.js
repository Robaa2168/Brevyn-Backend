//controllers/TradeController.js

const mongoose = require('mongoose');
const Trade = require('../models/trade');
const Kyc = require('../models/Kyc');
const { v4: uuidv4 } = require('uuid');
const CharityUser = require('../models/CharityUser');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

async function sendEmail({ toEmail, subject, textContent, htmlContent }) {

    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: 'flortieno@gmail.com',
            pass: 'jxcsapcnfcshtfmy',
        },
    });

    let info = await transporter.sendMail({
        from: '"Verdant Charity" <flortieno@gmail.com>',
        to: toEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
    });

    console.log("Message sent: %s", info.messageId);
    return info;
}


exports.startTrade = async (req, res) => {
    const { amount, points } = req.body;
    const userId = req.user; 

    if (!amount || !points || !userId) {
        return res.status(400).json({ message: "All fields are required and must be valid." });
    }

    try {
        const user = await CharityUser.findById(userId);
        if (user.isBanned) {
            return res.status(403).json({ message: "User is banned and cannot start a trade." });
        }

        // Check if user has completed KYC
        const userKyc = await Kyc.findOne({ user: userId });
        if (!userKyc || !userKyc.firstName || !userKyc.lastName) {
            return res.status(403).json({ message: "Please complete filling your information before starting a trade." });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const tradeId = `TRF${uuidv4().substring(0, 8).toUpperCase()}`;

            // Calculate expiresAt to be 30 minutes from now
            const expiresAt = new Date(new Date().getTime() + 30*60000);

            // Create a new trade instance with expiresAt set
            const newTrade = new Trade({
                tradeId,
                amount,
                points,
                userId,
                expiresAt // Set expiresAt directly here
            });

            const savedTrade = await newTrade.save({ session: session });

            // Commit the transaction
            await session.commitTransaction();

            // Respond with the created trade
            res.status(201).json(savedTrade);
        } catch (error) {
            // If anything goes wrong, abort the transaction
            await session.abortTransaction();
            console.error("Error during trade creation: ", error);
            res.status(500).json({ message: "Failed to start trade", error: error.message });
        } finally {
            // End the session
            session.endSession();
        }
    } catch (error) {
        // Catch any other errors
        console.error("Error starting trade: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};









exports.getTradeDetails = async (req, res) => {
    const { tradeId } = req.params;

    try {
        // Find the trade by tradeId
        const trade = await Trade.findOne({ tradeId });

        // If trade doesn't exist, return a 404 Not Found response
        if (!trade) {
            return res.status(404).json({ message: "Trade not found." });
        }

        // Respond with the trade details
        res.status(200).json(trade);
    } catch (error) {
        console.error("Error fetching trade details: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

exports.getUserTrades = async (req, res) => {
    try {
        const userId = req.user; // Assuming req.user is set by your auth middleware

        // Fetch the 10 most recent trades for the user
        const trades = await Trade.find({ userId: userId })
                                  .sort({ createdAt: -1 })
                                  .limit(10); // Limit to 10 documents

        res.status(200).json(trades);
    } catch (error) {
        console.error("Error fetching user trades: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


exports.confirmPayment = async (req, res) => {
    const { tradeId } = req.body;

    try {
        // Find the trade without updating it first
        const trade = await Trade.findOne({ tradeId });

        // Check if trade exists
        if (!trade) {
            return res.status(404).json({ message: "Trade not found." });
        }

        // Check if trade is active and not expired
        const currentTime = new Date();
        if(trade.status !== 'active' || trade.expiresAt < currentTime) {
            return res.status(400).json({ message: "Trade is not active or already expired." });
        }

        // If trade is active and not expired, mark as paid
        const updatedTrade = await Trade.findOneAndUpdate(
            { tradeId, status: 'active', expiresAt: { $gte: currentTime } },
            { status: 'paid' },
            { new: true }
        );

        res.status(200).json(updatedTrade);
    } catch (error) {
        console.error("Error confirming payment: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


exports.cancelTrade = async (req, res) => {
    const { tradeId } = req.body;

    try {
        const trade = await Trade.findOne({ tradeId });

        if (!trade) {
            return res.status(404).json({ message: "Trade not found." });
        }

        const user = await CharityUser.findById(trade.userId);
        const userKyc = await Kyc.findOne({ user: trade.userId });

        if (!user || !userKyc) {
            return res.status(404).json({ message: "User or KYC information not found." });
        }

        // Update the trade's status to 'cancelled'
        trade.status = 'cancelled';
        await trade.save();

        // Count the number of cancelled trades
        const cancelledTradeCount = await Trade.countDocuments({ userId: user._id, status: 'cancelled' });

        let emailSubject;
        let htmlTemplatePath;
        let emailTextContent;

        if (cancelledTradeCount >= 5) {
            // Ban the user if they've cancelled more than 5 trades
            user.isBanned = true;
            await user.save();

            // Prepare ban notification email
            emailSubject = `Account Status Notice`;
            htmlTemplatePath = path.join(__dirname, '..', 'templates', 'banNotification.html');
            emailTextContent = `Your account has been temporarily banned due to excessive trade cancellations.`;
        } else {
            // Prepare cancellation notification email
            emailSubject = `${tradeId}- Trade Cancellation Notice`;
            htmlTemplatePath = path.join(__dirname, '..', 'templates', 'cancellation.html');
             emailTextContent = `Your trade with ID ${tradeId} has been cancelled.`;
        }

        // Load and modify the email HTML template
        let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf8')
            .replace(/{{firstName}}/g, userKyc.firstName)
            .replace(/{{lastName}}/g, userKyc.lastName)
            .replace(/{{tradeId}}/g, tradeId);

        // Send the email
        await sendEmail({
            toEmail: userKyc.email,
            subject: emailSubject,
            textContent: emailTextContent,
            htmlContent: htmlContent
        });

        res.status(200).json(trade);
    } catch (error) {
        console.error("Error cancelling trade: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};




exports.restartTrade = async (req, res) => {
    const { tradeId } = req.body;
    const userId = req.user;

    try {
        // Check if the user is banned
        const user = await CharityUser.findById(userId);
        if (user.isBanned) {
            return res.status(403).json({ message: "User is banned and cannot restart a trade." });
        }

        // Calculate the new expiration date (30 minutes from now)
        const newExpiresAt = new Date(new Date().getTime() + 30*60000);

        const trade = await Trade.findOneAndUpdate(
            { tradeId },
            {
                status: 'active',
                expiresAt: newExpiresAt // Update the expiresAt time
            },
            { new: true }
        );

        if (!trade) {
            return res.status(404).json({ message: "Trade not found." });
        }

        res.status(200).json(trade);
    } catch (error) {
        console.error("Error restarting trade: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


