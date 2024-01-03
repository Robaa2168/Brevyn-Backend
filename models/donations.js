//models/donations.js


const mongoose = require('mongoose');

// Schema for each donation
const donationSchema = new mongoose.Schema({
    donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CharityUser',
        required: true,
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CharityUser',
        required: true,
    },
    donationLink: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DonationLink',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: [1, 'Donation must be at least 1 unit of your currency'],
    },
    date: {
        type: Date,
        default: Date.now,
    },
    message: {
        type: String,
        trim: true,
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['individual', 'corporation', 'foundation'],
        required: true,
    },
});

// Compile model from schema
const Donation = mongoose.models.Donation || mongoose.model('Donation', donationSchema);

module.exports = Donation;
