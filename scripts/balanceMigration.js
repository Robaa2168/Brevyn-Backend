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



const migrateBalancesToUSD = async () => {
    try {
        const users = await CharityUser.find({ balance: { $gt: 0 } });

        for (const user of users) {
            // Find the USD account for the user and increment its balance by the user's balance
            const updateResult = await Account.findOneAndUpdate(
                { user: user._id, currency: 'USD' },
                { $inc: { balance: user.balance } }, // Increment USD account balance
                { new: true } // Return the updated document
            );

            if (updateResult) {
                // Successfully updated the account, now reset the user's balance
                await CharityUser.findByIdAndUpdate(
                    user._id,
                    { $set: { balance: 0 } }
                );

                console.log(`Migrated $${user.balance} to USD account for user ${user._id}`);
            } else {
                // Handle the case where the user doesn't have a USD account
                console.error(`No USD account found for user ${user._id}. Attempting to create one.`);
            }
        }

        console.log('Finished migrating balances to USD accounts.');
    } catch (error) {
        console.error('Error migrating balances:', error);
    }
};


migrateBalancesToUSD().then(() => mongoose.disconnect());
