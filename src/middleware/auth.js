const jwt = require('jsonwebtoken');
const collection = require('../config');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Verify JWT token middleware
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Get user from database
        const user = await collection.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = {
            id: user._id,
            email: user.email,
            role: user.role,
            fullName: user.fullName || user.name || user.email.split('@')[0],
            profilePicture: user.profilePicture
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Role-based authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        next();
    };
};

// Convenience middlewares
const isAdmin = authorize('admin');
const isSubadmin = authorize('subadmin');
const isEmployee = authorize('employee');
const isAdminOrSubadmin = authorize('admin', 'subadmin');

module.exports = {
    generateToken,
    verifyToken,
    authorize,
    isAdmin,
    isSubadmin,
    isEmployee,
    isAdminOrSubadmin,
    JWT_SECRET
};
