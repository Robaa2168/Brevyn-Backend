// cronJobs/expireTrades.js

const cron = require('node-cron');
const mongoose = require('mongoose');
const Trade = require('../models/trade');
const CharityUser = require('../models/CharityUser');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connection established for Cron Job'))
.catch(err => console.error('MongoDB connection failed for Cron Job:', err));

// Scheduled task to run every minute (adjust as necessary)
cron.schedule('* * * * *', async () => {
    console.log("Initiating task to search and update expired trades every minute");

    const currentTime = new Date();

    try {
        // Find all active trades that have expired
        const expiredTrades = await Trade.find({ status: 'active', expiresAt: { $lt: currentTime } });

        for (let trade of expiredTrades) {
            trade.status = 'cancelled';
            await trade.save();

            const user = await CharityUser.findById(trade.userId);
            const cancelledTradeCount = await Trade.countDocuments({ userId: user._id, status: 'cancelled' });

            if (cancelledTradeCount >= 5) {
                user.isBanned = true;
                await user.save();
            }
        }

        console.log(`Expired trades processed: ${expiredTrades.length}`);
    } catch (error) {
        console.error("Error occurred during the scheduled task for expired trades:", error);
    }
});
