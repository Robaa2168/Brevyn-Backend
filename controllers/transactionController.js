const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Withdrawal = require('../models/Withdrawal');
const PaypalWithdrawal = require('../models/PaypalWithdrawal');
const MobileMoneyWithdrawal = require('../models/MobileMoneyWithdrawal');
const CharityUser = require('../models/CharityUser');
const Notification = require('../models/Notification');
const Kyc = require('../models/Kyc');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

async function sendEmail({ toEmail, subject, textContent, htmlVariables }) {
    const templatePath = path.join(__dirname, '..', 'templates', 'withdrawalTemplate.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Replace variables in HTML content
    Object.keys(htmlVariables).forEach((key) => {
        htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), htmlVariables[key]);
    });

    // Handling conditional blocks
    htmlContent = htmlContent.replace(/{{#if bank}}(.*?){{\/if}}/gs, htmlVariables['bank'] ? '$1' : '');
    htmlContent = htmlContent.replace(/{{#if paypal}}(.*?){{\/if}}/gs, htmlVariables['paypal'] ? '$1' : '');
    htmlContent = htmlContent.replace(/{{#if mobile}}(.*?){{\/if}}/gs, htmlVariables['mobile'] ? '$1' : '');

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
        to: toEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
    });

    console.log("Message sent: %s", info.messageId);
    return info;
}

exports.handleWithdraw = async (req, res) => {
    const { amount, bank, accountNo, beneficiaryName, routingNumber } = req.body;

    // Check if all required fields are provided
    if (!amount || !bank || !accountNo || !beneficiaryName) {
        return res.status(400).json({ message: "All fields are required: amount, bank, accountNo, beneficiaryName." });
    }

    // Ensure amount is a number and round it down
    const withdrawalAmount = Math.floor(Number(amount));
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount provided." });
    }

    const userId = req.user;
    const withdrawalId = `WDW${uuidv4().substring(0, 8).toUpperCase()}`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await CharityUser.findById(userId).session(session);
        const userKyc = await Kyc.findOne({ user: userId }).session(session);

        if (!user || !userKyc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "User not found or KYC not filled." });
        }

        if (user.isBanned) {
            await session.abortTransaction();
            return res.status(403).json({ message: "User is banned and cannot make a withdrawal." });
        }

        if (user.balance < withdrawalAmount || withdrawalAmount < 100) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Invalid withdrawal amount." });
        }

        // Check if the user already has a pending withdrawal
        const existingBankWithdrawal = await Withdrawal.findOne({ userId, status: 'pending' }).session(session);
        const existingPaypalWithdrawal = await PaypalWithdrawal.findOne({ userId, status: 'pending' }).session(session);
        const existingMobileMoneyWithdrawal = await MobileMoneyWithdrawal.findOne({ userId, status: 'pending' }).session(session);

        if (existingBankWithdrawal || existingPaypalWithdrawal || existingMobileMoneyWithdrawal) {
            await session.abortTransaction();
            return res.status(400).json({ message: "User already has a pending withdrawal request in one of the methods." });
        }


        // Access the firstName from the userKyc document
        const firstName = userKyc.firstName;

        // Deduct amount from user's balance
        await CharityUser.findByIdAndUpdate(userId, { $inc: { balance: -withdrawalAmount } }, { session });

        // Record the withdrawal with the firstName
        const newWithdrawal = new Withdrawal({
            withdrawalId,
            userId,
            amount:withdrawalAmount,
            bank,
            accountNo,
            beneficiaryName,
            routingNumber,
            status: 'pending',
            firstName: firstName,
        });

        await newWithdrawal.save({ session });

        // Create a notification for the user about the withdrawal request
        const notification = new Notification({
            user: userId,
            text: `Your withdrawal request of $ ${withdrawalAmount} is being processed.`,
            type: 'Alert'
        });

        await notification.save({ session });

        await session.commitTransaction();

        // Prepare and send an email
        const emailVars = {
            amount: withdrawalAmount.toString(),
            bank: bank,
            accountNo: accountNo,
            beneficiaryName: beneficiaryName,
            withdrawalId: withdrawalId,
            firstName: firstName,
            paypal: false,
            mobile: false
        };

        const emailTextContent = `Hello ${beneficiaryName},

        Your request to withdraw ${withdrawalAmount} to the bank account ending in ${accountNo} at ${bank} has been received and is being processed.
        
        Withdrawal ID: ${withdrawalId}
        
        First Name: ${firstName}
        
        Please allow 1-3 days for the funds to reflect in your account.
        
        If you have any questions or need further assistance, please contact our support team.
        
        Best Regards,
        Verdant Charity.
        `;

        // Prepare and send an email
        await sendEmail({
            toEmail: userKyc.email,
            subject: `Withdrawal Request Received - ${withdrawalId}`,
            textContent: emailTextContent,
            htmlVariables: emailVars,

        });

        res.status(201).json({ message: "Withdrawal request created successfully!", withdrawal: newWithdrawal });
    } catch (error) {
        console.error('Error handling withdrawal:', error);
        await session.abortTransaction();
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};



exports.handlePaypalWithdraw = async (req, res) => {
    const { amount, email } = req.body;

    // Check if amount and email are provided
    if (!amount || !email) {
        return res.status(400).json({ message: "Amount and email are required." });
    }

    // Ensure amount is a number and round it down
    const withdrawalAmount = Math.floor(Number(amount));
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount provided." });
    }
    const userId = req.user;
    const withdrawalId = `WDW-PAYPAL-${uuidv4().substring(0, 8).toUpperCase()}`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await CharityUser.findById(userId).session(session);
        const userKyc = await Kyc.findOne({ user: userId }).session(session);

        if (!user || !userKyc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "User not found or KYC not filled." });
        }

        if (user.isBanned) {
            await session.abortTransaction();
            return res.status(403).json({ message: "User is banned and cannot make a withdrawal." });
        }

        if (user.balance < withdrawalAmount || withdrawalAmount < 100) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Invalid withdrawal amount." });
        }


        // Check if the user already has a pending withdrawal
        const existingBankWithdrawal = await Withdrawal.findOne({ userId, status: 'pending' }).session(session);
        const existingPaypalWithdrawal = await PaypalWithdrawal.findOne({ userId, status: 'pending' }).session(session);
        const existingMobileMoneyWithdrawal = await MobileMoneyWithdrawal.findOne({ userId, status: 'pending' }).session(session);

        if (existingBankWithdrawal || existingPaypalWithdrawal || existingMobileMoneyWithdrawal) {
            await session.abortTransaction();
            return res.status(400).json({ message: "User already has a pending withdrawal request in one of the methods." });
        }
        // Access the firstName from the userKyc document
        const firstName = userKyc.firstName;

        // Deduct amount from user's balance
        await CharityUser.findByIdAndUpdate(userId, { $inc: { balance: -withdrawalAmount } }, { session });

        // Record the PayPal withdrawal
        const newPaypalWithdrawal = new PaypalWithdrawal({
            withdrawalId,
            userId,
            firstName: firstName,
            amount:withdrawalAmount,
            email,
            status: 'pending'
        });
        await newPaypalWithdrawal.save({ session });

        // Create a notification for the user about the withdrawal request
        const notification = new Notification({
            user: userId,
            text: `Your PayPal withdrawal request of $${withdrawalAmount} is being processed.`,
            type: 'Alert'
        });
        await notification.save({ session });

        await session.commitTransaction();

        // Prepare and send an email
        const emailVars = {
            amount: withdrawalAmount.toString(),
            email: email,
            beneficiaryName: firstName,
            withdrawalId: withdrawalId,
            bank: false,
            paypal: true,
            mobile: false
        };

        const emailTextContent = `Hello,

        Your request to withdraw $${withdrawalAmount} to your PayPal account (${email}) has been received and is being processed.
        
        Withdrawal ID: ${withdrawalId}
        
        Please allow 1-3 days for the funds to reflect in your account.
        
        If you have any questions or need further assistance, please contact our support team.
        
        Best Regards,
        Verdant Charity.`;

        await sendEmail({
            toEmail: userKyc.email,
            subject: `PayPal Withdrawal Request - ${withdrawalId}`,
            textContent: emailTextContent,
            htmlVariables: emailVars,
        });

        res.status(201).json({ message: "PayPal withdrawal request created successfully!", withdrawal: newPaypalWithdrawal });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};



