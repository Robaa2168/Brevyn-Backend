//controllers/transferController.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Transaction = require("../models/transactionSchema");
const Account = require("../models/Account");
const CharityUser = require('../models/CharityUser');
const Notification = require('../models/Notification');
const Kyc = require('../models/Kyc');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');



async function sendTransferSMS(senderFirstName, receiverPhoneNumber, amount, currency, transactionId, newBalance) {
    const url = "https://sms.textsms.co.ke/api/services/sendsms/";
    const message = `${transactionId} Confirmed. You have received ${currency}${amount} from ${senderFirstName} on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} New balance is ${currency}${newBalance}.`;
    const data = {
        apikey: "a5fb51cb37deb6f3c38c0f45f737cc10",
        partnerID: 5357,
        message: message,
        shortcode: "WINSOFT",
        mobile: receiverPhoneNumber,
    };

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify(data),
    };
    const response = await fetch(url, options);
    const result = await response.json();
    return result;
}


async function sendEmail({ toEmail, subject, textContent, senderName, amount, currency, receiverName }) {
    // Assuming the template is modified for fund transfers and saved as 'fund_transfer.html'
    const templatePath = path.join(__dirname, '..', 'templates', 'fund_transfer.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders in htmlContent with actual values for fund transfer
    htmlContent = htmlContent
        .replace(/{{receiverName}}/g, receiverName)
        .replace(/{{amount}}/g, `${amount}`)
        .replace(/{{currency}}/g, currency)
        .replace(/{{senderName}}/g, senderName);

    // Setup transporter and send the email
    let transporter = nodemailer.createTransport({
        host: "mail.privateemail.com",
        port: 587,
        secure: false,
        auth: {
            user: 'support@verdantcharity.org',
            pass: 'Lahaja2168#',
        },
    });

    let info = await transporter.sendMail({
        from: '"Verdant Charity" <support@verdantcharity.org>',
        to: "robertlagat38@gmail.com",
        subject: subject,
        text: textContent,
        html: htmlContent,
    });

    console.log("Message sent: %s", info.messageId);
    return info;
}


exports.transferFunds = async (req, res) => {
    const { amount, payId, currency } = req.body;
    const senderId = req.user; // Assuming req.user is the sender's user ID

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Validate sender exists and is not banned, also check KYC
        const sender = await CharityUser.findById(senderId).session(session);
        if (!sender) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Sender not found." });
        }

        if (sender.isBanned) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: "Sender is banned from performing transactions." });
        }

        // Validate input fields
        if (!amount || !payId || !currency) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        // Validate amount
        const numericAmount = parseFloat(amount.trim());
        if (isNaN(numericAmount) || numericAmount <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Invalid or insufficient transfer amount" });
        }

        // Retrieve recipient by PayID
        const recipient = await CharityUser.findOne({ payId }).session(session);

        // Validate recipient
        if (!recipient) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "Recipient not found." });
        }

        // Check if recipient is banned
        if (recipient.isBanned) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ message: "Recipient is banned." });
        }

        // Validate sender's account for currency, sufficient balance, and account status
        const senderAccount = await Account.findOne({ user: senderId, currency }).session(session);
        if (!senderAccount || !senderAccount.isActive || senderAccount.isHeld || senderAccount.balance < numericAmount) {
            let message = "Issue with sender's account.";
            if (!senderAccount) message = `Sender's ${currency} account not found.`;
            else if (!senderAccount.isActive) message = `${currency} currency is inactive for sender.`;
            else if (senderAccount.isHeld) message = `${currency} currency account for sender is temporarily banned.`;
            else if (senderAccount.balance < numericAmount) message = "Insufficient balance in the sender's account.";

            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message });
        }

        // Validate recipient's account exists for currency
        const recipientAccount = await Account.findOne({ user: recipient._id, currency }).session(session);
        if (!recipientAccount) {
            return res.status(404).json({ message: "Recipient does not have an account in the specified currency." });
        }

        // After validating sender and recipient, fetch their KYC details
        const senderKyc = await Kyc.findOne({ user: senderId }).session(session);
        if (!senderKyc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Sender KYC information not found. Please complete your KYC." });
        }

        const recipientKyc = await Kyc.findOne({ user: recipient._id }).session(session);
        if (!recipientKyc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Recipient KYC information not found." });
        }

        // Perform the fund transfer
        await Account.findByIdAndUpdate(senderAccount._id, { $inc: { balance: -numericAmount } }, { session });
        await Account.findByIdAndUpdate(recipientAccount._id, { $inc: { balance: numericAmount } }, { session });

        // Generate a transaction ID
        const transactionId = `TRF${uuidv4().substring(0, 8).toUpperCase()}`;

        // Record the transaction with first and last names from KYC
        try {
            const transaction = new Transaction({
                transactionType: "transfer",
                transactionId: transactionId,
                sender: sender._id,
                senderFirstName: senderKyc.firstName, // From sender's KYC
                senderLastName: senderKyc.lastName, // From sender's KYC, if you decide to include it
                receiver: recipient._id,
                receiverFirstName: recipientKyc.firstName, // From recipient's KYC
                receiverLastName: recipientKyc.lastName, // From recipient's KYC, if you decide to include it
                currency,
                amount: numericAmount,
                status: "completed",
            });
            await transaction.save({ session });
        } catch (error) {
            console.error("Error recording transaction: ", error);
            await session.abortTransaction();
            session.endSession();
            return res.status(500).json({ message: "Internal server error during transaction recording", error: error.message });
        }

        // Commit the main transaction before proceeding with notifications
        await session.commitTransaction();

        // Attempt to send notifications, handling errors gracefully since the main transaction has already succeeded
        try {
            const senderNotification = new Notification({
                user: sender._id,
                text: `You have successfully transferred ${amount}${currency} to ${recipientKyc.firstName}.`,
                type: 'Alert',
            });
            await senderNotification.save({ session });
        } catch (error) {
            console.error("Error sending notification to sender: ", error);
            // Consider logging this error, but do not abort the transaction as it has already been committed
        }

        try {
            const recipientNotification = new Notification({
                user: recipient._id,
                text: `${senderKyc.firstName} has successfully transferred ${amount}${currency} to you.`,
                type: 'Alert',
            });
            await recipientNotification.save({ session });
        } catch (error) {
            console.error("Error sending notification to recipient: ", error);
        }

        // Fetch the updated account balance for the recipient to use in SMS
        const updatedRecipientAccount = await Account.findOne({ user: recipient._id, currency }).session(session);
        const newBalance = updatedRecipientAccount.balance;

        // Send SMS to the recipient with updated account balance
        try {
            const receiverPhoneNumber = recipient.phoneNumber; // From CharityUser schema
            await sendTransferSMS(senderKyc.firstName, receiverPhoneNumber, numericAmount, currency, transactionId, newBalance);
        } catch (error) {
            console.error("Error sending SMS: ", error);
        }

        // Attempt to send email to recipient with their first name and email from CharityUser
        try {
            await sendEmail({
                toEmail: recipient.email, // From CharityUser schema
                Subject: `You got some money - ${transactionId}`,
                textContent: `Hello, ${recipientKyc.firstName}, you have received ${numericAmount}${currency} from ${senderKyc.firstName}.`,
                senderName: senderKyc.firstName,
                amount: `${numericAmount}`,
                currency: currency,
                receiverName: recipientKyc.firstName,
            });
        } catch (error) {
            console.error("Error sending email: ", error);
        }

        session.endSession();
        res.status(201).json({
            message: "Transfer completed successfully",
            transaction: {
                senderId: sender._id,
                receiverId: recipient._id,
                amount: numericAmount,
                currency: currency,
                status: "completed",
            }
        });
    } catch (error) {
        console.error("Error during fund transfer: ", error);
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


exports.fetchAllTransfers = async (req, res) => {
    try {
        const userId = req.user;
        const transfers = await Transaction.find({ $or: [{ sender: userId }, { receiver: userId }] })
            .populate('sender', 'profileImage') // Populate sender image
            .populate('receiver', 'profileImage') // Populate receiver image
            .sort({ createdAt: -1 })
            .limit(10); // Assuming you meant to limit to 10, not 2
        res.status(200).json(transfers);
    } catch (error) {
        console.error("Error fetching transfers:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



// Fetch details of a specific transfer
exports.fetchTransferDetails = async (req, res) => {
    try {
        const { transferId } = req.params;
        const transferDetails = await Transaction.findById(transferId);
        if (!transferDetails) {
            return res.status(404).json({ message: "Transfer not found" });
        }
        res.json(transferDetails);
    } catch (error) {
        console.error("Error fetching transfer details:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


exports.fetchUserNameByPayId = async (req, res) => {
    const { payId } = req.params;

    // Check if payId is provided
    if (!payId) {
        return res.status(400).json({ message: "PayID is required" });
    }

    try {
        // Search for user by PayID
        const user = await CharityUser.findOne({ payId: payId });

        // If a user is found, use their ID to fetch their KYC data
        if (user) {
            const kycData = await Kyc.findOne({ user: user._id });

            // If KYC data is found, return the user's name
            if (kycData) {
                const userName = `${kycData.firstName} ${kycData.lastName}`;
                return res.json({ name: userName });
            } else {
                // If no KYC data is found for the user
                return res.status(404).json({ message: "KYC data not found for this user" });
            }
        } else {
            // If no user is found with the given PayID
            return res.status(404).json({ message: "No user found with this PayID" });
        }
    } catch (error) {
        console.error("Error fetching user name by PayID:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};