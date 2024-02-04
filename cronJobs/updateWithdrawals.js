// cronJobs/updateWithdrawals.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Account = require("../models/Account");
const Withdrawal = require('../models/Withdrawal');
const PaypalWithdrawal = require('../models/PaypalWithdrawal');
const MobileMoneyWithdrawal = require('../models/MobileMoneyWithdrawal');
const CharityUser = require('../models/CharityUser');
const Kyc = require('../models/Kyc');
const fs = require('fs');
const path = require('path');

// MongoDB connection (similar to your existing setup)
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected for Withdrawal Update Cron Job'))
    .catch(err => console.error('MongoDB connection error:', err));

// Email sending function
async function sendEmail({ toEmail, subject, textContent, htmlContent }) {
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

// Function to update withdrawal status to 'processing'
async function updateToProcessing(withdrawal) {
    try {
        withdrawal.status = 'processing';
        await withdrawal.save();
    } catch (error) {
        console.error("Error updating withdrawal to processing:", error);
    }
}


async function processFailedWithdrawal(withdrawal, model, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Mark the withdrawal as failed
        withdrawal.status = 'failed';
        await withdrawal.save({ session });

        // Find the specific account for the currency and refund the amount
        const currencyAccount = await Account.findOne({ user: userId, currency: withdrawal.currency }).session(session);
        if (!currencyAccount) {
            console.error(`Account not found for user: ${userId} and currency: ${withdrawal.currency}`);
            await session.abortTransaction();
            session.endSession();
            return; // Exit the function if the account is not found
        }

        // Refund the amount to the specific currency account and mark it as held
        await Account.findByIdAndUpdate(currencyAccount._id, {
            $inc: { balance: withdrawal.amount },
            $set: { isHeld: true, heldAt: new Date() } // Mark as held and set the held date
        }, { session });

        // Ban the charity user
        await CharityUser.findByIdAndUpdate(userId, {
            $set: { isBanned: true }
        }, { session });

        await session.commitTransaction();
        console.log(`Processed failed withdrawal for user: ${userId}, refunded to ${withdrawal.currency} account.`);
    } catch (transactionError) {
        await session.abortTransaction();
        console.error("Error processing failed withdrawal:", transactionError);
    } finally {
        session.endSession();
    }

    // Prepare and send email outside the transaction
    try {
        const user = await CharityUser.findOne({ _id: userId });
        const kycDetails = await Kyc.findOne({ user: userId });
        if (user && kycDetails) {
            // Read HTML template and replace placeholders
            let htmlContent = fs.readFileSync(path.join(__dirname, '..', 'templates', 'failedWithdrawalTemplate.html'), 'utf8')
                .replace(/{{beneficiaryName}}/g, kycDetails.firstName)
                .replace(/{{withdrawalId}}/g, withdrawal.withdrawalId)
                .replace(/{{amount}}/g, withdrawal.amount);

            await sendEmail({
                toEmail: user.email,
                subject: "Withdrawal Failed - Action Required",
                textContent: `Dear ${kycDetails.firstName}, your withdrawal with ID ${withdrawal.withdrawalId} for ${withdrawal.amount} has failed. We have refunded the amount to your account.`,
                htmlContent: htmlContent
            });
        }
    } catch (emailError) {
        console.error("Error sending email:", emailError);
    }
}



// Scheduled task
function initializeWithdrawalUpdateJob() {
    cron.schedule('*/15 * * * *', async () => {
        console.log("Running withdrawal update task at:", new Date().toISOString());

        const processingTime = new Date(new Date().getTime() - 15 * 60 * 1000); // 15 minutes ago
        const failureTime = new Date(new Date().getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

        const processWithdrawals = async (model, modelName) => {
            console.log(`Processing ${modelName} withdrawals...`);

            // Update 'pending' withdrawals to 'processing' after 15 minutes
            const pendingWithdrawals = await model.find({ status: 'pending', createdAt: { $lt: processingTime } });
            console.log(`Found ${pendingWithdrawals.length} pending ${modelName} withdrawals to update to processing.`);
            for (const withdrawal of pendingWithdrawals) {
                console.log(`Updating ${modelName} withdrawal ID ${withdrawal._id} to processing.`);
                await updateToProcessing(withdrawal);
            }

            // Process 'processing' withdrawals to 'failed' after 2 hours
            const processingWithdrawals = await model.find({ status: 'processing', createdAt: { $lt: failureTime } });
            console.log(`Found ${processingWithdrawals.length} processing ${modelName} withdrawals to update to failed.`);
            for (const withdrawal of processingWithdrawals) {
                console.log(`Processing failed for ${modelName} withdrawal ID ${withdrawal._id}.`);
                await processFailedWithdrawal(withdrawal, model, withdrawal.userId);
            }
        };

        try {
            await processWithdrawals(Withdrawal, 'Bank');
            await processWithdrawals(PaypalWithdrawal, 'PayPal');
            await processWithdrawals(MobileMoneyWithdrawal, 'Mobile Money');
        } catch (error) {
            console.error("Error in withdrawal update cron job:", error);
        }
    });
}

module.exports = {
    initializeWithdrawalUpdateJob
};