require('dotenv').config();
const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const mongoose = require("mongoose");
const collection = require("./config");
const Task = require("../models/task");
const Team = require("../models/team");
const Employee = require("../models/employee");
const TeamMessage = require("../models/teamMessage");
const AdminSubadminMessage = require("../models/adminSubadminMessage");
const Notification = require("../models/notification");
const Watchlist = require("../models/watchlist");
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { generateToken, verifyToken, isAdmin, isAdminOrSubadmin } = require('./middleware/auth');

const app = express();

// CORS configuration for React frontend
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Image upload setup
const imgsDir = path.join(__dirname, '../imgs');
if (!fs.existsSync(imgsDir)) {
    fs.mkdirSync(imgsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, imgsDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Serve static images
app.use('/imgs', express.static(imgsDir));

// ==========================================
// AUTH ROUTES
// ==========================================

// Login
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await collection.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!user.isVerified) {
            return res.status(401).json({ message: "Email not verified" });
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
});

app.post("/api/auth/forgot-password", async (req, res) => {
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
            service: "gmail" || "techbizsolutions",
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
});

app.post("/api/auth/reset-password", async (req, res) => {
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
});

// Signup
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { email, password } = req.body;
        const existingUser = await collection.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const domain = email.split("@")[1];
        let role = "employee";
        // Predefined role mapping
        if (email === "pranaykumar@techbizsolution.co.in") {
            role = "admin";
        } else if (email === "pranaykumar302@gmail.com") {
            role = "subadmin";
        } else if (domain === "gmail.com") {
            role = "employee";
        } else {
            // Default domain-based assignment
            if (domain === "admin.com") role = "admin";
            else if (domain === "subadmin.com") role = "subadmin";
        }
        const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const emailVerificationExpires = Date.now() + 3600000; // 1 hour
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

        // Create employee record if employee role
        if (role === "employee") {
            await Employee.create({
                name: email.split("@")[0],
                email,
                password: hashedPassword
            });
        }

        const transporter = nodemailer.createTransport({
            service: "gmail" || "techbizsolutions",
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
});

// Verify email with OTP
app.post("/api/auth/verify-email", async (req, res) => {
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
});

app.post("/api/auth/resend-otp", async (req, res) => {
    try {
        const { email } = req.body;
        const user = await collection.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }
        if (user.isVerified) {
            return res.status(400).json({ message: "Account already verified" });
        }
        const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const emailVerificationExpires = Date.now() + 3600000; // 1 hour
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
    }
    catch (err) {
        console.error("Resend OTP error", err);
        res.status(500).json({ message: "Resend OTP failed" });
    }
});

// Upload Profile Picture
app.post("/api/users/profile-picture", verifyToken, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image uploaded" });
        }

        const userId = req.user.id;
        const profilePicture = req.file.filename;

        await collection.findByIdAndUpdate(userId, { profilePicture });

        // Update employee record if exists
        const user = await collection.findById(userId);
        if (user.role === 'employee') {
            await Employee.findOneAndUpdate({ email: user.email }, { profilePicture });
        }

        res.json({ message: "Profile picture updated", profilePicture });
    } catch (err) {
        console.error("Profile picture upload error", err);
        res.status(500).json({ message: "Failed to upload profile picture" });
    }
});

// Update Profile
app.put("/api/users/profile", verifyToken, async (req, res) => {
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
});

// Change Password
app.post("/api/auth/change-password", verifyToken, async (req, res) => {
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
});

// Get current user
app.get("/api/auth/me", verifyToken, async (req, res) => {
    res.json({ user: req.user });
});

// ==========================================
// DASHBOARD ROUTES
// ==========================================

app.get("/api/dashboard", verifyToken, async (req, res) => {
    try {
        const { role, email } = req.user;

        if (role === "admin") {
            const [subadmins, employees, tasks, teams] = await Promise.all([
                collection.countDocuments({ role: "subadmin" }),
                collection.countDocuments({ role: "employee" }),
                Task.countDocuments(),
                Team.countDocuments()
            ]);

            return res.json({
                subadminCount: subadmins,
                empCount: employees,
                taskCount: tasks,
                teamCount: teams
            });
        }

        if (role === "subadmin") {
            const teams = await Team.find({ subadminEmail: email });
            const employeeEmails = [...new Set(teams.flatMap(t => t.employees))];

            const [empCount, taskCount] = await Promise.all([
                collection.countDocuments({ email: { $in: employeeEmails } }),
                Task.countDocuments({
                    $or: [
                        { assigneeEmail: { $in: employeeEmails } },
                        { assignedBy: { $ne: email } },
                        { teamName: { $in: teams.map(t => t.teamName) } }
                    ]
                })
            ]);

            return res.json({
                empCount,
                taskCount,
                teams: teams.map(t => t.teamName)
            });
        }

        if (role === "employee") {
            const employee = await Employee.findOne({ email });
            const employeeTeams = employee?.teams || [];

            const [individualTasks, teamTasks] = await Promise.all([
                Task.countDocuments({ assigneeEmail: email }),
                employeeTeams.length > 0
                    ? Task.countDocuments({ teamName: { $in: employeeTeams }, assigneeEmail: { $ne: email } })
                    : 0
            ]);

            return res.json({
                individualTaskCount: individualTasks,
                teamTaskCount: teamTasks,
                teams: employeeTeams
            });
        }

        res.status(403).json({ message: "Unauthorized role" });
    } catch (err) {
        console.error("Dashboard error", err);
        res.status(500).json({ message: "Error loading dashboard" });
    }
});


