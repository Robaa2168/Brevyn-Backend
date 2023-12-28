
// controllers/CustomerController.js
const Kyc = require('../models/Kyc');
const CharityUser = require('../models/CharityUser');
const DonationLink = require('../models/donationLink');
const Notification = require('../models/Notification');


function generateUniqueIdentifier() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 11;
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }

    return result;
}


exports.saveKycData = async (req, res) => {
    const { firstName, lastName, phone, email, dob, idNumber, town, country } = req.body;
    const userId = req.user; // Assuming userID is stored in req.user by the authMiddleware

    if (!userId) {
        return res.status(401).json({ message: "Authentication failed. Please login again or provide a valid token." });
    }

    // Check all KYC fields are provided
    if (!firstName || !lastName || !phone || !email || !dob || !idNumber || !town || !country) {
        return res.status(400).json({ message: "Please fill all the KYC fields." });
    }

    try {
        // Check if user exists
        const existingUser = await CharityUser.findById(userId);
        if (!existingUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // Check if KYC already exists for the user
        const existingKyc = await Kyc.findOne({ user: userId });
        if (existingKyc) {
            return res.status(409).json({ message: "KYC data already submitted for this user." });
        }

        // Create a new KYC document
        const newKyc = new Kyc({
            user: userId,
            firstName,
            lastName,
            phone,
            email,
            dob,
            idNumber,
            town,
            country
        });

        // Save the KYC document to the database
        await newKyc.save();

        // Send a success response
        res.status(201).json({ message: "KYC data saved successfully", data: newKyc });
    } catch (error) {
        // Send an error response
        res.status(500).json({ message: "Failed to save KYC data", error: error.message });
    }
};



exports.createDonationLink = async (req, res) => {
    const { title, targetAmount, description } = req.body;
    const userId = req.user; 

    try {
        // Validate that the user exists and is not banned
        const user = await CharityUser.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isBanned) {
            return res.status(403).json({ message: "User is banned from creating donation links" });
        }

        // Check if the user already has an active donation link
        const existingActiveLink = await DonationLink.findOne({ user: userId, status: 'active' });
        if (existingActiveLink) {
            return res.status(400).json({ message: "User already has an active donation link" });
        }

          // Proceed with creating a new DonationLink document
          const uniqueIdentifier = generateUniqueIdentifier();
          const newDonationLink = new DonationLink({
              user: userId,
              title,
              targetAmount,
              description,
              uniqueIdentifier,
          });
  
          // Save the new donation link to the database
          await newDonationLink.save();
  
          // After saving the donation link, create a notification
          const newNotification = new Notification({
              user: userId,
              text: 'Donation link created successfully',
              type: 'Alert', // or whatever type is appropriate
          });
  
          // Save the notification to the database
          await newNotification.save();
  
          res.status(201).json({
              message: "Donation link created successfully",
              link: newDonationLink
          });
  
      } catch (error) {
          console.error("Error creating donation link: ", error);
          res.status(500).json({ message: "Internal server error", error: error.message });
      }
  };
