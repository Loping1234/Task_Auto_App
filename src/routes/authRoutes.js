const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const {
    login,
    forgotPassword,
    resetPassword,
    signup,
    verifyEmail,
    verify2FA,
    resendOtp,
    changePassword,
    getMe
} = require("../controllers/authController");

router.post("/login", login);
router.post("/verify-2fa", verify2FA);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/signup", signup);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOtp);
router.post("/change-password", verifyToken, changePassword);
router.get("/me", verifyToken, getMe);

module.exports = router;