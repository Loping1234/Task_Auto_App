const express = require("express");
const bcrypt = require("bcrypt");
const cors = require("cors");
const collection = require("./config");
const Task = require("../models/task");
const Team = require("../models/team");
const Employee = require("../models/employee");
const TeamMessage = require("../models/teamMessage");
const AdminSubadminMessage = require("../models/adminSubadminMessage");
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { generateToken, verifyToken, isAdmin, isAdminOrSubadmin } = require('./middleware/auth');

const app = express();

// CORS configuration for React frontend
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
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
                role: user.role
            }
        });
    } catch (err) {
        console.error("Login error", err);
        res.status(500).json({ message: "Login failed" });
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
        if (domain === "admin.com") role = "admin";
        else if (domain === "subadmin.com") role = "subadmin";

        const user = await collection.create({
            email,
            password: hashedPassword,
            role
        });

        // Create employee record if employee role
        if (role === "employee") {
            await Employee.create({
                name: email.split("@")[0],
                email,
                password: hashedPassword
            });
        }

        res.status(201).json({ message: "Signup successful" });
    } catch (err) {
        console.error("Signup error", err);
        res.status(500).json({ message: "Signup failed" });
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
app.post("/api/tasks", verifyToken, isAdminOrSubadmin, upload.single('image'), async (req, res) => {
    try {
        const { title, description, startDate, endDate, status, assigneeEmail, teamName } = req.body;

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
            teamName: teamName || null
        };

        const task = await Task.create(taskData);
        res.status(201).json({ task, message: "Task created successfully" });
    } catch (err) {
        console.error("Create task error", err);
        res.status(500).json({ message: "Failed to create task" });
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

app.get("/api/employees", verifyToken, isAdminOrSubadmin, async (req, res) => {
    try {
        const { role, email } = req.user;
        let query = { role: "employee" };

        if (role === "subadmin") {
            const teams = await Team.find({ subadminEmail: email });
            const employeeEmails = [...new Set(teams.flatMap(t => t.employees))];
            query = { email: { $in: employeeEmails } };
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
app.get("/api/teams", verifyToken, isAdminOrSubadmin, async (req, res) => {
    try {
        const { role, email } = req.user;
        let query = {};

        if (role === "subadmin") {
            query = { subadminEmail: email };
        }

        const teams = await Team.find(query);
        res.json({ teams });
    } catch (err) {
        console.error("Get teams error", err);
        res.status(500).json({ message: "Error loading teams" });
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

        res.status(201).json({ message: newMessage });
    } catch (err) {
        console.error("Send admin chat error", err);
        res.status(500).json({ message: "Failed to send message" });
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
