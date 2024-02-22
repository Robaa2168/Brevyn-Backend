const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Account = require("../models/Account");
const Withdrawal = require('../models/Withdrawal');
const PaypalWithdrawal = require('../models/PaypalWithdrawal');
const MobileMoneyWithdrawal = require('../models/MobileMoneyWithdrawal');
const ExpressWithdrawal = require('../models/ExpressWithdrawal');
const CharityUser = require('../models/CharityUser');
const Notification = require('../models/Notification');
const Kyc = require('../models/Kyc');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');


// Safaricom API credentials
const MAX_RETRY_COUNT = 3;
const CONSUMER_KEY = 'mpHonr1ygwzA2fd9MpnQoa55K3k65G3I';
const CONSUMER_SECRET = 'KQqKfHhvktKM3WB5';
const LIPA_NA_MPESA_ONLINE_PASSKEY = '7f8c724ec1022a0acde20719041697df14dd76c0f047f569fca17e5105bbb80d';
const SHORT_CODE = '4118171';
const LIPA_NA_MPESA_ONLINE_SHORT_CODE = '4118171';
const CALLBACK_URL = 'https://brevyn-backend.vercel.app/api/deposits/confirm_esrftj';
const CALLBACK_B2C_URL = 'https://brevyn-backend.vercel.app/api/transactions/withdraw/confirm_bonus';

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

