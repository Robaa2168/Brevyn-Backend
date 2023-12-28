// models/CharityUser.js

const mongoose = require('mongoose');

const CharityUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
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
  otp: {
    type: String,
    required: false,
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
},
  {
    timestamps: true,
  });

// Check if the model has already been defined
const CharityUser = mongoose.models.CharityUser || mongoose.model('CharityUser', CharityUserSchema);
module.exports = CharityUser;
