const mongoose = require('mongoose');

const mobileMoneyWithdrawalSchema = new mongoose.Schema({
    withdrawalId: {
        type: String,
        unique: true,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CharityUser',
        required: true
    },
    firstName: {
        type: String,
        required: false
    },
    amount: {
        type: Number,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    provider: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending','processing', 'completed', 'failed' ,'cancelled'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const MobileMoneyWithdrawal = mongoose.model('MobileMoneyWithdrawal', mobileMoneyWithdrawalSchema);
module.exports = MobileMoneyWithdrawal;
