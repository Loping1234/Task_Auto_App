// src/routes/userRoutes.js
const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { uploadProfilePicture, updateProfile, getAllUsers, toggle2FA } = require("../controllers/userController");

// Note: upload middleware is passed from api.js when mounting
module.exports = (upload) => {
    const router = express.Router();
    router.post("/profile-picture", verifyToken, upload.single('profilePicture'), uploadProfilePicture);
    router.put("/profile", verifyToken, updateProfile);
    router.get("/all", verifyToken, getAllUsers);
    router.put("/toggle2fa", verifyToken, toggle2FA);

    return router;
};
