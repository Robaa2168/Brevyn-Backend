// middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Extracting token from the header and removing "Bearer" prefix if it exists
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];


    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.userId;
        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            res.status(401).json({ message: 'Token has expired, please login again.' });
        } else if (err.name === "JsonWebTokenError") {
            res.status(401).json({ message: 'Token is invalid, please login with a valid token.' });
        } else if (err.name === "NotBeforeError") {
            res.status(401).json({ message: 'Token not active, please wait or login again.' });
        } else {
            res.status(401).json({ message: 'Failed to authenticate token.' });
        }
    }
};

module.exports = authMiddleware;