// ==========================================
// TASKS ROUTES
// ==========================================

// Get all tasks
app.get("/api/tasks", verifyToken, async (req, res) => {
    try {
        const { role, email } = req.user;
        let query = {};

        if (role === "subadmin") {
            const teams = await Team.find({ subadminEmail: email });
            const employeeEmails = [...new Set(teams.flatMap(t => t.employees))];
            query = {
                $or: [
                    { assigneeEmail: { $in: employeeEmails } },
                    { teamName: { $in: teams.map(t => t.teamName) } }
                ]
            };
        } else if (role === "employee") {
            const employee = await Employee.findOne({ email });
            const teams = employee?.teams || [];
            query = {
                $or: [
                    { assigneeEmail: email },
                    ...(teams.length > 0 ? [{ teamName: { $in: teams } }] : [])
                ]
            };
        }
        // Admin gets all tasks (empty query)

        const tasks = await Task.find(query).sort({ createdAt: -1 });
        res.json({ tasks });
    } catch (err) {
        console.error("Get tasks error", err);
        res.status(500).json({ message: "Error loading tasks" });
    }
});

// Create task
app.post("/api/tasks", verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { title, description, startDate, endDate, status, assigneeEmail, teamName } = req.body;
        const { role } = req.user;

        // If employee, validate they are assigning to themselves or their team
        if (role === 'employee') {
            // Optional: Add validation logic here to prevent assigning to random people
            // For now, we allow the "on the spot" creation as requested
        }

        if (!title || (!assigneeEmail && !teamName)) {
            return res.status(400).json({ message: "Title and either an assignee or team are required" });
        }

        const taskData = {
            title,
            description,
            image: req.file ? req.file.filename : null,
            imageContentType: req.file ? req.file.mimetype : null,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            status: status || "Pending",
            assigneeEmail: assigneeEmail || null,
            teamName: teamName || null,
            assignedBy: req.user.fullName || req.user.email
        };

        const task = await Task.create(taskData);

        // Send Notification if assigned to someone
        if (assigneeEmail) {
            try {
                console.log(`[NOTIFICATION DEBUG] Attempting to create notification for: ${assigneeEmail}`);
                const assignee = await collection.findOne({ email: assigneeEmail });
                console.log(`[NOTIFICATION DEBUG] Assignee found:`, assignee ? `Yes (ID: ${assignee._id})` : 'No');
                console.log(`[NOTIFICATION DEBUG] Creator ID: ${req.user.id}`);

                if (!assignee) {
                    console.log(`[NOTIFICATION DEBUG] SKIP: Assignee not found in database`);
                } else if (assignee._id.toString() === req.user.id) {
                    console.log(`[NOTIFICATION DEBUG] SKIP: Self-assignment (creator = assignee)`);
                } else {
                    console.log(`[NOTIFICATION DEBUG] Creating notification...`);
                    const notification = await Notification.create({
                        recipient: assignee._id,
                        sender: req.user.id,
                        task: task._id,
                        message: `You have been assigned a new task: "${title}" by ${req.user.email}`,
                        type: 'assignment',
                        priority: 'primary',
                        category: 'assignment'
                    });
                    console.log(`[NOTIFICATION DEBUG] SUCCESS: Notification created with ID: ${notification._id}`);
                }
            } catch (notifErr) {
                console.error("[NOTIFICATION DEBUG] ERROR:", notifErr);
            }
        } else {
            console.log(`[NOTIFICATION DEBUG] SKIP: No assigneeEmail provided`);
        }

        res.status(201).json({ task, message: "Task created successfully" });
    } catch (err) {
        console.error("Create task error", err);
        res.status(500).json({ message: "Failed to create task" });
    }
});

// Update task assignee
app.patch("/api/tasks/:id/assignee", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { assignee } = req.body;

        const task = await Task.findByIdAndUpdate(
            id,
            { assigneeEmail: assignee },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json(task);
    } catch (err) {
        console.error("Update assignee error:", err);
        res.status(500).json({ message: "Failed to update assignee" });
    }
});

// Get team tasks (Moved before :id route to prevent conflict)
app.get("/api/tasks/team-tasks", verifyToken, async (req, res) => {
    try {
        const { email, role } = req.user;

        if (role !== "employee") {
            return res.status(403).json({ message: "Only employees can access team tasks" });
        }

        const employee = await Employee.findOne({ email });
        const teams = employee?.teams || [];

        if (teams.length === 0) {
            return res.json({ tasks: [], teams: [] });
        }

        // Get tasks assigned to team members (excluding current user)
        const tasks = await Task.find({
            $or: [
                { teamName: { $in: teams } },
                { assigneeEmail: { $in: await getTeammateEmails(teams, email) } }
            ],
            assigneeEmail: { $ne: email }
        }).sort({ createdAt: -1 });

        res.json({ tasks, teams });
    } catch (err) {
        console.error("Get team tasks error", err);
        res.status(500).json({ message: "Error loading team tasks" });
    }
});

