// routes/donationRoutes.js
const express = require('express');
const router = express.Router();
const donationController = require('../controllers/DonationController');
const authMiddleware = require('../middlewares/authMiddleware');


router.post('/create-link', authMiddleware, donationController.createDonationLink);
router.get('/user-links', authMiddleware, donationController.getUserDonationLinks);
router.get('/donate/:uniqueIdentifier', donationController.getDonationLinkByUniqueIdentifier);
router.post('/donation-payment',authMiddleware, donationController.saveDonation);
router.get('/donation-link/:id', authMiddleware, donationController.getDonationLinkById);
router.patch('/toggle-status/:id', authMiddleware, donationController.toggleDonationLinkStatus);
router.patch('/edit-link/:id', authMiddleware, donationController.editDonationLink);
router.delete('/delete-link/:id', authMiddleware, donationController.deleteDonationLink);




// Export the router
module.exports = router;
