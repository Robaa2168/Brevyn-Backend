const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Withdrawal = require('../models/Withdrawal');
const CharityUser = require('../models/CharityUser');
const Notification = require('../models/Notification');
const Kyc = require('../models/Kyc');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Email sending function
async function sendEmail({ toEmail, subject,textContent, htmlVariables }) {
    const templatePath = path.join(__dirname, '..', 'templates', 'withdrawalTemplate.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Replace variables in HTML content
    Object.keys(htmlVariables).forEach((key) => {
        htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), htmlVariables[key]);
    });

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

        if (!user.isPremium) {
            await session.abortTransaction();
            return res.status(403).json({ message: "Only premium users can withdraw." });
        }

        if (user.balance < amount || amount < 100) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Invalid withdrawal amount." });
        }

        // Check if the user already has a pending withdrawal
        const existingPendingWithdrawal = await Withdrawal.findOne({ userId, status: 'pending' }).session(session);
        if (existingPendingWithdrawal) {
            await session.abortTransaction();
            return res.status(400).json({ message: "User already has a pending withdrawal request." });
        }

        // Access the firstName from the userKyc document
        const firstName = userKyc.firstName;

        // Deduct amount from user's balance
        await CharityUser.findByIdAndUpdate(userId, { $inc: { balance: -amount } }, { session });

        // Record the withdrawal with the firstName
        const newWithdrawal = new Withdrawal({
            withdrawalId,
            userId,
            amount,
            bank,
            accountNo,
            beneficiaryName,
            routingNumber,
            status: 'pending',
            firstName: firstName, // Save the firstName here
        });

        await newWithdrawal.save({ session });

        // Create a notification for the user about the withdrawal request
        const notification = new Notification({
            user: userId,
            text: `Your withdrawal request of $ ${amount} is being processed.`,
            type: 'Alert'
        });

        await notification.save({ session });

        await session.commitTransaction();

        // Prepare and send an email
        const emailVars = {
            amount: amount.toString(),
            bank: bank,
            accountNo: accountNo,
            beneficiaryName: beneficiaryName,
            withdrawalId: withdrawalId,
            firstName: firstName, // Include firstName in emailVars
        };

        const emailTextContent = `Hello ${beneficiaryName},

        Your request to withdraw ${amount} to the bank account ending in ${accountNo} at ${bank} has been received and is being processed.
        
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