// Get single task
app.get("/api/tasks/:id", verifyToken, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        res.json({ task });
    } catch (err) {
        console.error("Get task error", err);
        res.status(500).json({ message: "Error loading task" });
    }
});

// Update task
app.put("/api/tasks/:id", verifyToken, isAdminOrSubadmin, upload.single('image'), async (req, res) => {
    try {
        const { title, description, startDate, endDate, status, assigneeEmail, teamName } = req.body;

        const updateData = {
            title,
            description,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            status,
            assigneeEmail,
            teamName
        };

        if (req.file) {
            updateData.image = req.file.filename;
            updateData.imageContentType = req.file.mimetype;
        }

        const task = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Send Task Edit Notifications
        try {
            const notifications = [];

            // Primary: Notify assignee
            if (task.assigneeEmail) {
                const assignee = await collection.findOne({ email: task.assigneeEmail });
                if (assignee && assignee._id.toString() !== req.user.id) {
                    notifications.push({
                        recipient: assignee._id,
                        sender: req.user.id,
                        task: task._id,
                        message: `Your task "${task.title}" was updated by ${req.user.email}`,
                        type: 'task_edit',
                        priority: 'primary',
                        category: 'task_edit',
                        metadata: { teamName: task.teamName }
                    });
                }
            }

            // Secondary: Notify team members (if task has a team)
            if (task.teamName) {
                const team = await Team.findOne({ teamName: task.teamName });
                if (team) {
                    const teammateEmails = team.employees.filter(e =>
                        e !== task.assigneeEmail && e !== req.user.email
                    );

                    for (const email of teammateEmails) {
                        const teammate = await collection.findOne({ email });
                        if (teammate) {
                            notifications.push({
                                recipient: teammate._id,
                                sender: req.user.id,
                                task: task._id,
                                message: `Task "${task.title}" (${task.assigneeEmail}) was updated`,
                                type: 'task_edit',
                                priority: 'secondary',
                                category: 'task_edit',
                                metadata: { teamName: task.teamName, affectedUser: task.assigneeEmail }
                            });
                        }
                    }
                }
            }

            if (notifications.length > 0) {
                await Notification.insertMany(notifications);
            }
        } catch (notifErr) {
            console.error("[TASK EDIT NOTIFICATION ERROR]", notifErr);
        }

        res.json({ task, message: "Task updated successfully" });
    } catch (err) {
        console.error("Update task error", err);
        res.status(500).json({ message: "Failed to update task" });
    }
});

// Update task status only
app.patch("/api/tasks/:id/status", verifyToken, async (req, res) => {
    try {
        const { status } = req.body;

        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const oldStatus = task.status;
        task.status = status;

        if (oldStatus !== status) {
            task.activityLog.push({
                field: "Status",
                oldValue: oldStatus,
                newValue: status,
                changedBy: req.user.email
            });

            // Send Notification if updated by Employee
            if (req.user.role === 'employee') {
                try {
                    const recipients = new Set();

                    // 1. If Team Task, find Subadmin
                    if (task.teamName) {
                        const team = await Team.findOne({ teamName: task.teamName });
                        if (team && team.subadminEmail) {
                            const subadmin = await collection.findOne({ email: team.subadminEmail });
                            if (subadmin) recipients.add(subadmin._id.toString());
                        }
                    }

                    // 2. Notify Admins
                    const admins = await collection.find({ role: 'admin' });
                    admins.forEach(a => recipients.add(a._id.toString()));

                    // Create Notifications
                    await Promise.all(Array.from(recipients).map(recipientId =>
                        Notification.create({
                            recipient: recipientId,
                            sender: req.user.id,
                            task: task._id,
                            message: `Task "${task.title}" status updated to ${status} by ${req.user.email}`,
                            type: 'status_change'
                        })
                    ));
                } catch (notifErr) {
                    console.error("Notification creation failed", notifErr);
                }
            }
        }

        await task.save();
        res.json({ success: true, task });
    } catch (err) {
        console.error("Update status error", err);
        res.status(500).json({ message: "Failed to update status" });
    }
});

// Delete task
app.delete("/api/tasks/:id", verifyToken, isAdminOrSubadmin, async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        res.json({ message: "Task deleted successfully" });
    } catch (err) {
        console.error("Delete task error", err);
        res.status(500).json({ message: "Failed to delete task" });
    }
});

// Add comment to task
app.post("/api/tasks/:id/comments", verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { text } = req.body;

        const comment = {
            text,
            author: req.user.email,
            image: req.file ? req.file.filename : null
        };

        const task = await Task.findByIdAndUpdate(
            req.params.id,
            { $push: { comments: comment } },
            { new: true }
        );

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json({ task, message: "Comment added successfully" });
    } catch (err) {
        console.error("Add comment error", err);
        res.status(500).json({ message: "Failed to add comment" });
    }
});

// ==========================================
// EMPLOYEES ROUTES
// ==========================================

