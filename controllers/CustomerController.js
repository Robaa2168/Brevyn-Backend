
// controllers/CustomerController.js
const mongoose = require('mongoose');
const Kyc = require('../models/Kyc');
const CharityUser = require('../models/CharityUser');
const DonationLink = require('../models/donationLink');
const Notification = require('../models/Notification');
const moment = require('moment');





const formatPhoneNumber = (phoneNumber) => {
    // Check for expected formats and modify accordingly
    if (phoneNumber.startsWith("+")) {
        return phoneNumber.slice(1); // remove the '+' prefix
    } else if (phoneNumber.startsWith("254")) {
        return phoneNumber; // format is already correct
    } else if (phoneNumber.startsWith("0")) {
        return `254${phoneNumber.slice(1)}`; // replace leading 0 with country code
    } else if (phoneNumber.startsWith("7") || phoneNumber.startsWith("1")) {
        return `254${phoneNumber}`; // add country code prefix
    } else {
        return phoneNumber;
    }
};

const isOver18 = (dob) => {
    const eighteenYearsAgo = moment().subtract(18, 'years');
    return moment(dob).isBefore(eighteenYearsAgo);
};

exports.saveKycData = async (req, res) => {
    let { firstName, lastName, phone, email, dob, idNumber, town, country } = req.body;
    const userId = req.user;

    if (!userId) {
        return res.status(401).json({ message: "Authentication failed. Please login again or provide a valid token." });
    }

    // Trim spaces
    firstName = firstName.trim();
    lastName = lastName.trim();
    phone = phone.replace(/\s+/g, '');
    email = email.replace(/\s+/g, '').trim();
    idNumber = idNumber.trim();
    town = town.trim();
    country = country.trim();

    // Format phone number
    phone = formatPhoneNumber(phone);

    // Check all KYC fields are provided
    if (!firstName || !lastName || !phone || !email || !dob || !idNumber || !town || !country) {
        return res.status(400).json({ message: "Please fill all the KYC fields." });
    }

    // Ensure DOB is not under 18
    if (!isOver18(dob)) {
        return res.status(400).json({ message: "You must be over 18 years of age." });
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

        // Check if the phone number already exists
        const phoneExists = await Kyc.findOne({ phone: phone });
        if (phoneExists) {
            return res.status(409).json({ message: "The phone number is already in use." });
        }

        // Check if the email already exists
        const emailExists = await Kyc.findOne({ email: email });
        if (emailExists) {
            return res.status(409).json({ message: "The email address is already in use." });
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

        await newNotification.save(); // Save the notification to the database

        res.status(201).json({ message: "KYC data saved successfully", primaryInfo: newKyc });
    } catch (error) {
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

exports.checkPhoneInUse = async (req, res) => {
    let { phone } = req.query;

    // Format the phone number before checking
    phone = formatPhoneNumber(phone);

    try {
        const existingUser = await Kyc.findOne({ phone });
        if (existingUser) {
            return res.status(200).json({ inUse: true });
        } else {
            return res.status(200).json({ inUse: false });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to perform the check", error: error.message });
    }
};


exports.checkEmailInUse = async (req, res) => {
    // Remove all spaces from the email, including middle spaces, then trim for any leading/trailing spaces
    const email = req.query.email;

    try {
        const existingUser = await Kyc.findOne({ email });
        if (existingUser) {
            return res.status(200).json({ inUse: true });
        } else {
            return res.status(200).json({ inUse: false });
        }
    } catch (error) {
        res.status(500).json({ message: "Failed to perform the check", error: error.message });
    }
};






exports.upgradeMembership = async (req, res) => {
    const userId = req.user;
    const costOfPremium = 50;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await CharityUser.findById(userId).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: "User not found." });
        }

        // Check if user has sufficient points
        if (user.points < costOfPremium) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "Insufficient points for membership upgrade." });
        }

        // Deduct points for premium membership using the $inc operator
        await CharityUser.findByIdAndUpdate(userId, { $inc: { points: -costOfPremium }, isPremium: true }, { session });

        // Create and save a notification for the user about the upgrade
        const upgradeNotification = new Notification({
            user: userId,
            text: 'Your membership has been upgraded to Premium!',
            type: 'Alert',
        });

        await upgradeNotification.save({ session });

        // Commit the transaction and end the session
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({ message: "Membership upgraded successfully!" });
    } catch (error) {
        console.error("Error upgrading membership: ", error);
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: "Failed to upgrade membership", error: error.message });
    }
};
