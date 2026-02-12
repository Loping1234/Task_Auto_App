const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const collection = require("../config");
const Employee = require("../../models/employee");
const { generateToken } = require("../middleware/auth");

// Shared email transporter
function getTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: (process.env.EMAIL_USER || '').trim(),
            pass: (process.env.EMAIL_PASS || '').trim()
        }
    });
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await collection.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!user.isVerified) {
            return res.status(403).json({ message: "Email not verified. Please check your email for the verification link." });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({ message: "Invalid password" });
        }

        // Check if 2FA is enabled for this user
        if (user.twoFactorEnabled === false) {
            // 2FA is disabled, log in directly
            const token = generateToken(user);
            return res.json({
                require2FA: false,
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    role: user.role,
                    fullName: user.fullName || user.name || user.email.split('@')[0],
                    profilePicture: user.profilePicture,
                    twoFactorEnabled: user.twoFactorEnabled
                }
            });
        }

        // Generate 2FA OTP
        const loginOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const loginOtpExpires = Date.now() + 600000; // 10 minutes

        user.loginOtp = loginOtp;
        user.loginOtpExpires = loginOtpExpires;
        await user.save();

        // Send OTP via email
        const transporter = getTransporter();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your Login OTP (2FA)",
            text: `Your login verification code is: ${loginOtp}\n\nThis code will expire in 10 minutes.`
        };

        await transporter.sendMail(mailOptions);

        res.json({
            require2FA: true,
            message: "OTP sent to your email. Please verify to continue login.",
            email: user.email
        });
    } catch (err) {
        console.error("Login error", err);
        res.status(500).json({ message: "Login failed" });
    }
};

const verify2FA = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await collection.findOne({
            email,
            loginOtp: otp,
            loginOtpExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        // Clear OTP after successful verification
        user.loginOtp = undefined;
        user.loginOtpExpires = undefined;
        await user.save();

        const token = generateToken(user);

        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                fullName: user.fullName || user.name || user.email.split('@')[0],
                profilePicture: user.profilePicture,
                twoFactorEnabled: user.twoFactorEnabled !== false
            }
        });
    } catch (err) {
        console.error("2FA verification error", err);
        res.status(500).json({ message: "2FA verification failed" });
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

        const emailVerificationToken = crypto.randomBytes(32).toString("hex");
        const emailVerificationExpires = Date.now() + 24 * 3600000; // 24 hours

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

        const transporter = getTransporter();

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const verificationLink = `${frontendUrl}/verify-email?token=${emailVerificationToken}&email=${email}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Verify your email address",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Welcome to TaskFlow!</h2>
                    <p>Please click the button below to verify your email address and activate your account.</p>
                    <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Verify Email address</a>
                    <p>Or copy and paste this link in your browser:</p>
                    <p>${verificationLink}</p>
                    <p>This link will expire in 24 hours.</p>
                </div>
            `
        };
        await transporter.sendMail(mailOptions);
        res.status(201).json({ message: "Verification link sent to your email. Please click it to create your account." });
    } catch (err) {
        console.error("Signup error", err);
        res.status(500).json({ message: "Signup failed" });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { email, token } = req.body;
        const user = await collection.findOne({
            email,
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ message: "Invalid or expired verification link" });
        }
        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
        res.json({ message: "Account verified successfully!" });
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

        // This is now used for Login OTP resend or Signup verification link resend
        if (!user.isVerified) {
            // Resend Signup verification link
            const emailVerificationToken = crypto.randomBytes(32).toString("hex");
            user.emailVerificationToken = emailVerificationToken;
            user.emailVerificationExpires = Date.now() + 24 * 3600000;
            await user.save();

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const verificationLink = `${frontendUrl}/verify-email?token=${emailVerificationToken}&email=${email}`;
            const transporter = getTransporter();
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Verify your email address",
                html: `<p>Please click this link to verify: <a href="${verificationLink}">${verificationLink}</a></p>`
            });
            return res.json({ message: "Verification link resent successfully" });
        } else {
            // Resend Login OTP
            const loginOtp = Math.floor(100000 + Math.random() * 900000).toString();
            user.loginOtp = loginOtp;
            user.loginOtpExpires = Date.now() + 600000;
            await user.save();

            const transporter = getTransporter();
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Your Login OTP (2FA)",
                text: `Your login verification code is: ${loginOtp}`
            });
            return res.json({ message: "Login OTP resent successfully" });
        }
    } catch (err) {
        console.error("Resend error", err);
        res.status(500).json({ message: "Resend failed" });
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

        const transporter = getTransporter();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset",
            text: `You requested a password reset. Click the link to reset your password: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${token}`
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
    verify2FA,
    forgotPassword,
    resetPassword,
    signup,
    verifyEmail,
    resendOtp,
    changePassword,
    getMe
};
