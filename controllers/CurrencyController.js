const mongoose = require('mongoose');
const Account = require('../models/Account');


const activationPriceUSD = 10;
const africanCurrencies = ['KES', 'ZAR', 'UGX', 'ZMW', 'NGN', 'RWF'];

const conversionRates = {
  USD: 1,
  EUR: 1.09019,
  GBP: 1.24180,
  CAD: 1.351745,
  AUD: 1.30172,
  KES: 1 / 160,
  ZAR: 1 / 14.87,
  UGX: 1 / 3725,
  ZMW: 1 / 19.98,
  NGN: 1 / 413.34,
  RWF: 1 / 1010,
};

function getActivationFee(currency) {
  if (africanCurrencies.includes(currency)) {
    return activationPriceUSD / conversionRates[currency];
  }
  return 10;
}


// Activate a currency for a user
exports.activateCurrency = async (req, res) => {
    const { currencyId } = req.params;
    const userId = req.user;
  
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
  
      if (!mongoose.Types.ObjectId.isValid(currencyId)) {
        return res.status(400).json({ message: "Invalid currency ID." });
      }
  
      const account = await Account.findOne({ user: userId, _id: currencyId }).session(session);
  
      if (!account) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Currency account not found." });
      }
  
      if (account.isActive) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `${account.currency} Currency is already activated.`});

      }
  
      const activationFee = getActivationFee(account.currency); // Ensure this function is defined
  
      if (account.balance < activationFee) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Insufficient balance to activate ${account.currency} currency.` });
      }
  
      // Deduct the activation fee and activate the currency
      const updatedAccount = await Account.findByIdAndUpdate(
        account._id,
        { $inc: { balance: -activationFee }, isActive: true },
        { new: true, session }
      );
  
      await session.commitTransaction();
      session.endSession();
      res.status(200).json({ message: "Currency activated successfully.", account: updatedAccount });
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      console.error("Error activating currency:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };

// Fetch currencies for a user
exports.fetchCurrencies = async (req, res) => {
    const userId = req.user;

    try {
        const accounts = await Account.find({ user: userId });
        res.status(200).json(accounts);
    } catch (error) {
        console.error("Error fetching currencies: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


// Fetch details of a specific currency for a user
exports.fetchCurrencyDetails = async (req, res) => {
    const { currencyId } = req.params; // Or use currencyCode if you're using currency codes
    const userId = req.user; // Assuming req.user contains the authenticated user's ID

    try {
        // Attempt to find the specific currency account for the user
        const account = await Account.findOne({
            user: userId,
            _id: currencyId, // Or use currency: currencyCode if using currency codes
        });

        if (!account) {
            return res.status(404).json({ message: "Currency account not found." });
        }

        res.status(200).json(account);
    } catch (error) {
        console.error("Error fetching currency details: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};