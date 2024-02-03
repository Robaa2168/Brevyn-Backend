// models/Account.js
const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CharityUser",
    required: true,
  },
  currency: {
    type: String,
    required: true,
    enum: ["USD", "GBP", "AUD", "CAD", "EUR", "ZAR", "KES", "UGX", "ZMW", "NGN", "RWF"],
  },
  balance: {
    type: Number,
    default: 0,
  },
  isBanned: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  state: {
    type: String,
    default: '-',
  },
  channel: {
    type: String,
    default: '-',
  },
  limit: {
    type: Number,
    default: 5000,
  },
  isHeld: {
    type: Boolean,
    default: false,
  },
  isPrimary: {
    type: Boolean,
    default: false,
  },
  firstName: {
    type: String,
  },
  heldAt: {
    type: Date,
  },
}, { timestamps: true });

const Account = mongoose.model("Account", accountSchema);

module.exports = Account;
