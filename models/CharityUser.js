// models/CharityUser.js

const mongoose = require('mongoose');

// Define a subdocument schema for tracking information
const trackingInfoSchema = new mongoose.Schema({
  fingerprintId: {
    type: String,
  },
  userIp: {
    type: String,
  },
  browser: {
    type: String,
  },
  os: {
    type: String,
  },
  platform: {
    type: String,
  },
  device: {
    type: String,
  }
}, { _id: false }); 

const CharityUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  profileImage: {
    type: String,
    required: false,
    default: 'https://example.com/default-image.jpg', 
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['donor', 'beneficiary', 'admin'],
    default: 'beneficiary'
  },
  phoneNumber: {
    type: String,
    unique: true,
    trim: true,
  },
  // New fields
  isBanned: {
    type: Boolean,
    default: false,
  },
  payId: {
    type: String,
    required: true,
    unique: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isPremium: {
    type: Boolean,
    default: false,
  },
  points: {
    type: Number,
    default: 0,
  },
  balance: {
    type: Number,
    default: 0,
  },
  otp: {
    type: String,
    required: false,
  },
  otpResendAttempts: {
    type: Number,
    default: 0,
  },
  otpNextResendTime: {
    type: Date,
  },
  referralCode: {
    type: String,
    required: false,
  },
  uniqueId: {
    type: String,
    required: true,
    unique: true,
  },
   lastLogin: {
    type: Date,
  },
  trackingInfo: [trackingInfoSchema]
},
  {
    timestamps: true,
  });

// Check if the model has already been defined
const CharityUser = mongoose.models.CharityUser || mongoose.model('CharityUser', CharityUserSchema);
module.exports = CharityUser;
