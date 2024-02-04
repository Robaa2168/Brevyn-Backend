//controllers/ConversionController.js
const mongoose = require('mongoose');
const CharityUser = require('../models/CharityUser');
const Account = require("../models/Account");
const Kyc = require('../models/Kyc');
const Conversion = require("../models/Conversion");
const Notification = require('../models/Notification');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');



async function sendConversionEmail(userEmail, firstName, fromCurrency, toCurrency, amount, convertedAmount, conversionRate, transactionId) {
    // Configure your transporter with actual credentials
    let transporter = nodemailer.createTransport({
        host: "mail.privateemail.com",
        port: 587,
        secure: false,
        auth: {
            user: 'support@verdantcharity.org',
            pass: 'Lahaja2168#',
        },
    });
  
    const emailTemplate = fs.readFileSync(path.join(__dirname, '..', 'templates', 'conversionTemplate.html'), "utf-8");

    const emailBody = emailTemplate
      .replace(/{{ firstName }}/g, firstName)
      .replace(/{{ fromCurrency }}/g, fromCurrency)
      .replace(/{{ toCurrency }}/g, toCurrency)
      .replace(/{{ amount }}/g, amount)
      .replace(/{{ convertedAmount }}/g, convertedAmount)
      .replace(/{{ conversionRate }}/g, conversionRate)
      .replace(/{{ transactionId }}/g, transactionId)
      .replace(/{{ currentYear }}/g, new Date().getFullYear());
  
    const mailOptions = {
      from: '"Verdant Charity" <support@verdantcharity.org',
      to: userEmail,
      subject: `Conversion Notification - ${transactionId}`,
      html: emailBody,
    };
  
    try {
      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully");
    } catch (error) {
      console.error("Error sending email:", error);
    }
  }


  async function sendConversionSMS(recipientPhoneNumber, fromCurrency, toCurrency, amount, convertedAmount) {
    const apiUrl = "https://sms.textsms.co.ke/api/services/sendsms/";
    const message = `Your currency conversion from ${fromCurrency} to ${toCurrency} was successful. Amount Converted: ${amount} ${fromCurrency}. Received: ${convertedAmount} ${toCurrency}.`;

    const data = {
        apikey: "a5fb51cb37deb6f3c38c0f45f737cc10",
        partnerID: 5357,
        message: message,
        shortcode: "WINSOFT",
        mobile: recipientPhoneNumber,
    };

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    };

    try {
        const response = await fetch(apiUrl, options);
        const result = await response.json();
        console.log("SMS sent successfully:", result);
        return result;
    } catch (error) {
        console.error("Error sending SMS:", error);
        throw error;
    }
}


const getConversionRate = (fromCurrency, toCurrency) => {
    // Define the conversion rates here
    const rates = {
      "USD": {
        "KES": 160.00,
        "GBP": 0.79,
        "AUD": 1.40,
        "CAD": 1.25,
        "EUR": 0.92,
      },
      "GBP": {
        "USD": 1.32,
        "KES": 202.05,
      },
      "KES": {
        "USD": 0.0062,
        "GBP": 0.0049,
      },
    };
  
    if (rates[fromCurrency] && rates[fromCurrency][toCurrency]) {
      return rates[fromCurrency][toCurrency];
    } else {
      return 1; // Fallback to 1:1 conversion rate
    }
  };

