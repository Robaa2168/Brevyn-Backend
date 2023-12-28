// models/Kyc.js
const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CharityUser',
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    dob: {
        type: Date,
        required: true
    },
    idNumber: {
        type: String,
        required: true
    },
    town: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
},
    {
        timestamps: true,
    });
    
// Check if the model has already been defined
const Kyc = mongoose.models.Kyc || mongoose.model('Kyc', kycSchema);
module.exports = Kyc;
