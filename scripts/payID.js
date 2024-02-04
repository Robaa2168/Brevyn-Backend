require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const CharityUser = require('../models/CharityUser');

// Configure your MongoDB URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connection established for Pay ID generation script'))
.catch(err => console.error('MongoDB connection failed for script:', err));

// Function to generate a 6-digit Pay ID
function generatePayId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Function to iterate through users and update them with a Pay ID if they don't have one
const addPayIdToUsers = async () => {
    try {
        const usersWithoutPayId = await CharityUser.find({ payId: { $exists: false } });

        for (const user of usersWithoutPayId) {
            const payId = generatePayId();
            // Update user with a new Pay ID
            await CharityUser.findByIdAndUpdate(user._id, { payId }, { new: true });
            console.log(`Pay ID ${payId} added to user ${user._id}`);
        }

        console.log(`Finished adding Pay IDs. Updated ${usersWithoutPayId.length} users.`);
    } catch (error) {
        console.error('Error adding Pay IDs to users:', error);
    } finally {
        mongoose.disconnect();
    }
};

addPayIdToUsers();
