// routes/impactRoutes.js

const express = require('express');
const router = express.Router();
const ImpactController = require('../controllers/ImpactController');
const authMiddleware = require('../middlewares/authMiddleware');
const optionalMiddleware = require('../middlewares/optionalMiddleware');


// Existing route for creating an impact
router.get('/:impactId/comments', optionalMiddleware, ImpactController.getCommentsForImpact);
router.post('/create', authMiddleware, ImpactController.createImpact);
router.patch('/:impactId/likes',authMiddleware, ImpactController.toggleLike);
router.post('/:impactId/comments', authMiddleware, ImpactController.createCommentForImpact);

// New route for getting all impacts
router.get('/', ImpactController.getImpacts);

module.exports = router;
