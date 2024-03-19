//controllers/AdminCustomerDetailController.js

const CharityUser = require('../models/CharityUser');
const Kyc = require('../models/Kyc');
const Conversion = require('../models/Conversion');
const Deposit = require('../models/Deposit'); 
const BankWithdrawal = require('../models/Withdrawal'); // Assuming bank withdrawals are in this model
const PaypalWithdrawal = require('../models/PaypalWithdrawal');
const MobileMoneyWithdrawal = require('../models/MobileMoneyWithdrawal');
const Transaction = require('../models/transactionSchema');
const Account = require('../models/Account');

exports.getUserTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({ $or: [{ sender: req.params.userId }, { receiver: req.params.userId }] })
                                              .sort({ createdAt: -1 })
                                              .limit(10);
        res.json(transactions);
    } catch (error) {
        console.error("Error fetching user transactions: ", error);
        res.status(500).json({ message: error.message });
    }
};

exports.getUserWithdrawals = async (req, res) => {
    try {
        // Fetch withdrawals from all sources
        const bankWithdrawals = await BankWithdrawal.find({ user: req.params.userId }).limit(10);
        const paypalWithdrawals = await PaypalWithdrawal.find({ userId: req.params.userId }).limit(10);
        const mobileMoneyWithdrawals = await MobileMoneyWithdrawal.find({ userId: req.params.userId }).limit(10);

        // Combine and sort by date, then slice to get the most recent 10 across all types
        const combinedWithdrawals = [...bankWithdrawals, ...paypalWithdrawals, ...mobileMoneyWithdrawals]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 10);

        res.json(combinedWithdrawals);
    } catch (error) {
        console.error("Error fetching withdrawal data: ", error);
        res.status(500).json({ message: error.message });
    }
};

exports.getUserDeposits = async (req, res) => {
    try {
        const deposits = await Deposit.find({ user: req.params.userId })
            .sort({ createdAt: -1 }) // Sort by date in descending order to get the most recent
            .limit(10); // Limit to 10 results
        res.json(deposits);
    } catch (error) {
        console.error("Error fetching user deposits: ", error);
        res.status(500).json({ message: error.message });
    }
};

exports.getUserConversions = async (req, res) => {
    try {
        const conversions = await Conversion.find({ user: req.params.userId })
            .sort({ createdAt: -1 }) // Sort by date in descending order to get the most recent
            .limit(10); // Limit to 10 results
        res.json(conversions);
    } catch (error) {
        console.error("Error fetching user conversions: ", error);
        res.status(500).json({ message: error.message });
    }
};


exports.getUserDetails = async (req, res) => {
    try {
        const user = await CharityUser.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error("Error fetching user details: ", error);
        res.status(500).json({ message: error.message });
    }
};

exports.getUserKyc = async (req, res) => {
    try {
        const kyc = await Kyc.findOne({ user: req.params.userId });
        if (!kyc) {
            return res.status(404).json({ message: 'KYC not found for this user' });
        }
        res.json(kyc);
    } catch (error) {
        console.error("Error fetching KYC details: ", error);
        res.status(500).json({ message: error.message });
    }
};




exports.updateUserDetails = async (req, res) => {
    const { userId } = req.params;
    const updateData = req.body; // assuming all necessary user fields are passed in request body

    try {
        const updatedUser = await CharityUser.findByIdAndUpdate(userId, updateData, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(updatedUser);
    } catch (error) {
        console.error("Error updating user details: ", error);
        res.status(500).json({ message: error.message });
    }
};


exports.updateUserKyc = async (req, res) => {
    const { userId } = req.params;
    const kycData = req.body; // assuming all necessary KYC fields are passed in request body

    try {
        const kyc = await Kyc.findOneAndUpdate({ user: userId }, kycData, { new: true });
        if (!kyc) {
            return res.status(404).json({ message: 'KYC not found for this user' });
        }
        res.json(kyc);
    } catch (error) {
        console.error("Error updating KYC details: ", error);
        res.status(500).json({ message: error.message });
    }
};


exports.getUserAccounts = async (req, res) => {
    try {
        const accounts = await Account.find({ user: req.params.userId });
        res.json(accounts);
    } catch (error) {
        console.error("Error fetching accounts: ", error);
        res.status(500).json({ message: error.message });
    }
};

exports.toggleHeldStatus = async (req, res) => {
    try {
        const account = await Account.findById(req.params.accountId);
        account.isHeld = !account.isHeld;
        await account.save();
        res.json({ message: 'Held status toggled', account });
    } catch (error) {
        console.error("Error toggling held status: ", error);
        res.status(500).json({ message: error.message });
    }
};

exports.toggleActiveState = async (req, res) => {
    try {
        const account = await Account.findById(req.params.accountId);
        account.isActive = !account.isActive;
        await account.save();
        res.json({ message: 'Active state toggled', account });
    } catch (error) {
        console.error("Error toggling active state: ", error);
        res.status(500).json({ message: error.message });
    }
};

exports.updateAccountBalance = async (req, res) => {
    try {
        const account = await Account.findById(req.params.accountId);
        account.balance = req.body.balance;
        await account.save();
        res.json({ message: 'Balance updated', account });
    } catch (error) {
        console.error("Error updating balance: ", error);
        res.status(500).json({ message: error.message });
    }
};