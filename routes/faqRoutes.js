//routes/faqRoutes.js

const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/faq', authMiddleware, faqController.postFaq);
router.get('/faq', faqController.getFaqs);
router.put('/faq/:id', authMiddleware, faqController.updateFaq);
router.get('/faq/:id', faqController.getFaqById);
router.delete('/faq/:id', authMiddleware, faqController.deleteFaq);

module.exports = router;
