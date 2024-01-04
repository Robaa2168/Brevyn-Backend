const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CharityUser',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CharityUser',
      required: true,
    },
    tradeId: {
        type: String,
        ref: 'Trade',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Check if the model has already been compiled
const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);

module.exports = Chat;
