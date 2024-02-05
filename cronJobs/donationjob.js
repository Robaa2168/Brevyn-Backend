const mongoose = require('mongoose');
const cron = require('node-cron');
const { faker } = require('@faker-js/faker');
const Account = require("../models/Account");
const Donation = require('../models/donations');
const DonationLink = require('../models/donationLink');
const CharityUser = require('../models/CharityUser');
const Notification = require('../models/Notification');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');


// Configure your MongoDB URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('connection established for fake donation Cron Job'))
    .catch(err => console.error('MongoDB connection failed for Cron Job:', err));


async function sendDonationReceivedSMS(recipientPhoneNumber, donorName, donationAmount, totalDonations) {
    const apiUrl = "https://sms.textsms.co.ke/api/services/sendsms/";
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    const currency = "USD";

    const message = `Congratulations! You have successfully received ${currency}${donationAmount} from ${donorName} on ${currentDate} at ${currentTime}. Total donation balance is ${currency}${totalDonations}. Thank you for making a difference!`;

    const data = {
        apikey: "a5fb51cb37deb6f3c38c0f45f737cc10",
        partnerID: 5357,
        message: message,
        shortcode: "WINSOFT",
        mobile: recipientPhoneNumber,
    };

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    };

    try {
        const response = await fetch(apiUrl, options);
        const result = await response.json();
        console.log("SMS sent successfully:", result);
        return result;
    } catch (error) {
        console.error("Error sending SMS:", error);
    }
}