app.get("/api/employees", verifyToken, async (req, res) => {
    try {
        const { role, email } = req.user;
        let query = { role: "employee" };

        if (role === "subadmin") {
            const teams = await Team.find({ subadminEmail: email });
            const employeeEmails = [...new Set(teams.flatMap(t => t.employees))];
            query = { email: { $in: employeeEmails } };
        } else if (role === "employee") {
            const employee = await Employee.findOne({ email });
            const teams = employee?.teams || [];
            // Find teammates
            const teammateTeams = await Team.find({ teamName: { $in: teams } });
            const allEmails = [...new Set(teammateTeams.flatMap(t => t.employees))];
            query = { email: { $in: allEmails } }; // Can see themselves and teammates
        }

        const employees = await collection.find(query);

        // Get additional employee details
        const employeeDetails = await Promise.all(
            employees.map(async (emp) => {
                const empModel = await Employee.findOne({ email: emp.email });
                return {
                    _id: emp._id,
                    email: emp.email,
                    name: empModel?.name || emp.email.split("@")[0],
                    teams: empModel?.teams || []
                };
            })
        );

        res.json({ employees: employeeDetails });
    } catch (err) {
        console.error("Get employees error", err);
        res.status(500).json({ message: "Error loading employees" });
    }
});

// ==========================================
// TEAMS ROUTES
// ==========================================

// Get all teams
app.get("/api/teams", verifyToken, async (req, res) => {
    try {
        const { role, email } = req.user;
        let query = {};

        if (role === "subadmin") {
            query = { subadminEmail: email };
        } else if (role === "employee") {
            const employee = await Employee.findOne({ email });
            const teamNames = employee?.teams || [];
            query = { teamName: { $in: teamNames } };
        }

        const teams = await Team.find(query);
        res.json({ teams });
    } catch (err) {
        console.error("Get teams error", err);
        res.status(500).json({ message: "Error loading teams" });
    }
});

// Get single team by name
app.get("/api/teams/:teamName", verifyToken, isAdminOrSubadmin, async (req, res) => {
    try {
        const teamName = decodeURIComponent(req.params.teamName);
        const team = await Team.findOne({ teamName });

        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }
        res.json({ team });
    } catch (err) {
        console.error("Get team error", err);
        res.status(500).json({ message: "Error loading team" });
    }
});

// Create team
app.post("/api/teams", verifyToken, isAdmin, async (req, res) => {
    try {
        const { teamName, subadminEmail, employees } = req.body;

        if (!teamName || !subadminEmail) {
            return res.status(400).json({ message: "Team name and Sub-Admin are required" });
        }

        const existingTeam = await Team.findOne({ teamName });
        if (existingTeam) {
            return res.status(400).json({ message: "Team name already exists" });
        }

        const employeeEmails = Array.isArray(employees) ? employees : (employees ? [employees] : []);

        // Update employees' teams array
        if (employeeEmails.length > 0) {
            await Employee.updateMany(
                { email: { $in: employeeEmails } },
                { $addToSet: { teams: teamName } }
            );
        }

        const team = await Team.create({ teamName, subadminEmail, employees: employeeEmails });
        res.status(201).json({ team, message: "Team created successfully" });
    } catch (err) {
        console.error("Create team error", err);
        res.status(500).json({ message: "Failed to create team" });
    }
});

