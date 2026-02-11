// src/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { uploadProfilePicture, updateProfile, getAllUsers } = require("../controllers/userController");

// Note: upload middleware is passed from api.js when mounting
module.exports = (upload) => {
    router.post("/profile-picture", verifyToken, upload.single('profilePicture'), uploadProfilePicture);
    router.put("/profile", verifyToken, updateProfile);
    router.get("/all", verifyToken, getAllUsers);

    return router;
};