exports.performCurrencyConversion = async (req, res) => {
        const {fromCurrency, toCurrency, amount } = req.body;
        const userId = req.user;
        let session;
    
        try {
            session = await mongoose.startSession();
            session.startTransaction();
    
            const user = await CharityUser.findById(userId).session(session);
            if (!user) {
                return res.status(400).json({ message: 'User does not exist.' });
            }
            if (user.isBanned) {
                return res.status(400).json({ message: 'User is banned from performing transactions.' });
            }
            const userKyc = await Kyc.findOne({ user: userId }).session(session);
            if (!userKyc) {
                return res.status(400).json({ message: 'KYC information not found. Please complete your KYC.' });
            }
            const fromAccount = await Account.findOne({ user: userId, currency: fromCurrency }).session(session);
            if (!fromAccount) {
                return res.status(404).json({ message: `Source account for ${fromCurrency} not found.` });
            }
            if (!fromAccount.isActive) {
                return res.status(403).json({ message: `${fromCurrency} currency is inactive. Please activate it to be able to convert.` });
            }
            if (fromAccount.isHeld) {
                return res.status(403).json({ message: `${fromCurrency} currency is temporarily banned. Contact (support@verdantcharity.org) for assistance.` });
            }
    
            const toAccount = await Account.findOne({ user: userId, currency: toCurrency }).session(session);
            if (!toAccount) {
                return res.status(404).json({ message: `Destination account for ${toCurrency} not found.` });
            }
            if (!toAccount.isActive) {
                return res.status(403).json({ message: `${toCurrency} currency is inactive. Please activate it to be able to convert.` });
            }
            if (toAccount.isHeld) {
                return res.status(403).json({ message: `${toCurrency} currency is temporarily banned. Contact (support@verdantcharity.org) for assistance.` });
            }
    
            if (fromAccount.balance < amount) {
                return res.status(400).json({ message: 'Insufficient balance in the source account.' });
            }
    
            const conversionRate = getConversionRate(fromCurrency, toCurrency);
            const convertedAmount = Math.round(amount * conversionRate);
            const transactionId = `RDT${uuidv4().substring(0, 8).toUpperCase()}`;
    
            await Account.findByIdAndUpdate(fromAccount._id, { $inc: { balance: -amount } }, { session });
            await Account.findByIdAndUpdate(toAccount._id, { $inc: { balance: convertedAmount } }, { session });
    
            const conversionRecord = new Conversion({
                user: userId,
                fromCurrency,
                toCurrency,
                fromAmount: amount,
                toAmount: convertedAmount,
                firstName: userKyc.firstName,
                conversionRate,
                transactionId
            });
    
            await conversionRecord.save({ session });
    
            await session.commitTransaction();
    
            // Notification saving happens outside the transaction
            const notification = new Notification({
                user: userId,
                text: `Conversion from ${fromCurrency} to ${toCurrency} successful. Transaction ID: ${transactionId}.`,
                type: 'Alert'
            });
            await notification.save();
    
            try {
                // Asynchronously send email notification
                await sendConversionEmail(
                    user.email,
                    userKyc.firstName,
                    fromCurrency,
                    toCurrency,
                    amount,
                    convertedAmount,
                    conversionRate,
                    transactionId
                );
            } catch (error) {
                console.error("Email sending failed:", error);
            }
            
          
            return res.status(201).json({ message: 'Conversion successful', data: conversionRecord });
        } catch (error) {
            if (session) await session.abortTransaction();
            console.error('Conversion error:', error);
            return res.status(400).json({ message: 'Conversion failed. Please try again later.', error: error.message });
        } finally {
            if (session) session.endSession();
        }
    }



    exports.fetchUserConversions = async (req, res) => {
        const userId = req.user; // Assuming req.user is populated with the authenticated user's data
    
        try {
            // Find the conversions for the user, sort them by the createdAt field in descending order,
            // and limit the results to the last 5 conversions.
            const conversions = await Conversion.find({ user: userId })
                .sort({ createdAt: -1 }) // Sort by createdAt in descending order
                .limit(5); // Limit to the last 5 documents
    
            res.status(200).json(conversions);
        } catch (error) {
            console.error('Error fetching user conversions:', error);
            return res.status(500).json({ message: 'Failed to fetch conversions.', error: error.message });
        }
    };
    


exports.fetchConversionDetails = async (req, res) => {
    const { transactionId } = req.params; // Assuming the transaction ID is passed as a URL parameter
    const userId = req.user._id;

    try {
        const conversion = await Conversion.findOne({ transactionId: transactionId, user: userId });
        if (!conversion) {
            return res.status(404).json({ message: 'Conversion not found.' });
        }
        res.status(200).json(conversion);
    } catch (error) {
        console.error('Error fetching conversion details:', error);
        return res.status(500).json({ message: 'Failed to fetch conversion details.', error: error.message });
    }
};
