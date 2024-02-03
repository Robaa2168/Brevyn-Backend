require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const CharityUser = require('../models/CharityUser');
const Account = require('../models/Account');

// Configure your MongoDB URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connection established for script'))
.catch(err => console.error('MongoDB connection failed for script:', err));

const currencies = ["USD", "GBP", "AUD", "EUR", "KES"];

const createAccountWithRetry = async (userId, currency, retries = 3) => {
    try {
        const account = new Account({
            user: userId,
            currency: currency,
            isPrimary: currency === "USD",
            isActive: currency === "USD",
        });
        await account.save();
        console.log(`Successfully created account for ${currency}`);
    } catch (error) {
        console.log(`Attempt to create account for ${currency} failed: ${error}`);
        if (retries > 0) {
            console.log(`Retrying... Attempts left: ${retries - 1}`);
            await createAccountWithRetry(userId, currency, retries - 1);
        } else {
            throw new Error(`Failed to create account for ${currency} after multiple attempts.`);
        }
    }
};

const ensureUserAccounts = async () => {
    try {
        const users = await CharityUser.find({});
        
        for (const user of users) {
            for (const currency of currencies) {
                const existingAccount = await Account.findOne({ user: user._id, currency: currency });

                if (!existingAccount) {
                    try {
                        await createAccountWithRetry(user._id, currency);
                        console.log(`Account created for user: ${user._id} with currency: ${currency}`);
                    } catch (error) {
                        console.error(`Failed to create account for user: ${user._id} with currency: ${currency}. Error: ${error.message}`);
                    }
                } else {
                    console.log(`User: ${user._id} already has an account for currency: ${currency}`);
                }
            }
        }

        console.log('Finished ensuring all users have required currency accounts.');
    } catch (error) {
        console.error('Error ensuring user accounts:', error);
    }
};

ensureUserAccounts().then(() => mongoose.disconnect());
