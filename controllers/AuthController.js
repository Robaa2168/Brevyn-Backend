//controllers/AuthController.js
const CharityUser = require('../models/CharityUser');
const Account = require("../models/Account");
const Kyc = require('../models/Kyc');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');
const useragent = require('express-useragent');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');



async function sendEmail(recipientEmail, subject, greeting, message, code) {
  const templatePath = path.join(__dirname, '..', 'templates', 'codeTemplate.html');
  let htmlContent = fs.readFileSync(templatePath, 'utf8');

  htmlContent = htmlContent.replace('{{greeting}}', greeting)
    .replace('{{message}}', message)
    .replace('{{code}}', code);

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
    from: '"VERDANT CHARITY" <support@verdantcharity.org>',
    to: recipientEmail,
    subject: subject,
    text: `${greeting}\n\n${message}\n\nCode: ${code}`,
    html: htmlContent,
  });

  console.log("Message sent: %s", info.messageId);
}



// Example function to send SMS
const sendSms = async (phoneNumber, message) => {
  const url = "https://sms.textsms.co.ke/api/services/sendsms/";
  const data = {
    apikey: 'a5fb51cb37deb6f3c38c0f45f737cc10',
    partnerID: 5357,
    message: message,
    shortcode: 'WINSOFT',
    mobile: phoneNumber
  };

  const options = {
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(data)
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return result; // You might want to handle the result based on your needs
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
};
// Utility functions to generate unique information for the user
// More adjectives for names
const adjectives = [
  'Adorable', 'Brave', 'Calm', 'Adventurous', 'Charming', 'Dazzling', 'Elegant', 'Fierce', 
  'Graceful', 'Heroic', 'Inventive', 'Joyful', 'Kind', 'Lively', 'Majestic', 'Noble', 
  'Optimistic', 'Proud', 'Quirky', 'Radiant', 'Serene', 'Thoughtful', 'Unique', 'Vibrant', 'Wise'
];

// More nouns for names
const nouns = [
  'Panda', 'Lion', 'Eagle', 'Unicorn', 'Dragon', 'Tiger', 'Phoenix', 'Dolphin', 
  'Wolf', 'Falcon', 'Bear', 'Fox', 'Hawk', 'Whale', 'Shark', 'Jaguar',
  'Leopard', 'Zebra', 'Elephant', 'Rabbit', 'Kangaroo', 'Koala', 'Squirrel', 'Owl'
];


function generateRandomUsername() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);

  return `${adj}${noun}${number}`;
}


function generateReferralCode() {
  return crypto.randomBytes(8).toString('hex');
}

function generateUniqueId() {
  return uuidv4();
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000);
}

const formatPhoneNumber = (phoneNumber) => {
  // Check for expected formats and modify accordingly
  if (phoneNumber.startsWith("+")) {
    return phoneNumber.slice(1); // remove the '+' prefix
  }
  else if (phoneNumber.startsWith("254")) {
    return phoneNumber;
  } else if (phoneNumber.startsWith("0")) {
    return `254${phoneNumber.slice(1)}`;
  } else if (phoneNumber.startsWith("7") || phoneNumber.startsWith("1")) {
    return `254${phoneNumber}`;
  } else {
    return phoneNumber;
  }
};


const createAccountWithRetry = async (userId, currency, retries = 3) => {
  try {
      const account = new Account({
          user: userId,
          currency: currency,
          isPrimary: currency === "USD",
          isActive: currency === "USD",
      });
      await account.save();
  } catch (error) {
      if (retries > 0) {
          console.log(`Retry ${currency} account creation for user ${userId}, attempts left: ${retries - 1}`);
          await createAccountWithRetry(userId, currency, retries - 1);
      } else {
          console.error(`Failed to create ${currency} account for user ${userId} after retries.`);
          throw error; // Propagate this error so it can be caught and handled in the calling function
      }
  }
};



// Function to create accounts for a user with retry logic and cleanup on failure
async function createAccountsForUser(userId) {
  const currencies = ["USD", "GBP", "AUD", "EUR", "KES"];

  for (const currency of currencies) {
      try {
          await createAccountWithRetry(userId, currency);
      } catch (error) {
          console.error(`Creating account for ${currency} failed: ${error}`);
          // Since account creation failed, delete any accounts that were created for this user
          await Account.deleteMany({ user: userId });
          throw new Error(`Failed to create accounts for user ${userId}. Cleanup initiated.`);
      }
  }
}