async function sendEmail({ toEmail, subject, textContent, htmlVariables }) {
    const templatePath = path.join(__dirname, '..', 'templates', 'withdrawalTemplate.html');
    let htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Replace variables in HTML content
    Object.keys(htmlVariables).forEach((key) => {
        htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), htmlVariables[key]);
    });

    // Handling conditional blocks
    htmlContent = htmlContent.replace(/{{#if bank}}(.*?){{\/if}}/gs, htmlVariables['bank'] ? '$1' : '');
    htmlContent = htmlContent.replace(/{{#if paypal}}(.*?){{\/if}}/gs, htmlVariables['paypal'] ? '$1' : '');
    htmlContent = htmlContent.replace(/{{#if mobile}}(.*?){{\/if}}/gs, htmlVariables['mobile'] ? '$1' : '');

    let transporter = nodemailer.createTransport({
        host: "mail.privateemail.com",
        port: 587,
        secure: false,
        auth: {
            user: 'support@verdantcharity.org',
            pass: 'Lahaja2168#',
        },
    });

    let info = await transporter.sendMail({
        from: '"Verdant Charity" <support@verdantcharity.org>',
        to: toEmail,
        subject: subject,
        text: textContent,
        html: htmlContent,
    });

    console.log("Message sent: %s", info.messageId);
    return info;
}


async function sendAdminWithdrawalSMS(adminPhoneNumber, withdrawalAmount, userFirstName, userPhoneNumber) {
    const url = "https://sms.textsms.co.ke/api/services/sendsms/";
    const roundedAmount = Math.floor(withdrawalAmount);
    const message = `New withdrawal of KES${roundedAmount} by ${userFirstName}. Customer's phone number: ${userPhoneNumber}.`;
  
    const data = {
      apikey: "a5fb51cb37deb6f3c38c0f45f737cc10",
      partnerID: 5357,
      message: message,
      shortcode: "WINSOFT",
      mobile: adminPhoneNumber
    };
  
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(data),
    };
  
    const response = await fetch(url, options);
    const result = await response.json();
    return result;
  }
  

exports.handleWithdraw = async (req, res) => {
    const { amount, bank, accountNo, beneficiaryName, routingNumber, currency } = req.body;

    // Check if all required fields are provided
    if (!amount || !bank || !accountNo || !beneficiaryName) {
        return res.status(400).json({ message: "All fields are required: amount, bank, accountNo, beneficiaryName." });
    }
    // Ensure the currency is KES, otherwise return an error
    if (currency !== 'KES') {
        return res.status(400).json({ message: `Withdrawals in ${currency} are not supported in your region. Please convert to your local currency (KES) before initiating a withdrawal.` });
    }

    // Ensure amount is a number and round it down
    const withdrawalAmount = Math.floor(Number(amount));
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount provided." });
    }

    const userId = req.user;
    const withdrawalId = `WDW-BANK-${uuidv4().substring(0, 8).toUpperCase()}`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await CharityUser.findById(userId).session(session);
        const userKyc = await Kyc.findOne({ user: userId }).session(session);
        const firstName = userKyc.firstName;

        if (!user || !userKyc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "User not found or KYC not filled." });
        }

        if (user.isBanned) {
            await session.abortTransaction();
            return res.status(403).json({ message: "User is banned and cannot make a withdrawal." });
        }
        if (!currency) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Currency is required for the withdrawal." });
        }

        // Check if the user already has a pending or processing withdrawal in any method
        const existingWithdrawals = await Promise.all([
            Withdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
            PaypalWithdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
            MobileMoneyWithdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
        ]);

        if (existingWithdrawals.some(withdrawal => withdrawal !== null)) {
            await session.abortTransaction();
            return res.status(400).json({ message: "User already has a pending or processing withdrawal request." });
        }

        // Find the specific currency account for the user
        const account = await Account.findOne({ user: userId, currency }).session(session);

        // Check if the account exists, is active, not held, and has sufficient balance
        if (!account) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: `Account for ${currency} does not exist.` });
        }

        if (!account.isActive || account.isHeld) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Account for ${currency} is not active or is held.` });
        }

        if (account.balance < withdrawalAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Insufficient funds in ${currency} account.` });
        }

        // Deduct the withdrawal amount from the specific currency account atomically
        const updatedAccount = await Account.findOneAndUpdate(
            { _id: account._id, balance: { $gte: withdrawalAmount } },
            { $inc: { balance: -withdrawalAmount } },
            { new: true, session }
        );

        if (!updatedAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Failed to deduct the withdrawal amount. Please try again." });
        }

        // Record the withdrawal with the firstName
        const newWithdrawal = new Withdrawal({
            withdrawalId,
            userId,
            amount: withdrawalAmount,
            bank,
            accountNo,
            beneficiaryName,
            routingNumber,
            status: 'pending',
            firstName: firstName,
            currency: currency,
        });

        await newWithdrawal.save({ session });

        const notification = new Notification({
            user: userId,
            text: `Your withdrawal request of ${currency} ${withdrawalAmount} is being processed.`,
            type: 'Alert'
        });

        await notification.save({ session });

        await session.commitTransaction();

        // Prepare and send an email
        const emailVars = {
            amount: withdrawalAmount.toString(),
            currency: currency,
            bank: bank,
            accountNo: accountNo,
            beneficiaryName: beneficiaryName,
            withdrawalId: withdrawalId,
            firstName: firstName,
            paypal: false,
            mobile: false
        };


        const emailTextContent = `Hello ${beneficiaryName},

        Your request to withdraw ${currency} ${withdrawalAmount} to the bank account ending in ${accountNo} at ${bank} has been received and is being processed.
        
        Withdrawal ID: ${withdrawalId}
        
        First Name: ${firstName}
        
        Please allow 1-3 days for the funds to reflect in your account.
        
        If you have any questions or need further assistance, please contact our support team.
        
        Best Regards,
        Verdant Charity Team.`;


        // Prepare and send an email
        await sendEmail({
            toEmail: userKyc.email,
            subject: `Withdrawal Request Received - ${withdrawalId}`,
            textContent: emailTextContent,
            htmlVariables: emailVars,

        });

        res.status(201).json({ message: "Withdrawal request created successfully!", withdrawal: newWithdrawal });
    } catch (error) {
        console.error('Error handling withdrawal:', error);
        await session.abortTransaction();
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};