// Update team
app.put("/api/teams/:teamName", verifyToken, isAdmin, async (req, res) => {
    try {
        const { subadminEmail, employees, newTeamName } = req.body;
        const oldTeamName = decodeURIComponent(req.params.teamName);

        const team = await Team.findOne({ teamName: oldTeamName });
        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }

        const employeeEmails = Array.isArray(employees) ? employees : (employees ? [employees] : []);

        // Remove old team from removed employees
        const removedEmployees = team.employees.filter(e => !employeeEmails.includes(e));
        if (removedEmployees.length > 0) {
            await Employee.updateMany(
                { email: { $in: removedEmployees } },
                { $pull: { teams: oldTeamName } }
            );
        }

        // Update team
        const updatedTeamName = newTeamName || oldTeamName;
        await Team.updateOne(
            { teamName: oldTeamName },
            {
                teamName: updatedTeamName,
                subadminEmail,
                employees: employeeEmails,
                updatedAt: Date.now()
            }
        );

        // Update employees' teams array
        if (employeeEmails.length > 0) {
            if (oldTeamName !== updatedTeamName) {
                await Employee.updateMany(
                    { email: { $in: employeeEmails } },
                    { $pull: { teams: oldTeamName } }
                );
            }
            await Employee.updateMany(
                { email: { $in: employeeEmails } },
                { $addToSet: { teams: updatedTeamName } }
            );
        }

        // Update tasks if team name changed
        if (oldTeamName !== updatedTeamName) {
            await Task.updateMany({ teamName: oldTeamName }, { teamName: updatedTeamName });
        }

        // Send Team Management Notifications
        try {
            const notifications = [];
            const addedEmployees = employeeEmails.filter(e => !team.employees.includes(e));
            const unchangedEmployees = team.employees.filter(e => employeeEmails.includes(e));

            // Notify Subadmin (Primary)
            const subadmin = await collection.findOne({ email: subadminEmail });
            if (subadmin && subadmin.email !== req.user.email) {
                let changeMsg = '';
                if (removedEmployees.length > 0 || addedEmployees.length > 0) {
                    changeMsg = `Team "${updatedTeamName}" was updated`;
                }
                if (changeMsg) {
                    notifications.push({
                        recipient: subadmin._id,
                        sender: req.user.id,
                        message: changeMsg,
                        type: 'team_change',
                        priority: 'primary',
                        category: 'team_change',
                        metadata: { teamName: updatedTeamName, changeType: 'update' }
                    });
                }
            }

            // Notify Removed Employees (Primary)
            for (const email of removedEmployees) {
                const user = await collection.findOne({ email });
                if (user) {
                    notifications.push({
                        recipient: user._id,
                        sender: req.user.id,
                        message: `You were removed from team "${updatedTeamName}"`,
                        type: 'team_change',
                        priority: 'primary',
                        category: 'team_change',
                        metadata: { teamName: updatedTeamName, changeType: 'removed' }
                    });
                }
            }

            // Notify Added Employees (Primary)
            for (const email of addedEmployees) {
                const user = await collection.findOne({ email });
                if (user) {
                    notifications.push({
                        recipient: user._id,
                        sender: req.user.id,
                        message: `You were added to team "${updatedTeamName}"`,
                        type: 'team_change',
                        priority: 'primary',
                        category: 'team_change',
                        metadata: { teamName: updatedTeamName, changeType: 'added' }
                    });
                }
            }

            // Notify Unchanged Employees (Secondary)
            for (const email of unchangedEmployees) {
                const user = await collection.findOne({ email });
                if (user && user.email !== req.user.email) {
                    const changes = [];
                    if (removedEmployees.length > 0) changes.push(`${removedEmployees.join(', ')} removed`);
                    if (addedEmployees.length > 0) changes.push(`${addedEmployees.join(', ')} added`);

                    if (changes.length > 0) {
                        notifications.push({
                            recipient: user._id,
                            sender: req.user.id,
                            message: `Team "${updatedTeamName}" updated: ${changes.join('; ')}`,
                            type: 'team_change',
                            priority: 'secondary',
                            category: 'team_change',
                            metadata: { teamName: updatedTeamName, changeType: 'member_change' }
                        });
                    }
                }
            }

            if (notifications.length > 0) {
                await Notification.insertMany(notifications);
            }
        } catch (notifErr) {
            console.error("[TEAM MANAGEMENT NOTIFICATION ERROR]", notifErr);
        }

        const updatedTeam = await Team.findOne({ teamName: updatedTeamName });
        res.json({ team: updatedTeam, message: "Team updated successfully" });
    } catch (err) {
        console.error("Update team error", err);
        res.status(500).json({ message: "Failed to update team" });
    }
});

// Delete team
app.delete("/api/teams/:teamName", verifyToken, isAdmin, async (req, res) => {
    try {
        const teamName = decodeURIComponent(req.params.teamName);

        const team = await Team.findOne({ teamName });
        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }

        // Remove team from employees
        await Employee.updateMany(
            { teams: teamName },
            { $pull: { teams: teamName } }
        );

        // Update tasks
        await Task.updateMany(
            { teamName },
            { $set: { teamName: null, assigneeEmail: null } }
        );

        await Team.deleteOne({ teamName });
        res.json({ message: "Team deleted successfully" });
    } catch (err) {
        console.error("Delete team error", err);
        res.status(500).json({ message: "Failed to delete team" });
    }
});

// ==========================================
// SUBADMINS ROUTES
// ==========================================

app.get("/api/subadmins", verifyToken, isAdminOrSubadmin, async (req, res) => {
    try {
        const subadmins = await collection.find({ role: "subadmin" });
        res.json({
            subadmins: subadmins.map(s => ({
                _id: s._id,
                email: s.email
            }))
        });
    } catch (err) {
        console.error("Get subadmins error", err);
        res.status(500).json({ message: "Error loading subadmins" });
    }
});

// ==========================================
// TEAM TASKS ROUTES (Employee)
// ==========================================

// (Moved team-tasks route to lines 269)

// Helper function to get teammate emails
async function getTeammateEmails(teams, excludeEmail) {
    const teammateTeams = await Team.find({ teamName: { $in: teams } });
    const allEmails = [...new Set(teammateTeams.flatMap(t => t.employees))];
    return allEmails.filter(e => e !== excludeEmail);
}

// ==========================================
// CHAT ROUTES
// ==========================================

// Get employee's teams for chat
app.get("/api/chat/teams", verifyToken, async (req, res) => {
    try {
        const { email, role } = req.user;

        if (role !== "employee") {
            return res.status(403).json({ message: "Only employees can access team chat" });
        }

        const employee = await Employee.findOne({ email });
        const teamNames = employee?.teams || [];

        const teams = await Team.find({ teamName: { $in: teamNames } });
        res.json({ teams });
    } catch (err) {
        console.error("Get chat teams error", err);
        res.status(500).json({ message: "Error loading teams" });
    }
});