// The signupUser function handling user registration
exports.signupUser = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, phoneNumber, password } = req.body;

  if (!email || !phoneNumber || !password) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

  try {
    const existingUser = await CharityUser.findOne({
      $or: [{ email }, { phoneNumber: formattedPhoneNumber }]
    });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with the provided email or phone number.' });
    }


    const hashedPassword = await bcrypt.hash(password, 10);
    const username = generateRandomUsername();
    const referralCode = generateReferralCode();
    const uniqueId = generateUniqueId();
    const otp = generateOtp();
    const payId = generateOtp();

    const newUser = new CharityUser({
      email,
      phoneNumber: formattedPhoneNumber,
      password: hashedPassword,
      username,
      referralCode,
      uniqueId,
      otp,
      payId,
    });

    const savedUser = await newUser.save();

    try {
      await createAccountsForUser(savedUser._id);
    } catch (accountCreationError) {
      // Cleanup is handled within createAccountsForUser for failed account creations
      console.error('Cleanup after account creation failed:', accountCreationError);
      await CharityUser.findByIdAndDelete(savedUser._id); // User deletion as before
      return res.status(500).json({ message: 'Failed to create user accounts. User registration aborted.' });
    }

    return res.status(201).json({
      message: 'User created successfully!',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};



exports.loginUser = async (req, res) => {
  const { email, password, fingerprintId } = req.body;

      // Obtain the IP address from the request
      const ip = req.headers['x-forwarded-for']?.split(',').shift() || req.ip || req.connection.remoteAddress;
      const agentString = req.headers['user-agent'];
      const agent = useragent.parse(agentString);

  try {
    const user = await CharityUser.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

       // Generate JWT token
       const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const browserWithVersion = agent.browser + (agent.version ? ` ${agent.version}` : '');
    // Check if there is tracking info and if the fingerprint has changed
    const trackingInfoLength = user.trackingInfo.length;

    // Construct new tracking info object
    const newTrackingInfo = {
      fingerprintId: fingerprintId,
      userIp: ip,
      browser: browserWithVersion,
      os: agent.os.toString(),
      platform: agent.platform,
      device: agent.isMobile ? 'Mobile' : (agent.isTablet ? 'Tablet' : 'Desktop'),
    };
  
    if (trackingInfoLength === 0) {
      // If tracking info is empty, add the new tracking info
      user.trackingInfo.push(newTrackingInfo);
    } else if (user.trackingInfo[trackingInfoLength - 1].fingerprintId !== fingerprintId) {
      // If fingerprintId has changed, update the existing tracking info
      user.trackingInfo[trackingInfoLength - 1] = newTrackingInfo;
    }
  
    user.lastLogin = new Date();
  
    await user.save();


    // Check if user is verified
    if (!user.isVerified) {
      const newVerificationCode = generateOtp();
      user.otp = newVerificationCode;
      await user.save();

      // Prepare email content
      const subject = "Verification Needed";
      const greeting = "Hello,";
      const message = "Please verify your email to continue by entering the following code:";

      // Send the verification email
      await sendEmail(user.email, subject, greeting, message, newVerificationCode);

      // Inform the client that verification is needed
      return res.status(403).json({
        message: 'Verification needed. Please check your email for the verification code.',
        token: token
      });
    }

    // Check if phone is verified
if (!user.isPhoneVerified) {
  const newOtp = generateOtp();
  user.otp = newOtp;
  await user.save();

  // Send verification SMS
  const smsMessage = `Your verification code is: ${newOtp}`;
  await sendSms(user.phoneNumber, smsMessage);

  // Inform the client that phone verification is needed, including the unverified phone number in the response
  return res.status(403).json({
    message: 'Phone verification needed. Please check your messages for the verification code.',
    token: token,
    phoneNumber: user.phoneNumber // Include the phone number needing verification
  });
}

    // Fetch user's KYC data
    const kycData = await Kyc.findOne({ user: user._id });
    const accounts = await Account.find({ user: user._id }).lean();

 

    // Prepare user data, including all KYC data
    const userData = {
      _id: user._id,
      username: user.username,
      profileImage: user.profileImage,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
      isBanned: user.isBanned,
      isVerified: user.isVerified,
      points: user.points,
      balance: user.balance,
      payId: user.payId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isPremium: user.isPremium,
      primaryInfo: kycData || null,
      token,
      accounts
    };

    console.log(userData)
    // Send back token and user data to the client
    return res.status(200).json(userData);
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};




exports.changePassword = async (req, res) => {
  const userId = req.user;
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.trim() === '') {
    return res.status(400).json({ message: "New password must not be empty." });
  }

  try {
    const user = await CharityUser.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    const newNotification = new Notification({
      user: userId,
      text: 'Password changed successfully',
      type: 'Alert',
    });

    // Save the notification to the database
    await newNotification.save();

    return res.status(200).json({ message: "Password changed successfully!" });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


exports.verifyFirstTimeUser = async (req, res) => {
  const { email, verificationCode } = req.body;

  try {
    const user = await CharityUser.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if the provided verification code matches the one saved in the user's document
    if (!user || user.otp !== verificationCode) {
      return res.status(400).json({ message: 'Invalid or expired verification code.' });
    }

    user.isVerified = true;
    newCode = generateOtp();
    user.otp = newCode;
    await user.save();

    // After successful verification, create and save a notification
    const newNotification = new Notification({
      user: user._id,
      text: 'Your email has been successfully verified.',
      type: 'Alert',
    });

    await newNotification.save();

    return res.status(200).json({ message: 'Account verified successfully' });
  } catch (error) {
    console.error('First time user verification error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};



// Function to verify user's phone number
exports.verifyPhoneNumber = async (req, res) => {
  const { phoneNumber, verificationCode } = req.body;

  try {
    const user = await CharityUser.findOne({ phoneNumber });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if the provided verification code matches the one saved in the user's document
    if (user.otp !== verificationCode) {
      return res.status(400).json({ message: 'Invalid or expired verification code.' });
    }

    user.isPhoneVerified = true; // Mark the phone number as verified
    const newCode = generateOtp(); // Assuming you regenerate the OTP for security reasons
    user.otp = newCode; // Save the new OTP or clear the field as per your application logic
    await user.save();

    // After successful verification, create and save a notification (optional)
    const newNotification = new Notification({
      user: user._id,
      text: 'Your phone number has been successfully verified.',
      type: 'Alert',
    });

    await newNotification.save();

    return res.status(200).json({ message: 'Phone number verified successfully' });
  } catch (error) {
    console.error('Phone number verification error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};


exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await CharityUser.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Check if a reset code already exists and use it, otherwise generate a new one
    let resetCode = user.otp;
    if (!resetCode) {
      resetCode = generateOtp(); // Generate a secure token or code
      user.otp = resetCode;
      await user.save();
    }

    // Prepare email content
    const subject = "Verification Code";
    const greeting = "Dear user,";
    const message = "Please use the following code to proceed with resetting your password:";

    // Send the code via email
    await sendEmail(user.email, subject, greeting, message, resetCode);

    return res.status(200).json({ message: 'A verification code has been sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};


exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await CharityUser.findOne({ email });
    if (!user || user.otp !== code) { // Check if user exists and code matches
      return res.status(400).json({ message: 'Verification failed. Invalid code or email.' });
    }

    // Code is valid, generate and save new code for next time
    user.otp = generateOtp();
    await user.save();

    return res.status(200).json({ message: 'Verification successful', verified: true });
  } catch (error) {
    console.error('Verify code error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};


exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const user = await CharityUser.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // After successful password reset, create and save a notification
    const newNotification = new Notification({
      user: user._id,
      text: 'Password changed successfully',
      type: 'Alert',
    });

    // Save the notification to the database
    await newNotification.save();

    // Send a success response
    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};



// Function to change the phone number
exports.changePhoneNumber = async (req, res) => {
  const { oldPhone, newPhone } = req.body;

  // Validation: Check if newPhone is not empty and is valid
  if (!newPhone || newPhone.trim() === '') {
    return res.status(400).json({ message: 'The new phone number is required.' });
  }

  // Format the old and new phone numbers
  const formattedOldPhone = formatPhoneNumber(oldPhone);
  const formattedNewPhone = formatPhoneNumber(newPhone);

  try {
    // Check if the new phone number is already in use by another user
    const phoneInUse = await CharityUser.findOne({ phoneNumber: formattedNewPhone });
    if (phoneInUse) {
      return res.status(409).json({ message: 'The new phone number is already in use .' });
    }

    // Find the user based on the formatted old phone number
    const user = await CharityUser.findOne({ phoneNumber: formattedOldPhone });
    if (!user) {
      return res.status(404).json({ message: 'User not found with the specified old phone number.' });
    }

    // Update the user's phone number with the formatted new phone number
    user.phoneNumber = formattedNewPhone;
    user.otpResendAttempts = 0;
    user.otpNextResendTime = undefined;
    user.isPhoneVerified = false; // Optionally reset phone verification status

    // Generate a new OTP for phone verification and save it to the user
    const newVerificationCode = generateOtp();
    user.otp = newVerificationCode;

    await user.save();

    // Optionally, send a new OTP via SMS to the formatted new phone number
    const smsMessage = `Your new Verdant verification code is: ${newVerificationCode}`;
    await sendSms(formattedNewPhone, smsMessage);

    return res.status(200).json({
      message: 'Phone number changed successfully. A new verification code has been sent to the new phone number.'
    });
  } catch (error) {
    console.error('Change phone number error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};



// Function to resend the verification code
exports.resendVerificationCode = async (req, res) => {
  const { email, phoneNumber } = req.body;

  try {
    // Find the user based on email or phone number
    const userQuery = email ? { email } : { phoneNumber };
    const user = await CharityUser.findOne(userQuery);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the temporary ban period has elapsed
    if (user.otpNextResendTime && user.otpNextResendTime > new Date()) {
      const timeLeft = (user.otpNextResendTime.getTime() - new Date().getTime()) / 1000 / 60;
      return res.status(429).json({ message: `Too many attempts. Try again in ${Math.ceil(timeLeft)} minutes.` });
    } else if (user.otpNextResendTime && user.otpNextResendTime <= new Date()) {
      user.otpResendAttempts = 0;
      user.otpNextResendTime = undefined;
    }

    if (user.otpResendAttempts < 4) {
      user.otpResendAttempts += 1;
    } else {
      // Reset attempts and set next allowed resend time to 2 hours from now
      user.otpResendAttempts = 0;
      user.otpNextResendTime = new Date(new Date().getTime() + 2 * 60 * 60 * 1000);
      await user.save();
      return res.status(429).json({ message: 'Too many attempts. Please try again in 2 hours.' });
    }

    const newVerificationCode = generateOtp();
    user.otp = newVerificationCode;
    await user.save();

    if (email) {
      // Send the new code via email
      const emailSubject = "Resend Verification Code";
      const emailGreeting = "Hello,";
      const emailMessage = "You have requested to resend your verification code. Please use the following code:";
      await sendEmail(user.email, emailSubject, emailGreeting, emailMessage, newVerificationCode);
      return res.status(200).json({ message: 'A new verification code has been sent to your email.' });
    } else if (phoneNumber) {
      // Send the new code via SMS
      const smsMessage = `Your verification code is: ${newVerificationCode}`;
      await sendSms(user.phoneNumber, smsMessage);
      return res.status(200).json({ message: 'A new verification code has been sent to your phone.' });
    }
  } catch (error) {
    console.error('Resend verification code error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};



exports.getUserInfo = async (req, res) => {
  const userId = req.user; // Or req.userId depending on how your auth middleware works

  try {
    const user = await CharityUser.findById(userId).select('-password'); // Excluding password from the result
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch user's KYC data
   const accounts = await Account.find({ user: userId }).lean();


   // Prepare user data, including all KYC data
   const userData = {
     isBanned: user.isBanned,
     points: user.points,
     balance: user.balance,
     isVerified: user.isVerified,
     isPremium: user.isPremium,
     accounts
   };

    // Respond with user data
    return res.status(200).json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};