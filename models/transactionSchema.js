const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ["request", "transfer","bonus"],
    required: true,
  },
  transactionId: {
    type: String,
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CharityUser",
    required: true,
  },
  senderFirstName: {
    type: String,
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CharityUser",
    required: true,
  },
  receiverFirstName: {
    type: String,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "completed", "failed"],
    default: "pending",
  },
}, { timestamps: true });

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
