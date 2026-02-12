// src/controllers/userController.js
const collection = require("../config");
const Employee = require("../../models/employee");

const uploadProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image uploaded" });
        }

        const userId = req.user.id;
        const profilePicture = req.file.location; // S3 URL

        await collection.findByIdAndUpdate(userId, { profilePicture });

        const user = await collection.findById(userId);
        if (user.role === 'employee') {
            await Employee.findOneAndUpdate({ email: user.email }, { profilePicture });
        }

        res.json({ message: "Profile picture updated", profilePicture });
    } catch (err) {
        console.error("Profile picture upload error", err);
        res.status(500).json({ message: "Failed to upload profile picture" });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { fullName } = req.body;

        const user = await collection.findByIdAndUpdate(
            userId,
            { fullName },
            { new: true }
        ).select("-password -__v");

        if (user.role === 'employee') {
            await Employee.findOneAndUpdate({ email: user.email }, { name: fullName });
        }

        res.json({ user, message: "Profile updated successfully" });
    } catch (err) {
        console.error("Update profile error", err);
        res.status(500).json({ message: "Failed to update profile" });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await collection.find({}, { password: 0 }).lean();
        res.json({
            users: users.map(u => ({
                _id: u._id,
                email: u.email,
                name: u.fullName || u.name || u.email.split('@')[0],
                fullName: u.fullName || u.name || u.email.split('@')[0],
                role: u.role,
                profilePicture: u.profilePicture
            }))
        });
    } catch (err) {
        console.error("Get all users error", err);
        res.status(500).json({ message: "Error loading users" });
    }
};

const toggle2FA = async (req, res) => {
    try {
        const userId = req.user.id;
        const { enabled } = req.body;

        const user = await collection.findByIdAndUpdate(
            userId,
            { twoFactorEnabled: enabled },
            { new: true }
        ).select("-password -__v");

        res.json({
            message: enabled ? "Two-Factor Authentication enabled" : "Two-Factor Authentication disabled",
            twoFactorEnabled: user.twoFactorEnabled
        });
    } catch (err) {
        console.error("Toggle 2FA error", err);
        res.status(500).json({ message: "Failed to update 2FA setting" });
    }
};

module.exports = {
    uploadProfilePicture,
    updateProfile,
    getAllUsers,
    toggle2FA
};
