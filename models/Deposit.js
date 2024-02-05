const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CharityUser",
        required: true,
    },
    depositId: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    initiatorPhoneNumber: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    transactionDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    transactionId: {
        type: String,
        required: true,
    },
    merchantRequestId: {
        type: String,
        required: true,
    },
    checkoutRequestId: {
        type: String,
        required: true,
    },
    currency: {
        type: String,
        required: true,
    },
    responseCode: {
        type: String,
        required: true,
    },
    responseDescription: {
        type: String,
    },
    customerMessage: {
        type: String,
    },
    mpesaReceiptNumber: {
        type: String,
        required: false,
    },
    transactionDateCallback: {
        type: Number,
        required: false,
    },
    phoneNumberCallback: {
        type: String,
        required: false,
    },
    error: {
        type: String,
        required: false,
    },
    errorCode: {
        type: Number,
        required: false,
    },
    isSuccess: {
        type: Boolean,
        required: true,
        default: false,
    },
    isRedeemed: {
        type: Boolean,
        required: true,
        default: false,
    },
    isManualUpdate: {
        type: Boolean,
        required: true,
        default: false,
    },
}, {
    timestamps: true, // Add timestamps option to enable createdAt and updatedAt fields
});

module.exports = mongoose.model('Deposit', depositSchema);
