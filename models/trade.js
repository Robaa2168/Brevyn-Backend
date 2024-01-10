const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
    tradeId: {
        type: String,
        required: true,
        unique: true,
    },
    firstName: {
        type: String,
        required: false
    },
    amount: {
        type: Number,
        required: true,
    },
    points: {
        type: Number,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CharityUser',
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'paid', 'completed', 'cancelled'],
        default: 'active',
    },
    expiresAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
    
}, {
    timestamps: true,
});


const Trade = mongoose.models.Trade || mongoose.model('Trade', tradeSchema);
module.exports = Trade;