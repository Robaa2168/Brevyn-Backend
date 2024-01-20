//controllers/AuthController.js
const CharityUser = require('../models/CharityUser');
const Kyc = require('../models/Kyc');
const Notification = require('../models/Notification');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');



async function sendEmail(recipientEmail, subject, greeting, message, code) {
  // Read the HTML file
  const templatePath = path.join(__dirname, '..', 'templates', 'codeTemplate.html');
  let htmlContent = fs.readFileSync(templatePath, 'utf8');

  // Replace placeholders with actual data
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


// The signupUser function handling user registration
exports.signupUser = async (req, res) => {
  // Check for the correct HTTP method
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Extracting user data from the request body
  const { email, phoneNumber, password } = req.body;

  // Ensure all required fields are provided
  if (!email || !phoneNumber || !password) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  // Format the phone number
  const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

  try {
    // Check if user already exists with the same email or phone number
    const existingUser = await CharityUser.findOne({
      $or: [{ email }, { phoneNumber: formattedPhoneNumber }]
    });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with the provided email or phone number.' });
    }

    // Hash the user's password for security
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique user data
    const username = generateRandomUsername();
    const referralCode = generateReferralCode();
    const uniqueId = generateUniqueId();
    const otp = generateOtp();

    // Create the new user instance
    const newUser = new CharityUser({
      email,
      phoneNumber: formattedPhoneNumber,
      password: hashedPassword,
      username,
      referralCode,
      uniqueId,
      otp,
    });

    // Save the new user to the database
    await newUser.save();

    // Respond with success message and user data (excluding sensitive data)
    return res.status(201).json({
      message: 'User created successfully!',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      }
    });
  } catch (error) {
    // Handle errors, such as database errors, and send an appropriate response
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};



exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

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
      return res.status(403).json({ message: 'Verification needed. Please check your email for the verification code.' });
    }

    // Fetch user's KYC data
    const kycData = await Kyc.findOne({ user: user._id });

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

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
      otp: user.otp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isPremium: user.isPremium,
      primaryInfo: kycData || null,
      token,
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
      text: 'Your account has been successfully verified.',
      type: 'Alert',
    });

    await newNotification.save();

    return res.status(200).json({ message: 'Account verified successfully' });
  } catch (error) {
    console.error('First time user verification error:', error);
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




// Function to resend the verification code
exports.resendVerificationCode = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await CharityUser.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }
    const newResetCode = generateOtp();
    user.otp = newResetCode;
    await user.save();

    // Prepare email content
    const subject = "Resend Verification Code";
    const greeting = "Hello,";
    const message = "You have requested to resend your verification code. Please use the following code:";

    // Send the new code via email
    await sendEmail(user.email, subject, greeting, message, newResetCode);

    return res.status(200).json({ message: 'A new verification code has been sent to your email' });
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
    const kycData = await Kyc.findOne({ user: userId });

    // Prepare user data for response, including all needed details
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
      otp: user.otp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isPremium: user.isPremium,
      primaryInfo: kycData || null,
    };

    // Respond with user data
    return res.status(200).json(userData);
  } catch (error) {
    console.error('Error fetching user data:', error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};