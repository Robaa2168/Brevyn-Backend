// controllers/AdminCustomerController.js

const CharityUser = require('../models/CharityUser');
const Withdrawal = require('../models/Withdrawal');
const PaypalWithdrawal = require('../models/PaypalWithdrawal');
const MobileMoneyWithdrawal = require('../models/MobileMoneyWithdrawal');
const Account = require("../models/Account");
const Kyc = require('../models/Kyc');
const Conversion = require("../models/Conversion");
const Notification = require('../models/Notification');
const Trade = require('../models/trade');
const DonationLink = require('../models/donationLink');
const Donation = require('../models/donations');
const Comment = require('../models/Comment');
const CommentLike = require('../models/CommentLike');
const Chat = require('../models/Chat');
const Deposit = require('../models/Deposit');
const Transaction = require("../models/transactionSchema");


exports.getUserStats = async (req, res) => {
    try {
        const totalUsers = await CharityUser.countDocuments();
        const unverifiedUsers = await CharityUser.countDocuments({ isVerified: false });
        const bannedUsers = await CharityUser.countDocuments({ isBanned: true });

        // Count pending or processing withdrawals for each type
        const pendingOrProcessingBankWithdrawals = await Withdrawal.countDocuments({
            status: { $in: ['pending', 'processing'] }
        });
        const pendingOrProcessingPaypalWithdrawals = await PaypalWithdrawal.countDocuments({
            status: { $in: ['pending', 'processing'] }
        });
        const pendingOrProcessingMobileMoneyWithdrawals = await MobileMoneyWithdrawal.countDocuments({
            status: { $in: ['pending', 'processing'] }
        });

        // Sum all pending or processing withdrawals
        const totalPendingWithdrawals = pendingOrProcessingBankWithdrawals + pendingOrProcessingPaypalWithdrawals + pendingOrProcessingMobileMoneyWithdrawals;

        // Sum the amounts of successful deposits
        const successfulDeposits = await Deposit.aggregate([
            { $match: { isSuccess: true } }, // Adjusted to match successful deposits
            { $group: { _id: null, totalDeposits: { $sum: '$amount' } } }
        ]);

        const totalSuccessfulDeposits = successfulDeposits.length > 0 ? successfulDeposits[0].totalDeposits : 0;

        res.status(200).json({
            totalUsers,
            unverifiedUsers,
            bannedUsers,
            totalPendingWithdrawals,
            totalSuccessfulDeposits
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
};




exports.getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, email, payId, phoneNumber } = req.query;
        const offset = (page - 1) * limit;

        // Initial match stage to filter users based on provided search criteria
        let matchStage = {
            $match: {}
        };
        if (email) matchStage.$match.email = new RegExp(email, 'i');
        if (payId) matchStage.$match.payId = new RegExp(payId, 'i');
        if (phoneNumber) matchStage.$match.phoneNumber = new RegExp(phoneNumber, 'i');

        // Aggregation pipeline
        const pipeline = [
            matchStage,
            {
                $lookup: {
                    from: "charityusers",
                    localField: "trackingInfo.fingerprintId",
                    foreignField: "trackingInfo.fingerprintId",
                    as: "associatedUsers"
                }
            },
            {
                $addFields: {
                    associatedAccountsCount: {
                        $cond: {
                            if: {
                                $or: [
                                    // Check if fingerprintId is missing, null, or empty
                                    { $not: [{ $gt: [{ $size: { $ifNull: ["$trackingInfo.fingerprintId", []] } }, 0] }] },
                                    // Check if trackingInfo array is empty
                                    { $eq: [{ $size: { $ifNull: ["$trackingInfo", []] } }, 0] }
                                ]
                            },
                            then: 0,
                            else: {
                                $size: {
                                    $filter: {
                                        input: "$associatedUsers",
                                        as: "user",
                                        cond: { $ne: ["$$user._id", "$_id"] } // Exclude the user itself
                                    }
                                }
                            }
                        }
                    }
                }
            
            },
            {
                $project: { // Adjust fields to project as necessary
                    payId: 1,
                    username: 1,
                    email: 1,
                    phoneNumber: 1,
                    associatedAccountsCount: 1,
                    isBanned:1
                }
            },
            { $skip: offset },
            { $limit: parseInt(limit) }
        ];

        // Execute aggregation pipeline
        const users = await CharityUser.aggregate(pipeline);

        // Getting the total count of documents matching the initial filter, for pagination
        const totalUsers = await CharityUser.countDocuments(matchStage.$match);

        res.status(200).json({
            total: totalUsers,
            page,
            totalPages: Math.ceil(totalUsers / limit),
            users
        });
    } catch (error) {
        console.error("Error in getUsers aggregation: ", error.message);
        res.status(500).json({ message: error.message });
    }
};




exports.banUser = async (req, res) => {
    try {
        const user = await CharityUser.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        user.isBanned = !user.isBanned;
        await user.save();
        res.status(200).json({ message: `User has been ${user.isBanned ? 'banned' : 'unbanned'}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const userId = req.params.userId;

        // Find the user before deletion to ensure it exists
        const user = await CharityUser.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete associated records in other collections
        await Promise.all([
            Account.deleteMany({ user: userId }, { session }),
            Chat.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] }, { session }),
            Comment.deleteMany({ user: userId }, { session }),
            Notification.deleteMany({ user: userId }, { session }),
            CommentLike.deleteMany({ user: userId }, { session }),
            Conversion.deleteMany({ user: userId }, { session }),
            Deposit.deleteMany({ user: userId }, { session }),
            DonationLink.deleteMany({ user: userId }, { session }),
            Donation.deleteMany({ $or: [{ donor: userId }, { recipient: userId }] }, { session }),
            Kyc.deleteMany({ user: userId }, { session }),
            MobileMoneyWithdrawal.deleteMany({ userId: userId }, { session }),
            PaypalWithdrawal.deleteMany({ userId: userId }, { session }),
            Trade.deleteMany({ userId: userId }, { session }),
            Transaction.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] }, { session }),
            Withdrawal.deleteMany({ userId: userId }, { session }),
        ]);

        // Finally, delete the user
        await CharityUser.findByIdAndDelete(userId, { session });

        await session.commitTransaction();
        session.endSession();
        
        res.status(200).json({ message: 'User and all associated records have been deleted' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: error.message });
    }
};