// Get team messages
app.get("/api/chat/team/:teamName", verifyToken, async (req, res) => {
    try {
        const { email, role } = req.user;
        const teamName = decodeURIComponent(req.params.teamName);

        // Verify user belongs to this team
        if (role === "employee") {
            const employee = await Employee.findOne({ email });
            if (!employee?.teams?.includes(teamName)) {
                return res.status(403).json({ message: "You are not a member of this team" });
            }
        }

        const team = await Team.findOne({ teamName });
        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }

        const messages = await TeamMessage.find({ teamName }).sort({ createdAt: 1 });
        const members = await Employee.find({ teams: teamName });

        res.json({
            messages,
            members: members.map(m => ({ email: m.email, name: m.name }))
        });
    } catch (err) {
        console.error("Get team messages error", err);
        res.status(500).json({ message: "Error loading messages" });
    }
});

// Send team message
app.post("/api/chat/team/:teamName", verifyToken, async (req, res) => {
    try {
        const { email, role } = req.user;
        const teamName = decodeURIComponent(req.params.teamName);
        const { message } = req.body;

        if (!message?.trim()) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        // Verify user belongs to this team
        if (role === "employee") {
            const employee = await Employee.findOne({ email });
            if (!employee?.teams?.includes(teamName)) {
                return res.status(403).json({ message: "You are not a member of this team" });
            }
        }

        const newMessage = await TeamMessage.create({
            teamName,
            senderEmail: email,
            message: message.trim()
        });

        // Send Chat Notifications to team members
        try {
            const team = await Team.findOne({ teamName });
            if (team) {
                const recipientEmails = team.employees.filter(e => e !== email);
                const notifications = [];

                for (const recipientEmail of recipientEmails) {
                    const recipient = await collection.findOne({ email: recipientEmail });
                    if (recipient) {
                        notifications.push({
                            recipient: recipient._id,
                            sender: req.user.id,
                            message: `You have unread messages in ${teamName} chat`,
                            type: 'chat',
                            priority: 'primary',
                            category: 'chat',
                            metadata: { chatName: teamName }
                        });
                    }
                }

                if (notifications.length > 0) {
                    await Notification.insertMany(notifications);
                }
            }
        } catch (notifErr) {
            console.error("[TEAM CHAT NOTIFICATION ERROR]", notifErr);
        }

        res.status(201).json({ message: newMessage });
    } catch (err) {
        console.error("Send team message error", err);
        res.status(500).json({ message: "Failed to send message" });
    }
});

// Get admin-subadmin messages
app.get("/api/chat/admin", verifyToken, isAdminOrSubadmin, async (req, res) => {
    try {
        const { email, role } = req.user;
        const channel = req.query.channel || 'general';

        let query = {};

        if (channel === 'general') {
            query = { receiverEmail: 'all@subadmin.com' };
        } else if (role === 'admin') {
            // Admin viewing specific subadmin channel
            query = {
                $or: [
                    { senderEmail: email, receiverEmail: channel },
                    { senderEmail: channel, receiverEmail: email },
                    { receiverEmail: 'all@subadmin.com' }
                ]
            };
        } else {
            // Subadmin viewing their messages
            query = {
                $or: [
                    { senderEmail: email },
                    { receiverEmail: email },
                    { receiverEmail: 'all@subadmin.com' }
                ]
            };
        }

        const messages = await AdminSubadminMessage.find(query).sort({ createdAt: 1 });
        res.json({ messages });
    } catch (err) {
        console.error("Get admin chat error", err);
        res.status(500).json({ message: "Error loading messages" });
    }
});

// Send admin-subadmin message
app.post("/api/chat/admin", verifyToken, isAdminOrSubadmin, async (req, res) => {
    try {
        const { email, role } = req.user;
        const { receiverEmail, message, channel } = req.body;

        if (!message?.trim()) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        let actualReceiver = receiverEmail;
        if (receiverEmail === 'general' || channel === 'general') {
            actualReceiver = 'all@subadmin.com';
        }

        const newMessage = await AdminSubadminMessage.create({
            senderEmail: email,
            receiverEmail: actualReceiver,
            message: message.trim()
        });

        // Send Chat Notifications
        try {
            const notifications = [];

            if (actualReceiver === 'all@subadmin.com') {
                // Broadcast to all subadmins and admin
                const subadmins = await collection.find({ role: 'subadmin' });
                const admin = await collection.findOne({ role: 'admin' });

                const recipients = [...subadmins];
                if (admin) recipients.push(admin);

                for (const recipient of recipients) {
                    if (recipient.email !== email) {
                        notifications.push({
                            recipient: recipient._id,
                            sender: req.user.id,
                            message: `You have unread messages in Admin Chat (General)`,
                            type: 'chat',
                            priority: 'primary',
                            category: 'chat',
                            metadata: { chatName: 'Admin Chat - General' }
                        });
                    }
                }
            } else {
                // Direct message
                const recipient = await collection.findOne({ email: actualReceiver });
                if (recipient) {
                    notifications.push({
                        recipient: recipient._id,
                        sender: req.user.id,
                        message: `You have unread messages from ${email}`,
                        type: 'chat',
                        priority: 'primary',
                        category: 'chat',
                        metadata: { chatName: `Admin Chat - ${email}` }
                    });
                }
            }

            if (notifications.length > 0) {
                await Notification.insertMany(notifications);
            }
        } catch (notifErr) {
            console.error("[ADMIN CHAT NOTIFICATION ERROR]", notifErr);
        }

        res.status(201).json({ message: newMessage });
    } catch (err) {
        console.error("Send admin chat error", err);
        res.status(500).json({ message: "Failed to send message" });
    }
});