exports.handleMobileMoneyWithdraw = async (req, res) => {
    const { amount, phoneNumber, provider } = req.body;

    // Check if amount and email are provided
    if (!amount || !phoneNumber || !provider) {
        return res.status(400).json({ message: "All the fields are required." });
    }

    // Ensure amount is a number and round it down
    const withdrawalAmount = Math.floor(Number(amount));
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount provided." });
    }
    const userId = req.user;
    const withdrawalId = `WDW-MOBILE-${uuidv4().substring(0, 8).toUpperCase()}`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await CharityUser.findById(userId).session(session);
        const userKyc = await Kyc.findOne({ user: userId }).session(session);

        if (!user || !userKyc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "User not found or KYC not filled." });
        }

        if (user.isBanned) {
            await session.abortTransaction();
            return res.status(403).json({ message: "User is banned and cannot make a withdrawal." });
        }

        if (user.balance < withdrawalAmount || withdrawalAmount < 100) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Invalid withdrawal amount." });
        }

        // Check if the user already has a pending withdrawal
        const existingBankWithdrawal = await Withdrawal.findOne({ userId, status: 'pending' }).session(session);
        const existingPaypalWithdrawal = await PaypalWithdrawal.findOne({ userId, status: 'pending' }).session(session);
        const existingMobileMoneyWithdrawal = await MobileMoneyWithdrawal.findOne({ userId, status: 'pending' }).session(session);

        if (existingBankWithdrawal || existingPaypalWithdrawal || existingMobileMoneyWithdrawal) {
            await session.abortTransaction();
            return res.status(400).json({ message: "User already has a pending withdrawal request in one of the methods." });
        }

        // Access the firstName from the userKyc document
        const firstName = userKyc.firstName;


        // Deduct amount from user's balance
        await CharityUser.findByIdAndUpdate(userId, { $inc: { balance: -withdrawalAmount } }, { session });

        // Record the Mobile Money withdrawal
        const newMobileMoneyWithdrawal = new MobileMoneyWithdrawal({
            withdrawalId,
            userId,
            firstName: firstName,
            amount:withdrawalAmount,
            phoneNumber,
            provider,
            status: 'pending'
        });
        await newMobileMoneyWithdrawal.save({ session });

        // Create a notification for the user about the withdrawal request
        const notification = new Notification({
            user: userId,
            text: `Your Mobile Money withdrawal request of $${withdrawalAmount} is being processed.`,
            type: 'Alert'
        });
        await notification.save({ session });

        await session.commitTransaction();

        // Prepare and send an email
        const emailVars = {
            amount: withdrawalAmount.toString(),
            beneficiaryName: firstName,
            phoneNumber: phoneNumber,
            provider: provider,
            withdrawalId: withdrawalId,
            bank: false,
            paypal: false,
            mobile: true
        };

        const emailTextContent = `Hello,

        Your request to withdraw $${withdrawalAmount} to your Mobile Money account (${provider}, Phone: ${phoneNumber}) has been received and is being processed.
        
        Withdrawal ID: ${withdrawalId}
        
        Please allow 1-3 days for the funds to reflect in your account.
        
        If you have any questions or need further assistance, please contact our support team.
        
        Best Regards,
        Verdant Charity.`;

        await sendEmail({
            toEmail: userKyc.email,
            subject: `Mobile Money Withdrawal Request - ${withdrawalId}`,
            textContent: emailTextContent,
            htmlVariables: emailVars,
        });

        res.status(201).json({ message: "Mobile Money withdrawal request created successfully!", withdrawal: newMobileMoneyWithdrawal });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};