const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { startSession } = require('mongoose');
const Kyc = require('../models/Kyc');
const Account = require("../models/Account");
const CharityUser = require('../models/CharityUser');
const Deposit = require('../models/Deposit');
const Notification = require('../models/Notification');
const Donation = require('../models/donations');
const nodemailer = require('nodemailer');
const axios = require("axios");
const dotenv = require("dotenv");

const formatPhoneNumber = (phoneNumber) => {
    // Check for expected formats and modify accordingly
    if (phoneNumber.startsWith("+")) {
      return phoneNumber.slice(1); // remove the '+' prefix
    }
    else if (phoneNumber.startsWith("254")) {
      return phoneNumber; // format is already correct
    } else if (phoneNumber.startsWith("0")) {
      return `254${phoneNumber.slice(1)}`; // replace leading 0 with country code
    } else if (phoneNumber.startsWith("7") || phoneNumber.startsWith("1")) {
      return `254${phoneNumber}`; // add country code prefix
    } else {
      return phoneNumber;
    }
  };
  
  
  // Safaricom API credentials
  const MAX_RETRY_COUNT = 3;
  const CONSUMER_KEY = 'mpHonr1ygwzA2fd9MpnQoa55K3k65G3I';
  const CONSUMER_SECRET = 'KQqKfHhvktKM3WB5';
  const LIPA_NA_MPESA_ONLINE_PASSKEY = '7f8c724ec1022a0acde20719041697df14dd76c0f047f569fca17e5105bbb80d';
  const SHORT_CODE = '4118171';
  const LIPA_NA_MPESA_ONLINE_SHORT_CODE = '4118171';
  const CALLBACK_URL = 'https://brevyn-backend.vercel.app/api/deposits/confirm_esrftj';
  
  // Safaricom API endpoints
  const TOKEN_URL = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const STK_PUSH_URL = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";
  const B2C_URL = "https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest";
  
  async function generateAccessToken() {
    console.log("generateAccessToken called");
  
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
    console.log("Encoded credentials:", auth);
  
    try {
      const response = await axios.get(TOKEN_URL, {
        headers: {
          "Authorization": `Basic ${auth}`
        }
      });
  
      console.log("Access token generated successfully.");
      return response.data.access_token;
    } catch (error) {
      console.error("Error generating access token:", error);
    }
  }
  
  const initiateDeposit = async (req, res) => {
    const { phoneNumber, amount, currency, initiatorPhoneNumber } = req.body;
    const userId = req.user;

    // Format the phoneNumber using your formatPhoneNumber function
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    // Rest of your code
    const accessToken = await generateAccessToken();
    const timeStamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, -3);
    const password = Buffer.from(`${LIPA_NA_MPESA_ONLINE_SHORT_CODE}${LIPA_NA_MPESA_ONLINE_PASSKEY}${timeStamp}`).toString("base64");

    try {
        const response = await axios.post(STK_PUSH_URL, {
            "BusinessShortCode": LIPA_NA_MPESA_ONLINE_SHORT_CODE,
            "Password": password,
            "Timestamp": timeStamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": formattedPhoneNumber, // Use the formatted phone number here
            "PartyB": '4118171',
            "PhoneNumber": formattedPhoneNumber, // Use the formatted phone number here
            "CallBackURL": CALLBACK_URL,
            "AccountReference": initiatorPhoneNumber,
            "TransactionDesc": "Payment via STK Push"
        }, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });
  
      // Save the deposit data to the database
      const depositData = {
        user:userId,
        phoneNumber: phoneNumber,
        initiatorPhoneNumber: initiatorPhoneNumber,
        amount: amount,
        currency: currency,
        transactionDate: new Date(),
        transactionId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription,
        customerMessage: response.data.CustomerMessage,
      };
  
      try {
        const newDeposit = new Deposit(depositData);
        await newDeposit.save();
        console.log('Deposit saved to the database:', newDeposit);
      } catch (error) {
        console.error('Error saving deposit data:', error);
      }
  
      res.status(200).json(response.data);
      console.log(response.data);
    } catch (error) {
      console.error("Error processing STK Push:", error);
      res.status(500).json({ error: "Error processing STK Push" });
    }
  };
  
  
  const getDepositStatus = async (req, res) => {
    const { checkoutRequestId } = req.params;
  
    try {
      const deposit = await Deposit.findOne({ checkoutRequestId });
  
      if (!deposit) {
        res.status(404).json({ error: 'Deposit not found' });
        return;
      }
  
      res.status(200).json(deposit);
    } catch (error) {
      console.error('Error getting deposit status:', error);
      res.status(500).json({ error: 'Error getting deposit status' });
    }
  };
  
 



  const confirmTransaction = async (req, res) => {
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
    const { ResultCode, CheckoutRequestID, CallbackMetadata } = req.body.Body.stkCallback;

    let session; // Define the session variable here

    try {
        session = await mongoose.startSession();
        session.startTransaction();

        const metadata = CallbackMetadata.Item.reduce((acc, item) => {
            acc[item.Name] = item.Value;
            return acc;
        }, {});

        const deposit = await Deposit.findOne({ checkoutRequestId: CheckoutRequestID }).session(session);
        if (!deposit) {
            throw new Error('Deposit not found.');
        }

        if (ResultCode !== 0) {
            // Handling for failed transactions
            const errorMessage = req.body.Body.stkCallback.ResultDesc;
            deposit.error = errorMessage;
            deposit.errorCode = ResultCode;
            deposit.isSuccess = false;
            await deposit.save({ session });
            throw new Error(errorMessage);
        }

        // Convert Amount based on currency
        const amountFloat = parseFloat(metadata.Amount);
        const convertedAmount = amountFloat / conversionRates[deposit.currency];

        // Ensure user exists
        const user = await User.findById(deposit.user).session(session);
        if (!user) {
            throw new Error('User not found.');
        }

        // Update the user's account balance
        await Account.findOneAndUpdate(
            { user: user._id, currency: deposit.currency },
            { $inc: { balance: convertedAmount } },
            { new: true, session }
        );

        // Mark the deposit as successful
        deposit.mpesaReceiptNumber = metadata.MpesaReceiptNumber;
        deposit.transactionDateCallback = metadata.TransactionDate;
        deposit.phoneNumberCallback = metadata.PhoneNumber;
        deposit.isSuccess = true;
        deposit.isRedeemed = true;
        await deposit.save({ session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Transaction confirmed and account updated.' });
    } catch (error) {
        if (session && session.inTransaction()) await session.abortTransaction();
        console.error('Error confirming transaction:', error);
        res.status(500).json({ message: 'Internal server error', error: error.toString() });
    } finally {
        if (session) session.endSession();
    }
};

  


  module.exports = { initiateDeposit, confirmTransaction, getDepositStatus };