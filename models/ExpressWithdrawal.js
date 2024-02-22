const mongoose = require('mongoose');

const expressWithdrawalSchema = new mongoose.Schema({
  conversation_id: { type: String, unique: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharityUser',
    required: true
},
  originator_conversation_id: String,
  response_code: Number,
  response_description: String,
  result_code: Number,
  amount: Number,
  phoneNumber: String,
  result_description: String,
  transaction_id: String,
  transaction_amount: Number,
  transaction_receipt: String,
  recipient_registered: Boolean,
  charges_paid_account_funds: Number,
  receiver_party_public_name: String,
  transaction_completed_date_time: Date,
  utility_account_available_funds: Number,
  working_account_available_funds: Number,
  reference_data: {
    key: String,
    value: String
  }
});

module.exports = mongoose.model('ExpressWithdrawal', expressWithdrawalSchema);
