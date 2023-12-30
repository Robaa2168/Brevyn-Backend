
// controllers/CustomerController.js
const Kyc = require('../models/Kyc');
const CharityUser = require('../models/CharityUser');
const DonationLink = require('../models/donationLink');
const Notification = require('../models/Notification');





exports.saveKycData = async (req, res) => {
    const { firstName, lastName, phone, email, dob, idNumber, town, country } = req.body;
    const userId = req.user; 

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

        // After successful KYC save, create and save a notification
        const newNotification = new Notification({
            user: userId,
            text: 'KYC data saved successfully',
            type: 'Alert',
        });

        // Save the notification to the database
        await newNotification.save();

        // Send a success response
        res.status(201).json({ message: "KYC data saved successfully", primaryInfo: newKyc });
    } catch (error) {
        // Send an error response
        res.status(500).json({ message: "Failed to save KYC data", error: error.message });
    }
};


exports.editKycData = async (req, res) => {
    const updateFields = req.body;
    const userId = req.user;

    if (!userId) {
        return res.status(401).json({ message: "Authentication failed. Please login again or provide a valid token." });
    }

    try {
        const existingKyc = await Kyc.findOne({ user: userId });
        if (!existingKyc) {
            return res.status(404).json({ message: "KYC data not found for this user." });
        }

        // Prepare the fields to be updated after checking for non-empty values
        let fieldsToUpdate = {};
        for (let [key, value] of Object.entries(updateFields)) {
            let oldValue = existingKyc[key];

            // Check if the new value is different and not empty
            if (value !== oldValue && value !== null && value !== undefined && value !== '') {
                fieldsToUpdate[key] = value;
            }
        }

        // Check if fieldsToUpdate is empty, meaning no valid changes were provided
        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ message: "No valid update fields provided." });
        }

        // Apply the updates to the existing document
        Object.assign(existingKyc, fieldsToUpdate);

        // Save the updated KYC document
        await existingKyc.save();

        // After successful KYC update, create and save a notification
        const newNotification = new Notification({
            user: userId,
            text: 'KYC data updated successfully',
            type: 'Alert', // or whatever type is appropriate
        });

        // Save the notification to the database
        await newNotification.save();

        // Return success response with updated KYC data
        return res.status(200).json({ message: "KYC data updated successfully", primaryInfo: existingKyc });
    } catch (error) {
        // Send an error response
        res.status(500).json({ message: "Failed to update KYC data", error: error.message });
    }
};

