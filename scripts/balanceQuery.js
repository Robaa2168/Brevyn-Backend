require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const fs = require('fs').promises;
const CharityUser = require('../models/CharityUser');
const Account = require('../models/Account');
const Kyc = require('../models/Kyc');

// Configure your MongoDB URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connection established for script'))
.catch(err => console.error('MongoDB connection failed for script:', err));

const fingerprintIdToSearch = "39401076a8378aad1e90a89288a273f1";

const writeBalanceToTextFile = async () => {
    try {
        // Find all users with the specified fingerprintId
        const users = await CharityUser.find({});

        if (users.length > 0) {
            console.log(`Found ${users.length} users with fingerprintId: ${fingerprintIdToSearch}`);
            
            for (const user of users) {
                // Find Kyc information for the user
                const kycInfo = await Kyc.findOne({ user: user._id });

                // Create a text file with user information and account balances
                if (kycInfo) {
                    const userInfo = `Phone Number: ${kycInfo.phone}\nEmail: ${kycInfo.email}\nFirst Name: ${kycInfo.firstName}\n`;
                    await fs.appendFile('user_info.txt', userInfo);

                    // Get and display balances for each currency
                    const accountBalances = await Account.find({ user: user._id });
                    for (const account of accountBalances) {
                        const currencyBalance = `${account.currency}: ${account.balance}\n`;
                        await fs.appendFile('user_info.txt', currencyBalance);
                        
                        // Update isActive flag based on currency
                        if (account.currency !== 'USD') {
                            account.isActive = false;
                            await account.save();
                            console.log(`Currency ${account.currency} is now inactive for user ${user.username}`);
                        }
                    }
                    await fs.appendFile('user_info.txt', '\n');
                }
            }

            console.log('User information and account balances written to user_info.txt');

        } else {
            console.log(`No users found with fingerprintId: ${fingerprintIdToSearch}`);
        }
    } catch (error) {
        console.error('Error finding and updating users and accounts:', error);
    }
};

writeBalanceToTextFile().then(() => mongoose.disconnect());
