const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
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
    amount: {
        type: Number,
        required: true
    },
    bank: {
        type: String,
        required: true
    },
    accountNo: {
        type: String,
        required: true
    },
    beneficiaryName: {
        type: String,
        required: true
    },
    routingNumber: {
        type: String,
        required: false // depending on your needs
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
module.exports = Withdrawal;
