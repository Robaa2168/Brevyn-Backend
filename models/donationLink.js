const mongoose = require('mongoose');

const donationLinkSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CharityUser',
        required: true
    },
    fingerprintId: {
        type: String,
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
        enum: ['active','approved', 'completed','inactive', 'cancelled', 'rejected', 'test'],
        default: 'active'
    },
    views: {
        type: Number,
        default: 0
    },
    completionThreshold: {
        type: Number, 
        default: null
    } ,
    nextDonationTime: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Compile model from schema
const DonationLink = mongoose.models.DonationLink || mongoose.model('DonationLink', donationLinkSchema);

module.exports = DonationLink;