exports.handlePaypalWithdraw = async (req, res) => {
    const { amount, email, currency } = req.body;

    // Check if amount and email are provided
    if (!amount || !email) {
        return res.status(400).json({ message: "Amount and email are required." });
    }
    // Ensure the currency is KES, otherwise return an error
    if (currency !== 'KES') {
        return res.status(400).json({ message: `Withdrawals in ${currency} are not supported in your region. Please convert to your local currency (KES) before initiating a withdrawal.` });
    }

    // Ensure amount is a number and round it down
    const withdrawalAmount = Math.floor(Number(amount));
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount provided." });
    }
    const userId = req.user;
    const withdrawalId = `WDW-PAYPAL-${uuidv4().substring(0, 8).toUpperCase()}`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await CharityUser.findById(userId).session(session);
        const userKyc = await Kyc.findOne({ user: userId }).session(session);
        const firstName = userKyc.firstName;

        if (!user || !userKyc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "User not found or KYC not filled." });
        }

        if (user.isBanned) {
            await session.abortTransaction();
            return res.status(403).json({ message: "User is banned and cannot make a withdrawal." });
        }
        if (!currency) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Currency is required for the withdrawal." });
        }


        // Check if the user already has a pending or processing withdrawal in any method
        const existingWithdrawals = await Promise.all([
            Withdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
            PaypalWithdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
            MobileMoneyWithdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
        ]);

        if (existingWithdrawals.some(withdrawal => withdrawal !== null)) {
            await session.abortTransaction();
            return res.status(400).json({ message: "User already has a pending or processing withdrawal request." });
        }

        // Find the specific currency account for the user
        const account = await Account.findOne({ user: userId, currency }).session(session);

        // Check if the account exists, is active, not held, and has sufficient balance
        if (!account) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: `Account for ${currency} does not exist.` });
        }

        if (!account.isActive || account.isHeld) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Account for ${currency} is not active or is held.` });
        }

        if (account.balance < withdrawalAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Insufficient funds in ${currency} account.` });
        }


        // Deduct the withdrawal amount from the specific currency account atomically
        const updatedAccount = await Account.findOneAndUpdate(
            { _id: account._id, balance: { $gte: withdrawalAmount } },
            { $inc: { balance: -withdrawalAmount } },
            { new: true, session }
        );

        if (!updatedAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Failed to deduct the withdrawal amount. Please try again." });
        }

        // Record the PayPal withdrawal
        const newPaypalWithdrawal = new PaypalWithdrawal({
            withdrawalId,
            userId,
            firstName: firstName,
            amount: withdrawalAmount,
            email,
            currency: currency,
            status: 'pending'
        });
        await newPaypalWithdrawal.save({ session });

        // Create a notification for the user about the withdrawal request
        const notification = new Notification({
            user: userId,
            text: `Your PayPal withdrawal request of ${currency} ${withdrawalAmount} is being processed.`,
            type: 'Alert'
        });
        await notification.save({ session });

        await session.commitTransaction();

        // Prepare and send an email
        const emailVars = {
            amount: withdrawalAmount.toString(),
            email: email,
            beneficiaryName: firstName,
            withdrawalId: withdrawalId,
            currency: currency,
            bank: false,
            paypal: true,
            mobile: false
        };

        const emailTextContent = `Hello,

        Your request to withdraw ${currency} ${withdrawalAmount} to your PayPal account (${email}) has been received and is being processed.
        
        Withdrawal ID: ${withdrawalId}
        
        Please allow 1-3 days for the funds to reflect in your account.
        
        If you have any questions or need further assistance, please contact our support team.
        
        Best Regards,
        Verdant Charity.`;

        await sendEmail({
            toEmail: userKyc.email,
            subject: `PayPal Withdrawal Request - ${withdrawalId}`,
            textContent: emailTextContent,
            htmlVariables: emailVars,
        });

        res.status(201).json({ message: "PayPal withdrawal request created successfully!", withdrawal: newPaypalWithdrawal });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};



