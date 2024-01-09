// cronJobs/expireTrades.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const Trade = require('../models/trade');
const CharityUser = require('../models/CharityUser');
const Kyc = require('../models/Kyc');  // Ensure KYC model is available

// Configure your MongoDB URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connection established for Cron Job'))
.catch(err => console.error('MongoDB connection failed for Cron Job:', err));

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

// Scheduled task to run every minute (adjust as necessary)
cron.schedule('* * * * *', async () => {
    console.log("Initiating task to search and update expired trades every minute");

    const currentTime = new Date();

    try {
        const expiredTrades = await Trade.find({ status: 'active', expiresAt: { $lt: currentTime } });

        for (let trade of expiredTrades) {
            trade.status = 'cancelled';
            await trade.save();

            const user = await CharityUser.findById(trade.userId);
            const userKyc = await Kyc.findOne({ user: trade.userId });

            if (!user || !userKyc) continue; // Skip if user or KYC not found

            // Prepare and send expiration email
            let htmlContentExpired = fs.readFileSync(path.join(__dirname, '..', 'templates', 'expiredTrades.html'), 'utf8')
                .replace(/{{firstName}}/g, userKyc.firstName)
                .replace(/{{tradeId}}/g, trade.tradeId);

            await sendEmail({
                toEmail: userKyc.email,
                subject: `Trade Expiration Notice - ${trade.tradeId}`,
                textContent: `Your trade with ID ${trade.tradeId} has expired and been automatically cancelled.`,
                htmlContent: htmlContentExpired
            });

            // Check for user ban due to excessive cancellations
            const cancelledTradeCount = await Trade.countDocuments({ userId: user._id, status: 'cancelled' });

            if (cancelledTradeCount >= 35) {
                user.isBanned = true;
                await user.save();

                // Prepare and send ban notification email
                let htmlContentBan = fs.readFileSync(path.join(__dirname, '..', 'templates', 'banNotification.html'), 'utf8')
                    .replace(/{{firstName}}/g, userKyc.firstName)
                    .replace(/{{lastName}}/g, userKyc.lastName);

                await sendEmail({
                    toEmail: userKyc.email,
                    subject: ` Account Status Notice`,
                    textContent: `Your account has been temporarily banned due to excessive trade cancellations.`,
                    htmlContent: htmlContentBan
                });
            }
        }

        console.log(`Expired trades processed: ${expiredTrades.length}`);
    } catch (error) {
        console.error("Error occurred during the scheduled task for expired trades:", error);
    }
});