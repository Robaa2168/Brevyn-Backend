// middlewares/optionalAuthMiddleware.js
const jwt = require('jsonwebtoken');

const optionalMiddleware = (req, res, next) => {
    // Extract token from the header and remove "Bearer" prefix if it exists
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    // Proceed without user if no token is found
    if (!token) {
        return next();
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.userId;
        next();
    } catch (err) {
        // In case of error, log it and continue without setting req.user
        console.error('Optional Auth Middleware Error:', err);
        next();
    }
};

module.exports = optionalMiddleware;