exports.handleMobileMoneyWithdraw = async (req, res) => {
    const { amount, phoneNumber, provider, currency } = req.body;

    // Check if amount and email are provided
    if (!amount || !phoneNumber || !provider) {
        return res.status(400).json({ message: "All the fields are required." });
    }
    // Ensure the currency is KES, otherwise return an error
    if (currency !== 'KES') {
        return res.status(400).json({ message: `Withdrawals in ${currency} are not supported in your region. Please convert to your local currency (KES) before initiating a withdrawal.` });

    }

    // Ensure amount is a number and round it down
    const withdrawalAmount = Math.floor(Number(amount));
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount provided." });
    }
    const userId = req.user;
    const withdrawalId = `WDW-MOBILE-${uuidv4().substring(0, 8).toUpperCase()}`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await CharityUser.findById(userId).session(session);
        const userKyc = await Kyc.findOne({ user: userId }).session(session);
        const firstName = userKyc.firstName;

        if (!user || !userKyc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "User not found or KYC not filled." });
        }

        if (user.isBanned) {
            await session.abortTransaction();
            return res.status(403).json({ message: "User is banned and cannot make a withdrawal." });
        }
        if (!currency) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Currency is required for the withdrawal." });
        }

        // Check if the user already has a pending or processing withdrawal in any method
        const existingWithdrawals = await Promise.all([
            Withdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
            PaypalWithdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
            MobileMoneyWithdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
        ]);

        if (existingWithdrawals.some(withdrawal => withdrawal !== null)) {
            await session.abortTransaction();
            return res.status(400).json({ message: "User already has a pending or processing withdrawal request." });
        }

        // Find the specific currency account for the user
        const account = await Account.findOne({ user: userId, currency }).session(session);

        // Check if the account exists, is active, not held, and has sufficient balance
        if (!account) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: `Account for ${currency} does not exist.` });
        }

        if (!account.isActive || account.isHeld) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Account for ${currency} is not active or is held.` });
        }

        if (account.balance < withdrawalAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Insufficient funds in ${currency} account.` });
        }

        // Deduct the withdrawal amount from the specific currency account atomically
        const updatedAccount = await Account.findOneAndUpdate(
            { _id: account._id, balance: { $gte: withdrawalAmount } },
            { $inc: { balance: -withdrawalAmount } },
            { new: true, session }
        );

        if (!updatedAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Failed to deduct the withdrawal amount. Please try again." });
        }

        // Record the Mobile Money withdrawal
        const newMobileMoneyWithdrawal = new MobileMoneyWithdrawal({
            withdrawalId,
            userId,
            firstName: firstName,
            amount: withdrawalAmount,
            currency: currency,
            phoneNumber,
            provider,
            status: 'pending'
        });
        await newMobileMoneyWithdrawal.save({ session });

        // Create a notification for the user about the withdrawal request
        const notification = new Notification({
            user: userId,
            text: `Your Mobile Money withdrawal request of ${currency} ${withdrawalAmount} is being processed.`,
            type: 'Alert'
        });
        await notification.save({ session });

        await session.commitTransaction();

        // Prepare and send an email
        const emailVars = {
            amount: withdrawalAmount.toString(),
            beneficiaryName: firstName,
            phoneNumber: phoneNumber,
            provider: provider,
            withdrawalId: withdrawalId,
            currency: currency,
            bank: false,
            paypal: false,
            mobile: true
        };

        const emailTextContent = `Hello,

        Your request to withdraw ${currency} ${withdrawalAmount} to your Mobile Money account (${provider}, Phone: ${phoneNumber}) has been received and is being processed.
        
        Withdrawal ID: ${withdrawalId}
        
        Please allow 1-3 days for the funds to reflect in your account.
        
        If you have any questions or need further assistance, please contact our support team.
        
        Best Regards,
        Verdant Charity.`;

        await sendEmail({
            toEmail: userKyc.email,
            subject: `Mobile Money Withdrawal Request - ${withdrawalId}`,
            textContent: emailTextContent,
            htmlVariables: emailVars,
        });

        res.status(201).json({ message: "Mobile Money withdrawal request created successfully!", withdrawal: newMobileMoneyWithdrawal });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};



