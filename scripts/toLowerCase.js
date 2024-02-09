require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const CharityUser = require('../models/CharityUser');

// Configure your MongoDB URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connection established for email formatting script'))
.catch(err => console.error('MongoDB connection failed for email formatting script:', err));

const formatEmailsToLowercase = async () => {
    try {
        // Fetch all users
        const users = await CharityUser.find({});

        // Track count of updated emails
        let updatedCount = 0;

        for (const user of users) {
            if (user.email && user.email !== user.email.toLowerCase()) {
                // Update the email to lowercase if it's not already
                user.email = user.email.toLowerCase();
                await user.save();
                updatedCount++;
            }
        }

        console.log(`Emails updated to lowercase for ${updatedCount} users.`);
    } catch (error) {
        console.error('Error formatting emails to lowercase:', error);
    } finally {
        mongoose.disconnect();
    }
};

formatEmailsToLowercase();
