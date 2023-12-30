
// controllers/DonationController.js
const mongoose = require('mongoose');
const { startSession } = require('mongoose');
const Kyc = require('../models/Kyc');
const CharityUser = require('../models/CharityUser');
const DonationLink = require('../models/donationLink');
const Notification = require('../models/Notification');
const Donation = require('../models/donations');


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

        res.status(200).json(donationLink);
    } catch (error) {
        console.error("Error fetching donation link data: ", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

exports.getDonationLinkByUniqueIdentifier = async (req, res) => {
    const uniqueIdentifier = req.params.uniqueIdentifier;

    try {
        // Find the donation link by its unique identifier
        const donationLink = await DonationLink.findOne({ uniqueIdentifier });

        if (!donationLink) {
            return res.status(404).json({ message: 'Donation link not found' });
        }

        res.status(200).json(donationLink);
    } catch (error) {
        console.error('Error fetching donation link data: ', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
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




exports.saveDonation = async (req, res) => {
    const { uniqueIdentifier, amount, firstName, lastName, note, type } = req.body;
    const donorId = req.user;
  
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      if (!uniqueIdentifier || !amount || !firstName || !lastName || !type) {
        return res.status(400).json({ message: "All required fields must be provided" });
      }
  
      const numericAmount = parseFloat(amount.trim());
      if (isNaN(numericAmount) || numericAmount < 5) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Invalid or insufficient donation amount" });
      }
  
      const donor = await CharityUser.findById(donorId).session(session);
      const donationLink = await DonationLink.findOne({ uniqueIdentifier }).session(session);
  
      if (!donor || !donationLink || donor.isBanned || donationLink.user.isBanned || donationLink.status !== 'active' || donor.balance < numericAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Validation failed for donor or donation link" });
      }
  
      await CharityUser.findByIdAndUpdate(donorId, { $inc: { balance: -numericAmount } }, { session });
      const updatedDonationLink = await DonationLink.findByIdAndUpdate(donationLink._id, { $inc: { totalDonations: numericAmount } }, { session, new: true });
  
      if (updatedDonationLink.totalDonations >= updatedDonationLink.targetAmount) {
        await DonationLink.findByIdAndUpdate(updatedDonationLink._id, { status: 'completed' }, { session });
        
        const ownerNotification = new Notification({
          user: updatedDonationLink.user,
          text: `Your donation link has reached its target and is now marked as completed.`,
          type: 'Alert',
        });
        await ownerNotification.save();
      }
  
      const donation = new Donation({
        donor: donorId,
        donationLink: donationLink._id,
        amount: numericAmount,
        message: note,
        paymentStatus: 'completed',
        firstName: firstName,
        lastName: lastName,
        type: type
      });
      await donation.save();
  
      const donorNotification = new Notification({
        user: donorId,
        text: `Thank you ${firstName} ${lastName} for your generous donation of ${amount}!`,
        type: 'Alert',
      });
  
      const ownerNotification = new Notification({
        user: updatedDonationLink.user,
        text: `${firstName} ${lastName} has donated ${amount} to your cause!`,
        type: 'Alert',
      });
  
      await donorNotification.save();
      await ownerNotification.save();
  
      await session.commitTransaction();
      session.endSession();
  
      res.status(201).json({
        message: "Donation saved successfully",
        donation: donation
      });
    } catch (error) {
      console.error("Error saving donation: ", error);
      await session.abortTransaction();
      session.endSession();
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };

  exports.incrementViewCount = async (req, res) => {
    const { uniqueIdentifier } = req.params;
    const session = await startSession();
  
    try {
      session.startTransaction();
  
      const options = { session, new: true };
      const donationLink = await DonationLink.findOneAndUpdate(
        { uniqueIdentifier: uniqueIdentifier },
        { $inc: { views: 1 } },
        options
      );
  
      if (!donationLink) {
        // If no donation link found, abort transaction and return 404
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Donation link not found" });
      }
  
      // If everything is okay, commit the transaction
      await session.commitTransaction();
      session.endSession();
      
      // Respond with the updated view count
      res.status(200).json({ views: donationLink.views });
    } catch (error) {
      // If an error occurs, abort the transaction and log the error
      await session.abortTransaction();
      session.endSession();
      console.error('Error incrementing view count:', error);
      res.status(500).json({ message: "Internal server error", error });
    }
  };
  