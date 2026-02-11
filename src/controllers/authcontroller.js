// src/controllers/authController.js
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const collection = require("../config");
const Employee = require("../../models/employee");
const { generateToken } = require("../middleware/auth");

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await collection.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!user.isVerified) {
            return res.status(403).json({ message: "Email not verified" });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ message: "Invalid password" });
        }

        const token = generateToken(user);

        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                fullName: user.fullName || user.name || user.email.split('@')[0],
                profilePicture: user.profilePicture
            }
        });
    } catch (err) {
        console.error("Login error", err);
        res.status(500).json({ message: "Login failed" });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await collection.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const token = crypto.randomBytes(20).toString("hex");
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset",
            text: `You requested a password reset. Click the link to reset your password: http://localhost:5173/reset-password/${token}`
        };
        await transporter.sendMail(mailOptions);
        res.json({ message: "Password reset link sent" });
    } catch (err) {
        console.error("Forgot password error", err);
        res.status(500).json({ message: "Forgot password failed" });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const user = await collection.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.json({ message: "Password reset successful" });
    } catch (err) {
        console.error("Reset password error", err);
        res.status(500).json({ message: "Reset password failed" });
    }
};

const signup = async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingUser = await collection.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const domain = email.split("@")[1];
        let role = "employee";
        if (email === "pranaykumar302@gmail.com") {
            role = "admin";
        } else if (email === "pranaykumar1029@gmail.com" || email === "lopingcucumber@gmail.com") {
            role = "subadmin";
        } else if (domain === "gmail.com") {
            role = "employee";
        } else {
            if (domain === "admin.com") role = "admin";
            else if (domain === "subadmin.com") role = "subadmin";
        }
        const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const emailVerificationExpires = Date.now() + 3600000;
        const user = await collection.create({
            email,
            password: hashedPassword,
            role,
            emailVerificationToken,
            emailVerificationExpires,
            isVerified: false,
            fullName: email.split("@")[0],
            profilePicture: "default-avatar.png"
        });

        if (role === "employee") {
            await Employee.create({
                name: email.split("@")[0],
                email,
                password: hashedPassword
            });
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Verify your email address",
            text: `Your verification code is: ${emailVerificationToken}\n\nThis code will expire in 1 hour.`
        };
        await transporter.sendMail(mailOptions);
        res.status(201).json({ message: "Signup successful" });
    } catch (err) {
        console.error("Signup error", err);
        res.status(500).json({ message: "Signup failed" });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await collection.findOne({
            email,
            emailVerificationToken: otp,
            emailVerificationExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }
        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
        res.json({ message: "Email verified successfully! Redirecting to login..." });
    } catch (err) {
        console.error("Verify email error", err);
        res.status(500).json({ message: "Verify email failed" });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await collection.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }
        if (user.isVerified) {
            return res.status(400).json({ message: "Account already verified" });
        }
        const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();
        const emailVerificationExpires = Date.now() + 3600000;
        user.emailVerificationToken = emailVerificationToken;
        user.emailVerificationExpires = emailVerificationExpires;
        await user.save();
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Verify your email address",
            text: `Your verification code is: ${emailVerificationToken}\n\nThis code will expire in 1 hour.`
        };
        await transporter.sendMail(mailOptions);
        res.json({ message: "Email verification code resent successfully" });
    } catch (err) {
        console.error("Resend OTP error", err);
        res.status(500).json({ message: "Resend OTP failed" });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        const user = await collection.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect current password" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        if (user.role === 'employee') {
            await Employee.findOneAndUpdate({ email: user.email }, { password: hashedPassword });
        }

        res.json({ message: "Password changed successfully" });
    } catch (err) {
        console.error("Change password error", err);
        res.status(500).json({ message: "Failed to change password" });
    }
};

const getMe = async (req, res) => {
    res.json({ user: req.user });
};

module.exports = {
    login,
    forgotPassword,
    resetPassword,
    signup,
    verifyEmail,
    resendOtp,
    changePassword,
    getMe
};