async function sendEmail({ toEmail, subject, textContent, senderName, amount, message, donationLinkTitle }) {
    // Load the HTML template
    const templatePath = path.join(__dirname, '..', 'templates', 'donation.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Replace placeholders in htmlContent with actual values
    htmlContent = htmlContent
        .replace(/{{senderName}}/g, senderName)
        .replace(/{{amount}}/g, `${amount}`)
        .replace(/{{message}}/g, message)
        .replace(/{{donationLinkTitle}}/g, donationLinkTitle);

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

// Function to calculate the next donation time
function calculateNextDonationTime() {
    const minutesToAdd = faker.number.int({ min: 15, max: 60 });
    return new Date(new Date().getTime() + (1000 * 60 * minutesToAdd));
}


function getCompletionThreshold(targetAmount, existingThreshold) {
    // If an existing threshold is already set, use it
    if (existingThreshold) {
        return existingThreshold;
    }

    let baseThreshold;
    let randomVariance;

    if (targetAmount <= 1000) {
        baseThreshold = 0.73; // Base threshold for targets up to $1,000
        randomVariance = (Math.random() * 0.2) - 0.1;
    } else if (targetAmount <= 10000) {
        baseThreshold = 0.43; // Base threshold for targets up to $10,000
        randomVariance = (Math.random() * 0.3) - 0.15; // Increased variance of ±15%
    } else {
        baseThreshold = 0.37; // Base threshold for targets above $10,000
        randomVariance = (Math.random() * 0.25) - 0.125; // Variance of ±12.5%
    }

    // Calculate final threshold ensuring it's within logical bounds (0 to 1) and rounded to 2 decimal places
    let finalThreshold = Math.min(Math.max(baseThreshold + randomVariance, 0), 1);
    finalThreshold = Math.round(finalThreshold * 100)

    return finalThreshold;
}



// Function to create a donation and update DonationLink and CharityUser
async function createDonation(link) {
    let completionThreshold;
    let updatedLink;

    // Check if the link already has a stored completion threshold
    if (link.completionThreshold) {
        completionThreshold = getCompletionThreshold(link.targetAmount, link.completionThreshold);
    } else {
        completionThreshold = getCompletionThreshold(link.targetAmount, null);
        // Update the link with the newly calculated completion threshold
        await DonationLink.updateOne({ _id: link._id }, { $set: { completionThreshold: completionThreshold } });
    }

    const maxTotalDonationAmount = link.targetAmount * completionThreshold;
    const remainingAmount = maxTotalDonationAmount - link.totalDonations;

    // Calculate max individual donation amount as a fraction of the remaining amount
    const maxIndividualDonation = Math.min(remainingAmount, link.targetAmount * 0.1); // Up to 10% of target per donation
    const divisibleMax = maxIndividualDonation - (maxIndividualDonation % 5); // Adjust to the nearest lower multiple of 5

    // Set minimum amount to 20
    const minAmount = 20;

    // Ensure divisibleMax is at least as large as minAmount
    const adjustedDivisibleMax = Math.max(divisibleMax, minAmount);

    // Generate a random amount between minAmount and adjustedDivisibleMax that is a multiple of 5
    let amountToDonate;
    if (adjustedDivisibleMax === minAmount) {
        amountToDonate = minAmount;
    } else {
        amountToDonate = Math.floor(Math.random() * ((adjustedDivisibleMax - minAmount) / 5 + 1)) * 5 + minAmount;
    }

    const fakeDonation = new Donation({
        donor: '658db0c10bfefbb749a5c308',
        recipient: link.user,
        donationLink: link._id,
        amount: amountToDonate,
        paymentStatus: 'completed',
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        type: 'individual',
    });

    const additionalViews = faker.number.int({ min: 1, max: 50 });
    // Start a transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await fakeDonation.save({ session });

        // Update DonationLink with new total donations and next donation time
        const updateLinkData = {
            $inc: { totalDonations: amountToDonate, views: additionalViews },
            $set: { nextDonationTime: calculateNextDonationTime() },
        };

        await DonationLink.updateOne({ _id: link._id }, updateLinkData, { session });
        updatedLink = await DonationLink.findById(link._id).session(session);

        // Ensure the completionThreshold is used as a percentage
        const requiredDonations = updatedLink.targetAmount * (updatedLink.completionThreshold / 100);

        if (updatedLink.totalDonations >= requiredDonations) {
            await DonationLink.updateOne({ _id: link._id }, { $set: { status: 'completed' } }, { session });
        }

        // Find the USD account for the CharityUser and update the balance
        const usdAccount = await Account.findOne({ user: link.user, currency: 'USD' }).session(session);
        if (!usdAccount) {
            console.error(`USD account not found for the user with ID ${link.user}. Donation ID: ${fakeDonation._id}`);
            // Optionally, you might decide to abort this specific transaction
            // but not the entire cron job
            await session.abortTransaction();
            session.endSession();
            return; // Skip further processing for this donation
        }
        await Account.findByIdAndUpdate(usdAccount._id, { $inc: { balance: amountToDonate } }, { session });

        await session.commitTransaction();

        try {
            const donorName = `${fakeDonation.firstName} ${fakeDonation.lastName}`;
            const donationAmount = fakeDonation.amount;

            const recipientNotification = new Notification({
                user: link.user,
                text: `${donorName} has donated ${donationAmount} to your cause!`,
                type: 'Alert',
            });
            await recipientNotification.save();
        } catch (error) {
            console.error('Error sending email or saving notification:', error);
        }

        console.log('Fake donation created, DonationLink and CharityUser updated successfully');
    } catch (err) {
        await session.abortTransaction();
        console.error('Error during transaction:', err);
    } finally {
        session.endSession();
    }

    // After the donation transaction has been successfully committed
    if (updatedLink) {
        try {
            const charityUser = await CharityUser.findById(link.user);
            const recipientEmail = charityUser.email;
            const donorName = `${fakeDonation.firstName} ${fakeDonation.lastName}`;
            const donationAmount = fakeDonation.amount;
            const totalDonations = updatedLink.totalDonations;
            const recipientPhoneNumber = charityUser.phoneNumber;
            const title = updatedLink.title;

            // Attempt to send Email Notification
            try {
                await sendEmail({
                    toEmail: recipientEmail,
                    subject: `${donorName} - New Donation Received!`,
                    textContent: `Hello, Your donation link has received a new donation of ${donationAmount} from ${donorName}. Total donations now stand at $${totalDonations}.`,
                    senderName: donorName,
                    amount: donationAmount,
                    message: '',
                    donationLinkTitle: title,
                });
                console.log('Email sent successfully.');
            } catch (emailError) {
                console.error('Error sending email:', emailError);
            }

            // Attempt to send SMS Notification
            try {
                await sendDonationReceivedSMS(recipientPhoneNumber, donorName, donationAmount, totalDonations);
                console.log('SMS sent successfully.');
            } catch (smsError) {
                console.error('Error sending SMS:', smsError);
            }

            console.log('Fake donation created, DonationLink and CharityUser updated, notifications sent successfully');
        } catch (generalError) {
            console.error('Error in post-donation processing:', generalError);
        }
    } else {
        console.error('Updated link not defined, unable to proceed with notifications');
    }
}



// Function to find active links whose next donation time has passed and decide when to donate
function findAndDonate() {
    console.log("Cron job started: Checking for active links to create donations.");
    const currentTime = new Date();

    // Calculate the time 1 hour ago from the current time
    const oneHourAgo = new Date(currentTime.getTime() - (60 * 60 * 1000));

    DonationLink.find({
        status: 'test',
        $or: [
            { nextDonationTime: { $lte: currentTime } },
            { nextDonationTime: null, createdAt: { $lte: oneHourAgo } },
            { nextDonationTime: { $exists: false }, createdAt: { $lte: oneHourAgo } }
        ]
    })

        .then(activeLinks => {
            console.log(`Found ${activeLinks.length} active link(s) to process.`);
            activeLinks.forEach(link => {
                createDonation(link);
            });
        })
        .catch(err => console.error('Error fetching active links:', err));
}



// run periodically
function runDonationJob() {
    cron.schedule('* * * * *', () => {
        console.log("Cron job started: Checking for active links to create donations.");
        findAndDonate();
    });
}

module.exports = {
    runDonationJob,
    createDonation,
    findAndDonate,
    calculateNextDonationTime,
    getCompletionThreshold
};