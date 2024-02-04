// models/Conversion.js
const mongoose = require("mongoose");

const ConversionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CharityUser",
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  transactionId: {
    type: String,
    required: true,
  },
  fromCurrency: {
    type: String,
    required: true,
  },
  toCurrency: {
    type: String,
    required: true,
  },
  fromAmount: {
    type: Number,
    required: true,
  },
  toAmount: {
    type: Number,
    required: true,
  },
  conversionRate: {
    type: Number,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Conversion", ConversionSchema);