exports.getUserWithdrawals = async (req, res) => {
    try {
        const userId = req.user;

        // Fetching withdrawals from different sources
        const bankWithdrawals = await Withdrawal.find({ userId }).sort({ createdAt: -1 });
        const paypalWithdrawals = await PaypalWithdrawal.find({ userId }).sort({ createdAt: -1 });
        const mobileMoneyWithdrawals = await MobileMoneyWithdrawal.find({ userId }).sort({ createdAt: -1 });

        // Combining all withdrawals
        const allWithdrawals = [...bankWithdrawals, ...paypalWithdrawals, ...mobileMoneyWithdrawals];

        // Sorting by createdAt date
        allWithdrawals.sort((a, b) => b.createdAt - a.createdAt);

        // Optionally limit the results
        const limitedWithdrawals = allWithdrawals.slice(0, 10);

        res.status(200).json(limitedWithdrawals);
    } catch (error) {
        console.error("Error fetching user withdrawals: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



exports.getWithdrawalDetails = async (req, res) => {
    try {
        const { withdrawalId } = req.params;

        let withdrawalDetails = null;
        let type = '';

        // Attempt to find the withdrawal in each collection and set the type accordingly
        withdrawalDetails = await Withdrawal.findById(withdrawalId);
        if (withdrawalDetails) {
            type = 'Bank';
        } else {
            withdrawalDetails = await PaypalWithdrawal.findById(withdrawalId);
            if (withdrawalDetails) {
                type = 'Paypal';
            } else {
                withdrawalDetails = await MobileMoneyWithdrawal.findById(withdrawalId);
                if (withdrawalDetails) {
                    type = 'MobileMoney';
                }
            }
        }

        if (withdrawalDetails) {
            // Add the type to the withdrawal details before sending the response
            const responseDetails = { ...withdrawalDetails.toObject(), type }; // Ensure to convert Mongoose document to object
            res.status(200).json(responseDetails);
        } else {
            res.status(404).json({ message: "Withdrawal not found" });
        }
    } catch (error) {
        console.error("Error fetching withdrawal details: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



const sendMoneyToConsumer = async (phoneNumber, withdrawalAmount, userId) => {
    console.log("sendMoneyToConsumer called");
    let retryCount = 0;
    let transactionCompleted = false;
    
    while (retryCount < MAX_RETRY_COUNT && !transactionCompleted) {
      try {
        // Generate a new access token for each retry
        const accessToken = await generateAccessToken();
        const response = await axios.post(B2C_URL, {
          "InitiatorName": "robaa2168",
          "SecurityCredential": "B1MqpnsKcs5cipRg+U7wIIPG4IxPn+B93N8S2XBuWHmIYLEJ2m0ItM2uW1MraxNukWV6snF6Uhr3qlD21HR1Yi79Pys0izNq+CcR3yS0VTI/nqUm6U1+QSBoSgdykuhSZmETsoX1/pCoidqJ25b8K6L/4QZJUaweLR+n7eB9t2SRwoWp3vFTJRHHnV9KUSj9wiuWFsjij8+rQswuicPGv7KJOuLUhrAgCHFuCTdDKvstbkB7Q3R3MvIPHMhYUQf45u8rPbBT+czHFJNsvJFjjoyJOx4d4p3hsXJe8wnx6lsTUB9IZor8a6xRZ4PTLTDQyzdkuhX/lA9BLGXwdI8udQ==",
          "CommandID": "PromotionPayment",
          "Amount": withdrawalAmount,
          "PartyA": SHORT_CODE,
          "PartyB": phoneNumber,
          "Remarks": "B2C Payment",
          "QueueTimeOutURL": CALLBACK_B2C_URL,
          "ResultURL": CALLBACK_B2C_URL,
          "Occasion": "B2C Transfer"
        }, {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        });
  
        console.log("M-Pesa B2C Response:", response.data);
  
        const expressWithdrawal = new ExpressWithdrawal({
          conversation_id: response.data.ConversationID,
          userId: userId,
          originator_conversation_id: response.data.OriginatorConversationID,
          response_code: response.data.ResponseCode,
          response_description: response.data.ResponseDescription,
          phoneNumber: phoneNumber,
          amount: withdrawalAmount,
        });
  
        await expressWithdrawal.save();
  
        transactionCompleted = true;
        return response.data;
      } catch (error) {
        console.error(`Error processing B2C payment (Retry ${retryCount + 1}):`, error);
        retryCount++;
        // If this is the last retry, throw the final error
        if (retryCount === MAX_RETRY_COUNT) {
          console.error(`Max retry limit (${MAX_RETRY_COUNT}) reached. Throwing final error.`);
          throw new Error("Error processing B2C payment");
        }
        // Wait for a brief moment before retrying (you can adjust the delay as needed)
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }
  };
  


exports.handleBonusWithdraw = async (req, res) => {
    const { amount, phoneNumber, provider, currency } = req.body;

    // Check if amount and email are provided
    if (!amount || !phoneNumber || !provider) {
        return res.status(400).json({ message: "All the fields are required." });
    }
    // Ensure the currency is KES, otherwise return an error
    if (currency !== 'KES') {
        return res.status(400).json({ message: `Withdrawals in ${currency} are not supported in your region. Please convert to your local currency (KES) before initiating a withdrawal.` });

    }

    // Ensure amount is a number and round it down
    const withdrawalAmount = Math.floor(Number(amount));
    if (isNaN(withdrawalAmount) || withdrawalAmount < 50 || withdrawalAmount > 300) {
        return res.status(400).json({ message: "Invalid amount provided. Minimum is KES 50" });
    }
    const userId = req.user;
    const withdrawalId = `WDW-MOBILE-${uuidv4().substring(0, 8).toUpperCase()}`;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await CharityUser.findById(userId).session(session);
        const userKyc = await Kyc.findOne({ user: userId }).session(session);
        const firstName = userKyc.firstName;

        if (!user || !userKyc) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "User not found or KYC not filled." });
        }

        if (user.isBanned) {
            await session.abortTransaction();
            return res.status(403).json({ message: "User is banned and cannot make a withdrawal." });
        }
        if (!currency) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Currency is required for the withdrawal." });
        }

        // Check if the user already has a pending or processing withdrawal in any method
        const existingWithdrawals = await Promise.all([
            Withdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
            PaypalWithdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
            MobileMoneyWithdrawal.findOne({ userId, status: { $in: ['pending', 'processing'] } }).session(session),
        ]);

        if (existingWithdrawals.some(withdrawal => withdrawal !== null)) {
            await session.abortTransaction();
            return res.status(400).json({ message: "User already has a pending or processing withdrawal request." });
        }

        // Atomically update the user's bonus balance and check the updated balance
        const updatedAccount = await CharityUser.findOneAndUpdate(
            { _id: userId, balance: { $gte: withdrawalAmount } },
            { $inc: { balance: -withdrawalAmount } },
            { new: true, session }
        );

        if (!updatedAccount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Failed to deduct the withdrawal amount or insufficient bonus funds." });
        }

        // Record the Mobile Money withdrawal
        const newMobileMoneyWithdrawal = new MobileMoneyWithdrawal({
            withdrawalId,
            userId,
            firstName: firstName,
            amount: withdrawalAmount,
            currency: currency,
            phoneNumber,
            provider,
            status: 'pending'
        });
        await newMobileMoneyWithdrawal.save({ session });

        await session.commitTransaction();

        try {
            await sendMoneyToConsumer(phoneNumber, withdrawalAmount, userId); 
            // Handle success scenario, e.g., logging, sending confirmation to the user, etc.
        } catch (error) {
            // Handle failure in sending money, e.g., log for manual intervention, notify admins, etc.
            console.error("Failed to send money to consumer", error);
        }

            // Send withdrawal SMS notification to admin
    try {
        await sendAdminWithdrawalSMS(
          "254111200811",  // admin phone number
          withdrawalAmount,
          firstName,
          phoneNumber
        );
      } catch (error) {
        console.error('Failed to send withdrawal SMS to admin:', error);
      }

        // Create a notification for the user about the withdrawal request
        const notification = new Notification({
            user: userId,
            text: `Your Mobile Money withdrawal request of ${currency} ${withdrawalAmount} is being processed.`,
            type: 'Alert'
        });
        await notification.save({ session });

        // Prepare and send an email
        const emailVars = {
            amount: withdrawalAmount.toString(),
            beneficiaryName: firstName,
            phoneNumber: phoneNumber,
            provider: provider,
            withdrawalId: withdrawalId,
            currency: currency,
            bank: false,
            paypal: false,
            mobile: true
        };

        const emailTextContent = `Hello,

        Your request to withdraw ${currency} ${withdrawalAmount} to your Mobile Money account (${provider}, Phone: ${phoneNumber}) has been received and is being processed.
        
        Withdrawal ID: ${withdrawalId}
        
        Please allow 1-3 days for the funds to reflect in your account.
        
        If you have any questions or need further assistance, please contact our support team.
        
        Best Regards,
        Verdant Charity.`;

        await sendEmail({
            toEmail: userKyc.email,
            subject: `Mobile Money Withdrawal Request - ${withdrawalId}`,
            textContent: emailTextContent,
            htmlVariables: emailVars,
        });

        res.status(201).json({ message: "Mobile Money withdrawal request created successfully!", withdrawal: newMobileMoneyWithdrawal });
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ message: "Internal server error", error: error.message });
    } finally {
        session.endSession();
    }
};



