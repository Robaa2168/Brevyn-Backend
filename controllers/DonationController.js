
// controllers/DonationController.js
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


exports.createDonationLink = async (req, res) => {
    const { title, targetAmount, description, image } = req.body;
    const userId = req.user;

    try {
        // Ensure all required fields are filled out
        if (!title.trim() || !targetAmount || !description.trim()) {
            return res.status(400).json({ message: "All fields are required for the donation link." });
        }
        // Validate that the user exists and is not banned
        const user = await CharityUser.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.isBanned) {
            return res.status(403).json({ message: "User is banned from creating donation links" });
        }

        // Sanitize and validate the targetAmount
        const sanitizedAmount = Number(targetAmount);
        if (isNaN(sanitizedAmount) || sanitizedAmount < 1000 || sanitizedAmount > 10000) {
            return res.status(400).json({ message: "Please provide a valid target amount between $1000 and $10000." });
        }

        // Check if the user already has an active donation link
        const existingActiveLink = await DonationLink.findOne({ user: userId, status: 'active' });
        if (existingActiveLink) {
            return res.status(400).json({ message: "User already has an active donation link" });
        }

        const imageData = image ? image : undefined; 
        // Proceed with creating a new DonationLink document
        const uniqueIdentifier = generateUniqueIdentifier();
        const newDonationLink = new DonationLink({
            user: userId,
            title: title.trim(),
            targetAmount: sanitizedAmount,
            description: description.trim(),
            uniqueIdentifier,
            image: imageData,
        });

        // Save the new donation link to the database
        await newDonationLink.save();

        // After saving the donation link, create a notification
        const newNotification = new Notification({
            user: userId,
            text: 'Donation link created successfully',
            type: 'Alert',
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



exports.getUserDonationLinks = async (req, res) => {
    const userId = req.user;

    try {
        const donationLinks = await DonationLink.find({ user: userId }).sort({ createdAt: -1 }); // Sort by most recent

        res.status(200).json(donationLinks);
    } catch (error) {
        console.error("Error fetching donation links: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


exports.getDonationLinkById = async (req, res) => {
    const linkId = req.params.id; // Get the ID from the route parameter

    try {
        // Find the donation link by ID
        const donationLink = await DonationLink.findById(linkId);

        if (!donationLink) {
            return res.status(404).json({ message: "Donation link not found" });
        }

        // Optionally, you can perform additional checks here, such as checking if the user has permission to view the link.

        res.status(200).json(donationLink);
    } catch (error) {
        console.error("Error fetching donation link data: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

exports.toggleDonationLinkStatus = async (req, res) => {
    const linkId = req.params.id;
    const userId = req.user;

    try {
        const donationLink = await DonationLink.findById(linkId);

        // Ensure the donation link exists and belongs to the user
        if (!donationLink) {
            return res.status(404).json({ message: "Donation link not found" });
        }

        if (donationLink.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to change this donation link" });
        }

        // Toggle the status
        donationLink.status = donationLink.status === 'active' ? 'inactive' : 'active';
        await donationLink.save();

        // Trigger notification
        const newNotification = new Notification({
            user: userId,
            text: `Donation link ${donationLink.status === 'active' ? 'activated' : 'deactivated'} successfully`,
            type: 'Alert', // or whatever type is appropriate
        });
        await newNotification.save();

        res.status(200).json({
            message: `Donation link ${donationLink.status === 'active' ? 'activated' : 'deactivated'} successfully`,
            status: donationLink.status,
        });

    } catch (error) {
        console.error("Error toggling donation link status: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



exports.editDonationLink = async (req, res) => {
    const linkId = req.params.id;
    const userId = req.user;
    const updateFields = req.body;

    try {
        const donationLink = await DonationLink.findById(linkId);

        if (!donationLink) {
            return res.status(404).json({ message: "Donation link not found" });
        }

        if (donationLink.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to edit this donation link" });
        }

        // Prepare the fields to be updated after checking for non-empty values and changes
        let fieldsToUpdate = {};
        for (let [key, value] of Object.entries(updateFields)) {
            let oldValue = donationLink[key];

            // Check if the new value is different and not empty
            if (value !== oldValue && value !== null && value !== undefined && value !== '') {
                fieldsToUpdate[key] = value;
            }
        }

        // Check if fieldsToUpdate is empty, meaning no valid changes were provided
        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ message: "No valid update fields provided or no changes detected." });
        }

        // Apply the updates to the existing document
        Object.assign(donationLink, fieldsToUpdate);

        // Save the updated donation link
        await donationLink.save();

        // Trigger notification
        const newNotification = new Notification({
            user: userId,
            text: 'Donation link updated successfully',
            type: 'Alert', // or whatever type is appropriate
        });
        await newNotification.save();

        res.status(200).json({
            message: "Donation link updated successfully",
            link: donationLink,
        });

    } catch (error) {
        console.error("Error editing donation link: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



exports.deleteDonationLink = async (req, res) => {
    const linkId = req.params.id;
    const userId = req.user;

    try {
        const donationLink = await DonationLink.findById(linkId);

        if (!donationLink) {
            return res.status(404).json({ message: "Donation link not found" });
        }

        if (donationLink.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Unauthorized to delete this donation link" });
        }

        await DonationLink.deleteOne({ _id: linkId });

        // Trigger notification
        const newNotification = new Notification({
            user: userId,
            text: 'Donation link deleted successfully',
            type: 'Alert', // or whatever type is appropriate
        });
        await newNotification.save();

        res.status(200).json({ message: "Donation link deleted successfully" });

    } catch (error) {
        console.error("Error deleting donation link: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
