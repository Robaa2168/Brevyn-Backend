const mongoose = require('mongoose');

const donationLinkSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CharityUser',
        required: true
    },
    firstName: {
        type: String,
        required: false
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    targetAmount: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        required: true
    },
    uniqueIdentifier: {
        type: String,
        required: true,
        unique: true,
    },
    totalDonations: {
        type: Number,
        default: 0
    },
    image: {
        type: String,
        required: false,
        default: 'https://example.com/default-image.jpg'
    },
    status: {
        type: String,
        enum: ['active', 'completed','inactive', 'cancelled'],
        default: 'active'
    },
    views: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compile model from schema
const DonationLink = mongoose.models.DonationLink || mongoose.model('DonationLink', donationLinkSchema);

module.exports = DonationLink;
