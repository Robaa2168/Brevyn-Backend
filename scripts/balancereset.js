require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const CharityUser = require('../models/CharityUser');

// Configure your MongoDB URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connection established for balance reset script'))
.catch(err => console.error('MongoDB connection failed for script:', err));

const resetCharityUserBalances = async () => {
    try {
        // Update all CharityUser documents where balance is greater than 0
        const updateResult = await CharityUser.updateMany(
            {}, // This empty object means no filter is applied, so it matches all documents
            { $set: { balance: 100 } }
        );

        if (updateResult.modifiedCount > 0) {
            console.log(`Successfully reset balances for ${updateResult.modifiedCount} users.`);
        } else {
            console.log('No balances to reset or update operation was not successful.');
        }
    } catch (error) {
        console.error('Error resetting CharityUser balances:', error);
    } finally {
        // Ensure you disconnect from MongoDB once the operation is complete
        mongoose.disconnect();
    }
};

resetCharityUserBalances();