// ==========================================
// WATCHLIST ROUTES
// ==========================================

// Get all users (for adding watchers to your watchlist)
app.get("/api/users/all", verifyToken, async (req, res) => {
    try {
        const users = await collection.find({}, { password: 0 });

        // Get additional employee details
        const userDetails = await Promise.all(
            users.map(async (user) => {
                const empModel = await Employee.findOne({ email: user.email });
                return {
                    _id: user._id,
                    email: user.email,
                    role: user.role,
                    name: empModel?.name || user.email.split("@")[0]
                };
            })
        );

        res.json({ users: userDetails });
    } catch (err) {
        console.error("Get all users error", err);
        res.status(500).json({ message: "Error loading users" });
    }
});

// Get my watchlist settings (who I've granted access to)
app.get("/api/watchlist/my-settings", verifyToken, async (req, res) => {
    try {
        let watchlist = await Watchlist.findOne({ owner: req.user.id });

        if (!watchlist) {
            // Create empty watchlist if doesn't exist
            watchlist = await Watchlist.create({ owner: req.user.id, watchers: [] });
        }

        // Populate watcher details
        const watcherDetails = await Promise.all(
            watchlist.watchers.map(async (w) => {
                const user = await collection.findById(w.user);
                const empModel = user ? await Employee.findOne({ email: user.email }) : null;
                return {
                    userId: w.user,
                    email: user?.email || 'Unknown',
                    name: empModel?.name || user?.email?.split("@")[0] || 'Unknown',
                    role: user?.role || 'Unknown',
                    allowedTypes: w.allowedTypes,
                    addedAt: w.addedAt
                };
            })
        );

        res.json({ watchers: watcherDetails });
    } catch (err) {
        console.error("Get watchlist settings error", err);
        res.status(500).json({ message: "Error loading watchlist settings" });
    }
});

// Update my watchlist (add/remove watchers)
app.put("/api/watchlist/update", verifyToken, async (req, res) => {
    try {
        const { watchers } = req.body; // Array of { userId, allowedTypes }

        let watchlist = await Watchlist.findOne({ owner: req.user.id });

        if (!watchlist) {
            watchlist = new Watchlist({ owner: req.user.id, watchers: [] });
        }

        // Validate and format watchers
        watchlist.watchers = watchers.map(w => ({
            user: w.userId,
            allowedTypes: w.allowedTypes || ['all'],
            addedAt: w.addedAt || new Date()
        }));

        await watchlist.save();

        res.json({ success: true, message: "Watchlist updated successfully" });
    } catch (err) {
        console.error("Update watchlist error", err);
        res.status(500).json({ message: "Error updating watchlist" });
    }
});

// Get list of users who have granted me access to watch their notifications
app.get("/api/watchlist/i-can-watch", verifyToken, async (req, res) => {
    try {
        // Find all watchlists where current user is a watcher
        // Convert to ObjectId for proper MongoDB matching
        const userObjId = new mongoose.Types.ObjectId(req.user.id);
        const watchlists = await Watchlist.find({ "watchers.user": userObjId });

        console.log("[i-can-watch] User:", req.user.id, "Found watchlists:", watchlists.length);

        const canWatch = await Promise.all(
            watchlists.map(async (wl) => {
                const owner = await collection.findById(wl.owner);
                const empModel = owner ? await Employee.findOne({ email: owner.email }) : null;
                const myAccess = wl.watchers.find(w => w.user?.toString() === req.user.id);

                return {
                    ownerId: wl.owner,
                    email: owner?.email || 'Unknown',
                    name: empModel?.name || owner?.email?.split("@")[0] || 'Unknown',
                    role: owner?.role || 'Unknown',
                    allowedTypes: myAccess?.allowedTypes || []
                };
            })
        );

        res.json({ canWatch });
    } catch (err) {
        console.error("Get i-can-watch error", err);
        res.status(500).json({ message: "Error loading watchable users" });
    }
});


// ==========================================
// NOTIFICATIONS ROUTES
// ==========================================

