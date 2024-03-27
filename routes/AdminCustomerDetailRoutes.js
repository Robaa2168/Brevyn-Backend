// adminCustomerDetailRoutes.js

const express = require('express');
const router = express.Router();
const adminCustomerDetailController = require('../controllers/AdminCustomerDetailController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/user/:userId', authMiddleware, adminCustomerDetailController.getUserDetails);
router.get('/kyc/:userId', authMiddleware, adminCustomerDetailController.getUserKyc);
router.get('/conversions/:userId', authMiddleware, adminCustomerDetailController.getUserConversions);
router.get('/:userId/deposits', authMiddleware, adminCustomerDetailController.getUserDeposits);
router.get('/:userId/withdrawals', authMiddleware, adminCustomerDetailController.getUserWithdrawals);
router.get('/:userId/transactions', authMiddleware, adminCustomerDetailController.getUserTransactions);
router.put('/kyc/:userId', authMiddleware, adminCustomerDetailController.updateUserKyc);
router.put('/user/:userId', authMiddleware, adminCustomerDetailController.updateUserDetails);
router.get('/pending-withdrawals', authMiddleware, adminCustomerDetailController.getAllPendingWithdrawals);


// GET associated accounts for a user
router.get('/:userId/associated-accounts', authMiddleware, adminCustomerDetailController.getAssociatedAccounts);

// GET accounts for a user
router.get('/:userId/accounts', authMiddleware, adminCustomerDetailController.getUserAccounts);
// PATCH to toggle held status of an account
router.patch('/account/:accountId/toggle-held', authMiddleware, adminCustomerDetailController.toggleHeldStatus);
// PATCH to toggle active state of an account
router.patch('/account/:accountId/toggle-active', authMiddleware, adminCustomerDetailController.toggleActiveState);
// PATCH to update the balance of an account
router.patch('/account/:accountId/update-balance', authMiddleware, adminCustomerDetailController.updateAccountBalance);

router.delete('/:userId/withdrawals/:_id', authMiddleware, adminCustomerDetailController.deleteUserWithdrawal);



module.exports = router;