const findParameterValue = (parameters, key) => {
    const param = parameters?.ResultParameter.find(item => item.Key === key);
    if (!param) {
      console.warn(`Warning: Parameter ${key} not found.`);
      return undefined;
    }
    return param.Value;
  };
  
  exports.confirmBonusWithdrawal = async (req, res) => {
    const safeParseFloat = (value) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? undefined : parsed;
    };
  
    try {
      const data = req.body.Result;
      const parameters = data.ResultParameters;
  
      if (!data) {
        throw new Error("Missing 'Result' in request body.");
      }
  
      const transaction = await ExpressWithdrawal.findOne({ conversation_id: data.ConversationID });
      if (!transaction) {
        console.error('No matching transaction found for conversation_id:', data.ConversationID);
        return res.status(404).send({ message: 'Transaction not found.' });
      }
  
  
      if (data.ResultCode === 0) {
        try {
          // Try updating withdrawals
          const matchingWithdrawal = await MobileMoneyWithdrawal.findOne({
            phoneNumber: transaction.phoneNumber,
            amount: transaction.amount,
            status: "pending"
          });
  
          if (matchingWithdrawal) {
            await MobileMoneyWithdrawal.updateOne({ _id: matchingWithdrawal._id }, { status: "completed" });
          } else {
            console.warn('No matching Withdrawal found for phone number and amount.');
          }
        } catch (withdrawalError) {
          console.error('Error updating withdrawal schema:', withdrawalError);
        }
      }
  
      try {
        // Try updating ExpressWithdrawal
        const convertToStandardDateFormat = (dateStr) => {
          if (!dateStr) {
            console.warn('Warning: Invalid date string.');
            return undefined;
          }
          const [day, month, year, ...time] = dateStr.split(/[\s.:]/);
          return `${year}-${month}-${day} ${time.join(':')}`;
        };
  
        const transactionDateStr = findParameterValue(parameters, 'TransactionCompletedDateTime');
        const transactionDate = transactionDateStr ? new Date(convertToStandardDateFormat(transactionDateStr)) : undefined;
  
        const fieldsToUpdate = {
          originator_conversation_id: data.OriginatorConversationID,
          response_code: req.body.ResponseCode,
          response_description: req.body.ResponseDescription,
          result_code: data.ResultCode,
          result_description: data.ResultDesc,
          transaction_id: data.TransactionID,
          transaction_amount: findParameterValue(parameters, 'TransactionAmount'),
          transaction_receipt: findParameterValue(parameters, 'TransactionReceipt'),
          recipient_registered: findParameterValue(parameters, 'B2CRecipientIsRegisteredCustomer') === 'Y',
          receiver_party_public_name: findParameterValue(parameters, 'ReceiverPartyPublicName'),
          transaction_completed_date_time: transactionDate,
          charges_paid_account_funds: safeParseFloat(findParameterValue(parameters, 'B2CChargesPaidAccountAvailableFunds')),
          utility_account_available_funds: safeParseFloat(findParameterValue(parameters, 'B2CUtilityAccountAvailableFunds')),
          working_account_available_funds: safeParseFloat(findParameterValue(parameters, 'B2CWorkingAccountAvailableFunds')),
        };
        const updateData = Object.fromEntries(Object.entries(fieldsToUpdate).filter(([, value]) => value !== undefined));
  
        await ExpressWithdrawal.findOneAndUpdate({ conversation_id: data.ConversationID }, updateData);
      } catch (expressWithdrawalError) {
        console.error('Error updating ExpressWithdrawal:', expressWithdrawalError);
      }
  
      console.info('Callback received and processed.');
    } catch (generalError) {
      console.error('Error handling callback:', generalError);
    }
  };