// Get user notifications (supports watchlist via userId query param)
app.get("/api/notifications", verifyToken, async (req, res) => {
    try {
        const targetUserId = req.query.userId || req.user.id;
        const typeFilter = req.query.type;

        // If requesting another user's notifications, check permission
        if (targetUserId !== req.user.id) {
            const ownerWatchlist = await Watchlist.findOne({ owner: targetUserId });

            if (!ownerWatchlist) {
                console.log("No watchlist found for owner:", targetUserId);
                return res.status(403).json({ message: "You don't have permission to view this user's notifications" });
            }

            // Find current user in the watchers array
            const myAccess = ownerWatchlist.watchers.find(w => {
                const watcherUserId = w.user?.toString() || w.userId?.toString();
                return watcherUserId === req.user.id || watcherUserId === req.user.id?.toString();
            });

            if (!myAccess) {
                console.log("User not in watchers:", req.user.id, "Watchers:", ownerWatchlist.watchers);
                return res.status(403).json({ message: "You don't have permission to view this user's notifications" });
            }

            // Build query based on allowed types
            let query = { recipient: targetUserId };

            const hasAllAccess = myAccess.allowedTypes && myAccess.allowedTypes.includes('all');

            if (!hasAllAccess && myAccess.allowedTypes && myAccess.allowedTypes.length > 0) {
                // Filter by allowed types only
                if (typeFilter && typeFilter !== 'all') {
                    // If type filter specified, check if it's in allowed types
                    if (!myAccess.allowedTypes.includes(typeFilter)) {
                        return res.json({ notifications: [] }); // Not allowed to see this type
                    }
                    query.type = typeFilter;
                } else {
                    // Show only allowed types
                    query.type = { $in: myAccess.allowedTypes };
                }
            } else if (typeFilter && typeFilter !== 'all') {
                query.type = typeFilter;
            }

            const notifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(50);
            return res.json({ notifications });
        }


        // Viewing own notifications - no permission check needed
        let query = { recipient: targetUserId };

        if (typeFilter && typeFilter !== 'all') {
            query.type = typeFilter;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await Notification.countDocuments(query);
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            notifications,
            hasMore: total > skip + notifications.length,
            total,
            page
        });
    } catch (err) {
        console.error("Get notifications error", err);
        res.status(500).json({ message: "Error loading notifications" });
    }
});

// Mark notification as read
app.put("/api/notifications/:id/read", verifyToken, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, {
            isRead: true,
            readAt: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        console.error("Mark read error", err);
        res.status(500).json({ message: "Error updating notification" });
    }
});

// Mark notification as unread
app.put("/api/notifications/:id/unread", verifyToken, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, {
            isRead: false,
            readAt: null
        });
        res.json({ success: true });
    } catch (err) {
        console.error("Mark unread error", err);
        res.status(500).json({ message: "Error updating notification" });
    }
});

// Mark all as read
app.put("/api/notifications/read-all", verifyToken, async (req, res) => {
    try {
        const { id } = req.user;
        await Notification.updateMany(
            { recipient: id, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Mark all read error", err);
        res.status(500).json({ message: "Error updating notifications" });
    }
});

// ==========================================
// USERS API
// ==========================================

// Get all users (for watchlist)
app.get("/api/users/all", verifyToken, async (req, res) => {
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
});

// ==========================================
// WATCHLIST API
// ==========================================

// Get my watchlist settings (who I've granted access to)
app.get("/api/watchlist/my-settings", verifyToken, async (req, res) => {
    try {
        const { id } = req.user;
        let watchlist = await Watchlist.findOne({ owner: id });

        if (!watchlist) {
            watchlist = { owner: id, watchers: [] };
        }

        // Populate watcher details
        const watchersWithDetails = await Promise.all(
            (watchlist.watchers || []).map(async (w) => {
                const user = await collection.findById(w.user || w.userId).lean();
                return {
                    userId: w.user || w.userId,
                    email: user?.email,
                    name: user?.name || user?.email?.split('@')[0],
                    role: user?.role,
                    allowedTypes: w.allowedTypes || ['all']
                };
            })
        );

        res.json({ watchers: watchersWithDetails });
    } catch (err) {
        console.error("Get watchlist settings error", err);
        res.status(500).json({ message: "Error loading watchlist" });
    }
});

// Update my watchlist (add/remove watchers)
app.put("/api/watchlist/update", verifyToken, async (req, res) => {
    try {
        const { id } = req.user;
        const { watchers } = req.body;

        // Transform watchers to proper format
        const watcherData = (watchers || []).map(w => ({
            user: w.userId,
            allowedTypes: w.allowedTypes || ['all'],
            addedAt: new Date()
        }));

        await Watchlist.findOneAndUpdate(
            { owner: id },
            {
                owner: id,
                watchers: watcherData,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Update watchlist error", err);
        res.status(500).json({ message: "Error updating watchlist" });
    }
});

// Get list of users who have granted me access to watch their notifications
app.get("/api/watchlist/i-can-watch", verifyToken, async (req, res) => {
    try {
        const { id } = req.user;

        // Find all watchlists where current user is in the watchers array
        const watchlists = await Watchlist.find({
            'watchers.user': id
        }).lean();

        // Get owner details and allowed types for each
        const canWatch = await Promise.all(
            watchlists.map(async (wl) => {
                const owner = await collection.findById(wl.owner).lean();
                const myEntry = wl.watchers.find(w => w.user?.toString() === id);
                return {
                    ownerId: wl.owner,
                    email: owner?.email,
                    name: owner?.name || owner?.email?.split('@')[0],
                    role: owner?.role,
                    allowedTypes: myEntry?.allowedTypes || ['all']
                };
            })
        );

        res.json({ canWatch });
    } catch (err) {
        console.error("Get i-can-watch error", err);
        res.status(500).json({ message: "Error loading watchable users" });
    }
});


// ==========================================
// SERVE REACT APP (Production)
// ==========================================


// Serve static files from React build
const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));

    // Handle React routing
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(clientBuildPath, 'index.html'));
        }
    });
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
    console.log(`Frontend: http://localhost:5173 (Vite dev server)`);
    console.log(`API: http://localhost:${PORT}/api`);
});
