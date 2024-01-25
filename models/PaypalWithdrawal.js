const mongoose = require('mongoose');

const paypalWithdrawalSchema = new mongoose.Schema({
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
    email: {
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

const PaypalWithdrawal = mongoose.model('PaypalWithdrawal', paypalWithdrawalSchema);
module.exports = PaypalWithdrawal;
