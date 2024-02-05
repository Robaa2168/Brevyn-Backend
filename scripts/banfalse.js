require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const CharityUser = require('../models/CharityUser');

// Configure your MongoDB URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connection established for script'))
.catch(err => console.error('MongoDB connection failed for script:', err));

const unbanAllUsers = async () => {
    try {
        // Update all users where isBanned is true to be false
        const updateResult = await CharityUser.updateMany(
            { isBanned: true },
            { $set: { isBanned: false } }
        );

        if (updateResult.modifiedCount > 0) {
            console.log(`Unbanned ${updateResult.modifiedCount} users.`);
        } else {
            console.log('No banned users to update.');
        }
    } catch (error) {
        console.error('Error un-banning users:', error);
    } finally {
        // Always close the Mongoose connection after the script is done
        mongoose.disconnect();
    }
};

unbanAllUsers();
