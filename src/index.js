const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const collection = require("./config");
const Task = require("../models/task");
const Team = require("../models/team");
const Employee = require("../models/employee");
const TeamMessage = require("../models/teamMessage");
const AdminSubadminMessage = require("../models/adminSubadminMessage");
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();

// Ensure indexes are correct on startup (cleanup legacy indexes like `name_1`)
const mongoose = require('mongoose');
mongoose.connection.on('connected', async () => {
    try {
        // Drop legacy index if it exists (some older schema used `name`)
        try {
            await Team.collection.dropIndex('name_1');
            console.log('Dropped legacy index name_1 from teams collection');
        } catch (dropErr) {
            // ignore if index not found
            if (dropErr && dropErr.codeName !== 'IndexNotFound') {
                console.warn('Could not drop legacy index name_1:', dropErr.message || dropErr);
            }
        }

        // Ensure unique index on teamName exists (will be created if not present)
        await Team.collection.createIndex({ teamName: 1 }, { unique: true });
        console.log('Ensured unique index on teams.teamName');
    } catch (err) {
        console.error('Error ensuring team indexes:', err);
    }
});

const imgsDir = path.join(__dirname, '../imgs');
if (!fs.existsSync(imgsDir)) {
    fs.mkdirSync(imgsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, imgsDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
app.use('/fontawesome', express.static('node_modules/@fortawesome/fontawesome-free'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'thisisarandomkey',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Explicitly set a Content-Security-Policy to allow CDNs and development tools
//app.use((req, res, next) => {
//    res.setHeader(
//        'Content-Security-Policy',
//        "default-src 'self'; " +
//        "style-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com 'unsafe-inline'; " +
//        "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; " +
//        "font-src 'self' https://cdnjs.cloudflare.com; " +
//        "img-src 'self' data:; " +
//        "connect-src 'self' ws://localhost:* http://localhost:*"
//    );
//    next();
//});

// Prevent caching for all routes to handle back button after logout
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // HTTP 1.1.
    res.setHeader('Pragma', 'no-cache'); // HTTP 1.0.
    res.setHeader('Expires', '0'); // Proxies.
    next();
});

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
    if (req.session.userEmail) {
        return next();
    }
    res.redirect("/login");
};

const isAdmin = (req, res, next) => {
    if (req.session.userEmail && req.session.userRole === "admin") {
        return next();
    }
    res.status(403).send("Unauthorized: Admin access only");
};

const isSubadmin = (req, res, next) => {
    if (req.session.userEmail && req.session.userRole === "subadmin") {
        return next();
    }
    res.status(403).send("Unauthorized: Sub-admin access only");
};

const isEmployee = (req, res, next) => {
    if (req.session.userEmail && req.session.userRole === "employee") {
        return next();
    }
    res.status(403).send("Unauthorized: Employee access only");
};

// Middleware to check if user is already logged in (for login/signup pages)
const isAlreadyAuthenticated = (req, res, next) => {
    if (req.session.userEmail) {
        if (["admin", "subadmin", "employee"].includes(req.session.userRole)) {
            return res.redirect("/dashboard");
        }
        else {
            return res.status(404).send("Unauthorized Credentials");
        }
    }
    next();
};

app.set('view engine', 'ejs');
app.use(express.static("public"));

app.get("/", isAlreadyAuthenticated, (req, res) => {
    res.render("login");
});

app.get("/signup", isAlreadyAuthenticated, (req, res) => {
    res.render("signup");
});
app.post("/signup", async (req, res) => {
    try {
        const existingUser = await collection.findOne({ email: req.body.email });

        if (existingUser) {
            return res.status(400).send("User already exists");
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const domain = req.body.email.split("@")[1];
        let role = "employee";
        if (domain === "admin.com") {
            role = "admin";
        } else if (domain === "subadmin.com") {
            role = "subadmin";
        }

        const data = {
            email: req.body.email,
            password: hashedPassword,
            role: role
        };
        const userdata = await collection.create(data);

        // If it's an employee, also create an entry in the Employee model
        if (data.role === "employee") {
            await Employee.create({
                name: req.body.email.split("@")[0], // Use email prefix as name
                email: req.body.email,
                password: hashedPassword
            });
        }

        console.log(userdata);
        res.status(201).send("Signup successful");
    }
    catch (err) {
        console.error("Signup error", err);
        res.status(500).send("Signup failed");
    }
});


app.get("/login", isAlreadyAuthenticated, (req, res) => {
    res.render("login");
});
app.post("/login", async (req, res) => {
    try {
        const user = await collection.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).send("User not found");
        }
        const isPasswordMatch = await bcrypt.compare(req.body.password, user.password);
        if (isPasswordMatch) {
            req.session.userEmail = user.email;
            req.session.userRole = user.role;

            // Explicitly save session before redirect
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.status(500).send("Login failed");
                }

                console.log("Session saved. User email:", req.session.userEmail);

                const domain = user.email.split("@")[1];
                if (["admin.com", "subadmin.com", "emp.com"].includes(domain)) {
                    res.redirect("/dashboard");
                }
                else {
                    res.status(404).send("Unauthorised credentials, use valid roles");
                }
            });
        }
        else {
            res.status(401).send("Invalid password");
        }
    }
    catch (err) {
        console.error("Login error", err);
        res.status(500).send("Login failed");
    }
});

app.get("/dashboard", isAuthenticated, async (req, res) => {
    try {
        const userRole = req.session.userRole;
        if (userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            const employees = await collection.find({
                email: { $in: employeeEmails }
            });
            const options = employees.map(emp => `<option value="${emp.email}">${emp.email}</option>`).join('');
            const allTasks = await Task.find({ $or: [{ assigneeEmail: { $in: employeeEmails } }, { teamName: { $in: teams.map(t => t.teamName) } }] }).sort({ createdAt: -1 });
            const empCount = employees.length;
            const emp_names = employees.map(emp => emp.email);
            const taskCount = allTasks.length;
            const task_names = allTasks.map(task => task.title)
            res.render("dashboard", {
                options,
                teams,
                tasks: allTasks,
                emp: empCount,
                employees,
                taskCount,
                task_names,
                emp_names,
                user: { role: userRole, email: req.session.userEmail }
            });
        }

        else if (userRole === "admin") {
            const subadmins = await collection.find({ role: "subadmin" });
            const employees = await collection.find({ role: "employee" });
            const allTasks = await Task.find().sort({ createdAt: -1 });
            const teams = await Team.find();
            const subadminCount = subadmins.length;
            const empCount = employees.length;
            const taskCount = allTasks.length;
            const teamCount = teams.length;
            res.render("dashboard", {
                subadmins,
                employees,
                subadminCount,
                empCount,
                taskCount,
                teamCount,
                user: { role: userRole, email: req.session.userEmail }
            });
        }

        else if (userRole === "employee") {
            let employee = await Employee.findOne({ email: req.session.userEmail });
            if (!employee) {
                employee = await Employee.create({
                    name: req.session.userEmail.split("@")[0],
                    email: req.session.userEmail,
                    password: "password_placeholder"
                });
            }
            const employeeTeams = employee.teams || [];
            if (employee.teamName && !employeeTeams.includes(employee.teamName)) {
                employeeTeams.push(employee.teamName);
            }
            const individualTasks = await Task.find({ assigneeEmail: req.session.userEmail });

            // Get teammate tasks based on current team membership
            let teammateTasks = [];
            if (employeeTeams.length > 0) {
                const teams = await Team.find({ teamName: { $in: employeeTeams } });
                const allTeamMembers = teams.flatMap(team => team.employees);
                const teamMemberEmails = [...new Set(allTeamMembers)].filter(email => email !== req.session.userEmail);

                if (teamMemberEmails.length > 0) {
                    teammateTasks = await Task.find({
                        assigneeEmail: { $in: teamMemberEmails }
                    });
                }
            }
            res.render("dashboard", {
                email: req.session.userEmail,
                individualTaskCount: individualTasks.length,
                teamTaskCount: teammateTasks.length,
                teams: employeeTeams,
                user: { role: userRole, email: req.session.userEmail }
            });
        }
    }

    catch (err) {
        console.error("Error fetching dashboard data", err)
        res.status(500).send("Error loading  dashboard");
    }
})

app.get("/view-emp", isAuthenticated, async (req, res) => {
    try {
        let query = {};
        if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            query = { email: { $in: employeeEmails } };
        } else if (req.session.userRole === "admin") {
            query = { role: "employee" };
        } else {
            return res.status(403).send("Unauthorized");
        }

        const employee = await collection.find(query);
        res.render("viewemps", { employee, userRole: req.session.userRole });
    }
    catch (err) {
        console.error("Error fetching employees", err);
        res.status(500).send("Error loading employees");
    }
})

app.get("/view-teams", isAuthenticated, async (req, res) => {
    try {
        let query = {};
        if (req.session.userRole === "subadmin") {
            query = { subadminEmail: req.session.userEmail };
        } else if (req.session.userRole === "admin") {
            query = {};
        } else {
            return res.status(403).send("Unauthorized");
        }

        const teams = await Team.find(query);
        res.render("view-teams", { teams, userRole: req.session.userRole });
    } catch (err) {
        console.error("Error fetching teams", err);
        res.status(500).send("Error loading teams");
    }
});

app.get("/viewteamsadmin", isAuthenticated, async (req, res) => {
    try {
        let query = {};
        if (req.session.userRole === "admin") {
            query = {};
        } else if (req.session.userRole === "subadmin") {
            query = { subadminEmail: req.session.userEmail };
        } else {
            return res.status(403).send("Unauthorized");
        }

        const teams = await Team.find(query);
        res.render("viewteamsadmin", { teams, userRole: req.session.userRole });
    } catch (err) {
        console.error("Error fetching teams", err);
        res.status(500).send("Error loading teams");
    }
});

// ADMIN TASK ASSIGNMENT ROUTES
app.get("/admin/assign", isAdmin, async (req, res) => {
    try {
        const teams = await Team.find({});
        const employees = await collection.find({ role: "employee" });

        const options = employees.map(emp => `<option value="${emp.email}">Employee: ${emp.email}</option>`).join('');
        const teamOptions = teams.map(team => `<option value="${team.teamName}">Team: ${team.teamName}</option>`).join('');

        res.render("admin-assign", { options, teamOptions });
    } catch (err) {
        console.error("Error loading admin assign page", err);
        res.status(500).send("Error loading assignment page");
    }
});

app.post("/admin/assign", isAdmin, upload.single('image'), async (req, res) => {
    try {
        const { title, description, startDate, endDate, status, assigneeEmail, teamName } = req.body;

        if (!title || (!assigneeEmail && !teamName)) {
            return res.status(400).send("Title and either an assignee or a team are required");
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

        if (assigneeEmail) {
            const assignee = await collection.findOne({ email: assigneeEmail, role: "employee" });
            if (assignee) {
                assignee.assignedTasks = Array.isArray(assignee.assignedTasks) ? assignee.assignedTasks : [];
                assignee.assignedTasks.push(task._id);
                await assignee.save();
            }
        }

        res.redirect("/existingtasks");
    }
    catch (err) {
        console.error("Error assigning tasks as admin", err)
        res.status(500).send("Assignment failed");
    }
})

app.get("/viewsubadm", isAdmin, async (req, res) => {
    try {
        const subadmins = await collection.find({
            role: "subadmin"
        })
        res.render("viewsubadm", { subadmins });
    }
    catch (err) {
        console.error("Error fetching subadmins", err);
        res.status(500).send("Error loading subadmins");
    }
})

// ADMIN TEAM MANAGEMENT ROUTES
app.get("/admin/team/manage", isAdmin, async (req, res) => {
    try {
        const teams = await Team.find({});
        const subadmins = await collection.find({ role: "subadmin" });
        // Fetch all employees not currently in a team or all employees for selection
        const employees = await collection.find({ role: "employee" });

        res.render("view-teammgmt", { teams, subadmins, employees });
    } catch (err) {
        console.error("Error loading team management page", err);
        res.status(500).send("Error loading team management page");
    }
});

app.post("/admin/team/create", isAdmin, async (req, res) => {
    try {
        const { teamName, subadminEmail, employees } = req.body;

        if (!teamName || !subadminEmail) {
            return res.status(400).send("Team name and Sub-Admin are required.");
        }

        const existingTeam = await Team.findOne({ teamName });
        if (existingTeam) {
            return res.status(400).send("Team name already exists.");
        }

        const employeeEmails = Array.isArray(employees) ? employees : (employees ? [employees] : []);

        // Note: Allow employees to be members of multiple teams; no uniqueness check.

        // Update the employee model: Add the new teamName to the employees' teams array
        const employeeOps = employeeEmails.map(email => ({
            updateOne: {
                filter: { email },
                update: { $addToSet: { teams: teamName } },
                upsert: true
            }
        }));
        await Employee.bulkWrite(employeeOps);

        await Team.create({
            teamName,
            subadminEmail,
            employees: employeeEmails
        });

        res.redirect("/admin/team/manage");
    } catch (err) {
        console.error("Error creating team", err);
        res.status(500).send("Team creation failed.");
    }
});

app.get("/admin/team/edit/:teamName", isAdmin, async (req, res) => {
    try {
        const team = await Team.findOne({ teamName: req.params.teamName });
        if (!team) {
            return res.status(404).send("Team not found.");
        }

        const subadmins = await collection.find({ role: "subadmin" });
        const employees = await collection.find({ role: "employee" });

        res.render("edit-team", { team, subadmins, employees });
    } catch (err) {
        console.error("Error loading edit team page", err);
        res.status(500).send("Error loading edit team page.");
    }
});

app.post("/admin/team/update/:teamName", isAdmin, async (req, res) => {
    try {
        const { subadminEmail, employees } = req.body;
        const oldTeamName = req.params.teamName;
        const newTeamName = req.body.newTeamName || oldTeamName;

        if (!subadminEmail) {
            return res.status(400).send("Sub-Admin is required.");
        }

        const employeeEmails = Array.isArray(employees) ? employees : (employees ? [employees] : []);

        const team = await Team.findOne({ teamName: oldTeamName });
        if (!team) {
            return res.status(404).send("Team not found.");
        }

        // Clear old team name for employees removed from the team
        const employeesRemoved = team.employees.filter(email => !employeeEmails.includes(email));
        await Employee.updateMany(
            { email: { $in: employeesRemoved } },
            { $pull: { teams: oldTeamName } }
        );

        // Update the team in the database
        await Team.updateOne(
            { teamName: oldTeamName },
            {
                $set: {
                    teamName: newTeamName,
                    subadminEmail,
                    employees: employeeEmails,
                    updatedAt: Date.now()
                }
            }
        );

        // If team name changed, remove old and add new for current members. 
        // If not changed, just ensure they are in the array.
        const employeeOps = employeeEmails.map(email => {
            const update = { $addToSet: { teams: newTeamName } };
            if (oldTeamName !== newTeamName) {
                // If the name changed, we need to pull the old name as well
                // Note: mongo bulkWrite doesn't support $pull and $addToSet on same field in one op easily
                // So we'll handle pull separately if name changed.
            }
            return {
                updateOne: {
                    filter: { email },
                    update: update,
                    upsert: true
                }
            };
        });

        if (oldTeamName !== newTeamName) {
            await Employee.updateMany(
                { email: { $in: employeeEmails } },
                { $pull: { teams: oldTeamName } }
            );
        }

        await Employee.bulkWrite(employeeOps);


        // If the team name changed, also update any tasks assigned to the old team name
        if (oldTeamName !== newTeamName) {
            await Task.updateMany(
                { teamName: oldTeamName },
                { $set: { teamName: newTeamName } }
            );
        }

        res.redirect("/admin/team/manage");
    } catch (err) {
        console.error("Error updating team", err);
        res.status(500).send("Team update failed.");
    }
});

app.post("/admin/team/delete/:teamName", isAdmin, async (req, res) => {
    try {
        const teamName = req.params.teamName;

        const team = await Team.findOne({ teamName });
        if (!team) {
            return res.status(404).send("Team not found.");
        }

        // Remove the teamName from all associated employees' teams array
        await Employee.updateMany(
            { teams: teamName },
            { $pull: { teams: teamName } }
        );

        // Delete the team
        await Team.deleteOne({ teamName });

        // Optionally, reassign or handle tasks associated with the deleted team
        // For now, setting teamName to null for tasks previously assigned to this team
        await Task.updateMany(
            { teamName: teamName },
            { $set: { teamName: null, assigneeEmail: null } }
        );

        res.redirect("/admin/team/manage");
    } catch (err) {
        console.error("Error deleting team", err);
        res.status(500).send("Team deletion failed.");
    }
});


app.get("/assign", isAuthenticated, async (req, res) => {
    try {
        if (req.session.userRole !== "subadmin" && req.session.userRole !== "admin") {
            return res.status(403).send("Unauthorized");
        }
        let employees = [];
        if (req.session.userRole === "admin") {
            employees = await collection.find({ role: { $in: ["employee", "subadmin"] } });
        }
        else if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];

            employees = await collection.find({
                email: { $in: employeeEmails }
            });
        }
        const options = employees.map(emp => `<option value="${emp.email}">${emp.name || emp.email}</option>`).join('');

        res.render("assign", {
            options,
            user: { role: req.session.userRole, email: req.session.userEmail }
        });
    } catch (err) {
        console.error("Error loading assign page", err);
        res.status(500).send("Error loading assign page");
    }
});

app.post("/assign", isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        if (req.session.userRole !== "subadmin" && req.session.userRole !== "admin") {
            return res.status(403).send("Unauthorized");
        }
        const { title, description, startDate, endDate, status, assigneeEmail } = req.body;
        if (!title || !assigneeEmail) {
            return res.status(400).send("Title and assignee are required");
        }
        let teamName = null;
        // Fix 4: Separate logic for Admin (can assign to anyone) vs Subadmin (restricted)
        if (req.session.userRole === "admin") {
            // Admin assignment: Just find the employee's team name if it exists
            const employeeTeam = await Team.findOne({ employees: assigneeEmail });
            teamName = employeeTeam ? employeeTeam.teamName : null;
        } else {
            // Subadmin assignment: Strict check against subadmin's teams
            const subadminTeams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(subadminTeams.flatMap(team => team.employees))];
            if (!employeeEmails.includes(assigneeEmail)) {
                return res.status(403).send("Unauthorized: Employee not in your teams");
            }
            const employeeTeam = subadminTeams.find(team => team.employees.includes(assigneeEmail));
            teamName = employeeTeam ? employeeTeam.teamName : null;
        }
        const taskData = {
            title,
            description,
            image: req.file ? req.file.filename : null,
            imageContentType: req.file ? req.file.mimetype : null,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            status: status || "Pending",
            assigneeEmail,
            teamName
        };
        const task = await Task.create(taskData);
        const assignee = await collection.findOne({ email: assigneeEmail });
        if (assignee) {
            assignee.assignedTasks = Array.isArray(assignee.assignedTasks) ? assignee.assignedTasks : [];
            assignee.assignedTasks.push(task._id);
            await assignee.save();
        }
        res.redirect("/existingtasks");
    }
    catch (err) {
        console.error("Error assigning tasks", err)
        res.status(500).send("Assigning failed");
    }
})

app.get("/task-img/:id", async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task || !task.image) {
            return res.status(404).send("Image not found");
        }
        const imagePath = path.join(imgsDir, task.image);
        if (!fs.existsSync(imagePath)) {
            return res.status(404).send("Image file not found");
        }
        res.sendFile(imagePath);
    }
    catch (err) {
        console.error("Error fetching image,", err);
        res.status(500).send("Error loading image");
    }
});

// Route to serve comment images
app.get("/comment-img/:taskId/:commentId", async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);
        if (!task) return res.status(404).send("Task not found");

        const comment = task.comments.id(req.params.commentId);
        if (!comment || !comment.image) return res.status(404).send("Image not found");

        const imagePath = path.join(imgsDir, comment.image);
        if (!fs.existsSync(imagePath)) return res.status(404).send("File not found");

        res.sendFile(imagePath);
    } catch (err) {
        console.error("Error fetching comment image", err);
        res.status(500).send("Error loading image");
    }
});

// Route to add a comment
app.post("/task/:id/comment", isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const { text } = req.body;
        const taskId = req.params.id;

        if (!text) {
            return res.status(400).send("Comment text is required");
        }

        const comment = {
            text,
            author: req.session.userEmail,
            image: req.file ? req.file.filename : null
        };

        await Task.findByIdAndUpdate(taskId, {
            $push: { comments: comment }
        });

        // Render the same page with an acknowledgement message
        const updatedTask = await Task.findById(taskId);
        const employees = await collection.find({
            $or: [
                { role: "employee" },
                { email: { $regex: "@emp\\.com$" } }
            ]
        });
        res.render('emptaskDetails', {
            task: updatedTask,
            employees,
            userRole: req.session.userRole,
            userEmail: req.session.userEmail,
            commentSuccess: true
        });
    } catch (err) {
        console.error("Error adding comment", err);
        res.status(500).send("Failed to add comment");
    }
});

app.get('/emptaskDetails/:id', isEmployee, async (req, res) => {
    try {
        const taskId = req.params.id;
        const employeeEmail = req.session.userEmail;

        const employee = await Employee.findOne({ email: employeeEmail });
        const teamName = employee ? employee.teamName : null;

        // Query to find task: assigned to individual OR assigned to their team
        const findQuery = {
            _id: taskId,
            $or: [
                { assigneeEmail: employeeEmail }
            ]
        };

        if (teamName) {
            findQuery.$or.push({ teamName: teamName });
        }

        const task = await Task.findOne(findQuery);

        const employees = await collection.find({
            $or: [
                { role: "employee" },
                { email: { $regex: "@emp\\.com$" } }
            ]
        });
        if (!task) {
            return res.status(404).send('Task not found or unauthorized');
        }
        res.render('emptaskDetails', {
            task,
            employees,
            userRole: req.session.userRole,
            userEmail: req.session.userEmail
        });
    } catch (err) {
        console.error("Error fetching task details", err);
        res.status(500).send("Error loading task details");
    }
});

app.get('/emptaskComment/:id', async (req, res) => {
    const id = req.params.id;
    const employees = await collection.find({
        $or: [
            { role: "employee" },
            { email: { $regex: "@emp\\.com$" } }
        ]
    });
    const options = employees.map(emp => `<option value="${emp.email}">${emp.email}</option>`).join('');
    const allTasks = await Task.find().sort({ createdAt: -1 });
    res.render("emptaskComment", { options, tasks: allTasks, employees });
});


app.get("/existingtasks", isAuthenticated, async (req, res) => {
    try {
        let query = {};
        let employees = [];
        const { teamName } = req.query; // Check for teamName filter in query

        if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];

            // Build query for tasks
            const taskQuery = { $or: [{ assigneeEmail: { $in: employeeEmails } }, { teamName: { $in: teams.map(t => t.teamName) } }] };

            if (teamName) {
                // If filtering by a specific team, override or specify the teamName
                taskQuery.teamName = teamName;
                delete taskQuery.$or; // If teamName is specified, we only want tasks assigned to the team, not all individual tasks
            }
            query = taskQuery;

            employees = await collection.find({ email: { $in: employeeEmails } });
        } else if (req.session.userRole === "admin") {
            employees = await collection.find({ role: "employee" });
            if (teamName) {
                query = { teamName: teamName };
            }
        } else if (req.session.userRole === "employee") {
            // For employees, show their own tasks + teammate tasks as secondary
            const employee = await Employee.findOne({ email: req.session.userEmail });
            const employeeTeams = employee ? (employee.teams || []) : [];

            // Primary tasks: assigned directly to this employee
            const primaryTasks = await Task.find({ assigneeEmail: req.session.userEmail }).sort({ createdAt: -1 });

            // Secondary tasks: assigned to teammates (same team, different assignee)
            let secondaryTasks = [];
            if (employeeTeams.length > 0) {
                secondaryTasks = await Task.find({
                    teamName: { $in: employeeTeams },
                    assigneeEmail: { $ne: req.session.userEmail }
                }).sort({ createdAt: -1 });
            }

            employees = [];
            const allTasks = [...primaryTasks]; // Primary tasks for table display
            const options = '';
            return res.render("existingtasks", {
                options,
                tasks: allTasks,
                secondaryTasks,
                employees,
                userRole: req.session.userRole,
                userEmail: req.session.userEmail
            });
        } else {
            return res.status(403).send("Unauthorized");
        }

        const options = employees.map(emp => `<option value="${emp.email}">${emp.email}</option>`).join('');
        const allTasks = await Task.find(query).sort({ createdAt: -1 });
        res.render("existingtasks", { options, tasks: allTasks, secondaryTasks: [], employees, userRole: req.session.userRole });
    }
    catch (err) {
        console.error("Error fetching tasks", err)
        res.status(500).send("No tasks found");
    }
})

// Task Board - Kanban View
app.get("/taskboard", isAuthenticated, async (req, res) => {
    try {
        let tasks = [];
        const userRole = req.session.userRole;
        const userEmail = req.session.userEmail;

        if (userRole === "admin") {
            // Admin sees all tasks
            tasks = await Task.find({}).sort({ createdAt: -1 });
        } else if (userRole === "subadmin") {
            // Subadmin sees tasks from their teams
            const teams = await Team.find({ subadminEmail: userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            const teamNames = teams.map(t => t.teamName);
            tasks = await Task.find({
                $or: [
                    { assigneeEmail: { $in: employeeEmails } },
                    { teamName: { $in: teamNames } }
                ]
            }).sort({ createdAt: -1 });
        } else if (userRole === "employee") {
            // Employee sees their own tasks and team tasks
            const employee = await Employee.findOne({ email: userEmail });
            const employeeTeams = employee ? (employee.teams || []) : [];

            if (employeeTeams.length > 0) {
                tasks = await Task.find({
                    $or: [
                        { assigneeEmail: userEmail },
                        { teamName: { $in: employeeTeams } }
                    ]
                }).sort({ createdAt: -1 });
            } else {
                tasks = await Task.find({ assigneeEmail: userEmail }).sort({ createdAt: -1 });
            }
        } else {
            return res.status(403).send("Unauthorized");
        }

        // Group tasks by status
        const pendingTasks = tasks.filter(t => t.status === "Pending");
        const inProgressTasks = tasks.filter(t => t.status === "inprogress" || t.status === "In Progress");
        const completedTasks = tasks.filter(t => t.status === "completed" || t.status === "Completed");

        res.render("taskboard", {
            pendingTasks,
            inProgressTasks,
            completedTasks,
            user: { role: userRole, email: userEmail }
        });
    } catch (err) {
        console.error("Error loading task board", err);
        res.status(500).send("Error loading task board");
    }
});

app.get("/taskDetails/:id", isAuthenticated, async (req, res) => {
    try {
        const taskId = req.params.id;

        let findQuery = { _id: taskId };
        if (req.session.userRole === "employee") {
            findQuery.assigneeEmail = req.session.userEmail;
        } else if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            const teamNames = teams.map(t => t.teamName);

            findQuery.$or = [
                { assigneeEmail: { $in: employeeEmails } },
                { teamName: { $in: teamNames } }
            ];
        }

        const task = await Task.findOne(findQuery);

        if (!task) {
            return res.status(404).send("Task not found or unauthorized");
        }

        // Sort activity log by date, newest first
        if (task.activityLog) {
            task.activityLog.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
        }


        let employees = [];
        if (req.session.userRole === "admin") {
            employees = await collection.find({ role: "employee" });
        } else if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            employees = await collection.find({ email: { $in: employeeEmails } });
        }

        // Generate employee options for assignment dropdown (emp:email format for the update route)
        const employeeOptions = employees.map(emp => `<option value="emp:${emp.email}">${emp.name || emp.email}</option>`).join('');

        res.render("taskDetails", {
            task,
            employees,
            employeeOptions,
            userRole: req.session.userRole,
            userEmail: req.session.userEmail
        });
    } catch (err) {
        console.error("Error fetching task details", err);
        res.status(500).send("Error loading task details");
    }
})

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error logging out", err);
            return res.status(500).send("Logout failed");
        }
        res.redirect("/");
    });
});
// ROUTE TO UPDATE ASSIGNEE/TEAM
app.post("/update-assignee-team/:id", isAuthenticated, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { assignee } = req.body; // assignee will be in format "type:value" (e.g., "emp:email@emp.com" or "team:Team Name")

        if (!assignee) {
            return res.status(400).json({ success: false, message: "Assignee or Team is required." });
        }

        const [assignmentType, assignmentValue] = assignee.split(":");

        const updateData = {};
        let oldAssignee = ""; // To track changes in activity log

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }

        oldAssignee = task.assigneeEmail || task.teamName || "Unassigned";

        if (assignmentType === "emp") {
            // Assign to individual employee
            updateData.assigneeEmail = assignmentValue;
            updateData.teamName = null;
        } else if (assignmentType === "team") {
            // Assign to team
            updateData.assigneeEmail = null;
            updateData.teamName = assignmentValue;
        } else {
            return res.status(400).json({ success: false, message: "Invalid assignment type." });
        }

        await Task.findByIdAndUpdate(taskId, { $set: updateData });

        // Add to activity log (simplified)
        const newAssignee = updateData.assigneeEmail || updateData.teamName;
        const activity = {
            field: "Assignment",
            oldValue: oldAssignee,
            newValue: newAssignee,
            changedBy: req.session.userEmail,
        };
        await Task.findByIdAndUpdate(taskId, { $push: { activityLog: activity } });

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating assignee/team:", err);
        res.status(500).json({ success: false, message: "Failed to update assignment." });
    }
});

// ROUTE TO UPDATE STATUS (Quick status change from task details)
app.post("/update-status/:id", isAuthenticated, async (req, res) => {
    try {
        const taskId = req.params.id;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required." });
        }

        let findQuery = { _id: taskId };
        if (req.session.userRole === "employee") {
            findQuery.assigneeEmail = req.session.userEmail;
        } else if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            const teamNames = teams.map(t => t.teamName);
            findQuery.$or = [
                { assigneeEmail: { $in: employeeEmails } },
                { teamName: { $in: teamNames } }
            ];
        }
        // Admin can update any task (no additional filter)

        const task = await Task.findOne(findQuery);
        if (!task) {
            return res.status(404).json({ success: false, message: "Task not found or unauthorized." });
        }

        const oldStatus = task.status;

        // Update status
        await Task.findByIdAndUpdate(taskId, { $set: { status } });

        // Add to activity log
        if (oldStatus !== status) {
            const activity = {
                field: "Status",
                oldValue: oldStatus,
                newValue: status,
                changedBy: req.session.userEmail,
                changedAt: new Date()
            };
            await Task.findByIdAndUpdate(taskId, { $push: { activityLog: activity } });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating status:", err);
        res.status(500).json({ success: false, message: "Failed to update status." });
    }
});

app.get("/update-task/:id", isAuthenticated, async (req, res) => {
    try {
        const taskId = req.params.id;

        let findQuery = { _id: taskId };
        if (req.session.userRole === "employee") {
            findQuery.assigneeEmail = req.session.userEmail;
        } else if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            const teamNames = teams.map(t => t.teamName);

            findQuery.$or = [
                { assigneeEmail: { $in: employeeEmails } },
                { teamName: { $in: teamNames } }
            ];
        }

        const task = await Task.findOne(findQuery);

        if (!task) {
            return res.status(404).send("Task not found or unauthorized");
        }

        let employees = [];
        if (req.session.userRole === "admin") {
            employees = await collection.find({ role: "employee" });
        } else if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            employees = await collection.find({ email: { $in: employeeEmails } });
        }

        res.render("edit-task", { task, employees });
    } catch (err) {
        console.error("Error loading edit page", err);
        res.status(500).send("Error loading edit page");
    }
});

app.post("/update-task/:id", isAuthenticated, upload.single('image'), async (req, res) => {
    try {
        const { title, description, startDate, endDate, status, assigneeEmail } = req.body;
        const taskId = req.params.id;
        let findQuery = { _id: taskId };
        if (!title) {
            return res.status(400).send("Title is required");
        }

        if (req.session.userRole === "employee") {
            findQuery.assigneeEmail = req.session.userEmail;
        } else if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            const teamNames = teams.map(t => t.teamName);

            findQuery.$or = [
                { assigneeEmail: { $in: employeeEmails } },
                { teamName: { $in: teamNames } }
            ];
        }

        const oldTask = await Task.findOne(findQuery);
        if (!oldTask) {
            return res.status(404).send("Task not found or unauthorized");
        }

        // Check if new assignee is valid for this subadmin (only if assigneeEmail is provided)
        if (assigneeEmail && req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            if (!employeeEmails.includes(assigneeEmail)) {
                return res.status(403).send("Unauthorized: New assignee not in your teams");
            }
        }

        const updateData = {
            title,
            description,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            status: status || oldTask.status || "Pending"
        };

        // Only update assigneeEmail if provided
        if (assigneeEmail) {
            updateData.assigneeEmail = assigneeEmail;
        }

        // Track prior values so the UI can offer a rollback list
        const pushOps = {};
        if (oldTask.title !== title) {
            pushOps.titleHistory = { value: oldTask.title || "", changedAt: new Date() };
        }
        if (oldTask.description !== description) {
            pushOps.descriptionHistory = { value: oldTask.description || "", changedAt: new Date() };
        }

        // Build activity log entries
        const activityEntries = [];
        console.log("Update-task session:", req.session.userEmail);
        const changedBy = req.session.userEmail || "Unknown";

        if (oldTask.title !== title) {
            activityEntries.push({
                field: "Title",
                oldValue: oldTask.title || "Empty",
                newValue: title,
                changedBy,
                changedAt: new Date()
            });
        }
        if (oldTask.description !== description) {
            activityEntries.push({
                field: "Description",
                oldValue: oldTask.description ? (oldTask.description.substring(0, 50) + "...") : "Empty",
                newValue: description ? (description.substring(0, 50) + "...") : "Empty",
                changedBy,
                changedAt: new Date()
            });
        }
        if (oldTask.status !== status) {
            activityEntries.push({
                field: "Status",
                oldValue: oldTask.status,
                newValue: status,
                changedBy,
                changedAt: new Date()
            });
        }
        if (oldTask.assigneeEmail !== assigneeEmail) {
            activityEntries.push({
                field: "Assigned To",
                oldValue: oldTask.assigneeEmail,
                newValue: assigneeEmail,
                changedBy,
                changedAt: new Date()
            });
        }
        const oldStartDate = oldTask.startDate ? new Date(oldTask.startDate).toISOString().split('T')[0] : null;
        const newStartDate = startDate ? new Date(startDate).toISOString().split('T')[0] : null;
        if (oldStartDate !== newStartDate) {
            activityEntries.push({
                field: "Start Date",
                oldValue: oldStartDate || "Not set",
                newValue: newStartDate || "Not set",
                changedBy,
                changedAt: new Date()
            });
        }
        const oldEndDate = oldTask.endDate ? new Date(oldTask.endDate).toISOString().split('T')[0] : null;
        const newEndDate = endDate ? new Date(endDate).toISOString().split('T')[0] : null;
        if (oldEndDate !== newEndDate) {
            activityEntries.push({
                field: "End Date",
                oldValue: oldEndDate || "Not set",
                newValue: newEndDate || "Not set",
                changedBy,
                changedAt: new Date()
            });
        }
        if (req.file) {
            activityEntries.push({
                field: "Image",
                oldValue: oldTask.image ? "Image updated" : "No image",
                newValue: "New image uploaded",
                changedBy,
                changedAt: new Date()
            });
        }

        if (activityEntries.length > 0) {
            pushOps.activityLog = { $each: activityEntries };
        }

        // Delete old image if new one is provided
        if (req.file) {
            if (oldTask.image) {
                const oldImagePath = path.join(imgsDir, oldTask.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.image = req.file.filename;
            updateData.imageContentType = req.file.mimetype;
        }

        const updatePayload = { $set: updateData };
        if (Object.keys(pushOps).length) {
            updatePayload.$push = pushOps;
        }

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            updatePayload,
            { new: true }
        );

        if (req.file) {
            updateData.image = req.file.buffer;
            updateData.imageContentType = req.file.mimetype;
        }

        if (oldTask.assigneeEmail !== assigneeEmail) {
            await collection.updateOne(
                { email: oldTask.assigneeEmail },
                { $pull: { assignedTasks: taskId } }
            );

            await collection.updateOne(
                { email: assigneeEmail },
                { $addToSet: { assignedTasks: taskId } }
            );
        }

        res.json({ success: true, message: "Task updated successfully" });
    } catch (err) {
        console.error("Error updating task", err);
        res.status(500).json({ success: false, message: "Update failed", error: err.message });
    }
});

app.post("/delete-task/:id", isAuthenticated, async (req, res) => {
    try {
        const taskId = req.params.id;

        let findQuery = { _id: taskId };
        if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            const teamNames = teams.map(t => t.teamName);

            findQuery.$or = [
                { assigneeEmail: { $in: employeeEmails } },
                { teamName: { $in: teamNames } }
            ];
        } else if (req.session.userRole !== "admin") {
            return res.status(403).send("Unauthorized");
        }

        const task = await Task.findOne(findQuery);
        if (!task) {
            return res.status(404).send("Task not found or unauthorized");
        }

        // Delete image file if it exists
        if (task.image) {
            const imagePath = path.join(imgsDir, task.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await collection.updateOne(
            { email: task.assigneeEmail },
            { $pull: { assignedTasks: taskId } }
        );

        await Task.findByIdAndDelete(taskId);

        res.json({ success: true, message: "Task deleted successfully" });
    } catch (err) {
        console.error("Error deleting task", err);
        res.status(500).json({ success: false, message: "Delete failed", error: err.message });
    }
});

app.get("/team-tasks", isEmployee, async (req, res) => {
    try {
        const employee = await Employee.findOne({ email: req.session.userEmail });
        const employeeTeams = employee ? (employee.teams || []) : [];

        // Get all team members from the employee's current teams
        let teamMemberEmails = [];
        if (employeeTeams.length > 0) {
            const teams = await Team.find({ teamName: { $in: employeeTeams } });
            // Collect all unique employee emails from all teams
            const allTeamMembers = teams.flatMap(team => team.employees);
            teamMemberEmails = [...new Set(allTeamMembers)];
            // Remove current user from the list
            teamMemberEmails = teamMemberEmails.filter(email => email !== req.session.userEmail);
        }

        // Team member tasks: assigned to any current teammate
        let teamTasks = [];
        if (teamMemberEmails.length > 0) {
            teamTasks = await Task.find({
                assigneeEmail: { $in: teamMemberEmails }
            }).sort({ createdAt: -1 });
        }

        res.render("team-tasks", {
            tasks: teamTasks,
            userRole: req.session.userRole,
            userEmail: req.session.userEmail,
            teams: employeeTeams
        });
    } catch (err) {
        console.error("Error fetching team tasks", err);
        res.status(500).send("Error loading team tasks");
    }
});

// TEAM MESSAGE ROUTES (Employee to Employee in same team)
app.get("/team-message", isEmployee, async (req, res) => {
    try {
        const { teamName } = req.query; // Get teamName from query param

        if (!teamName) {
            // If no team specified, maybe they are in only one team?
            const employee = await Employee.findOne({ email: req.session.userEmail });
            const employeeTeams = employee ? (employee.teams || []) : [];
            if (employeeTeams.length === 1) {
                return res.redirect(`/team-message?teamName=${encodeURIComponent(employeeTeams[0])}`);
            }
            // Fetch team details for the selection view
            const teams = await Team.find({ teamName: { $in: employeeTeams } });
            return res.render("team-message", { teamName: null, messages: [], teamMembers: [], email: req.session.userEmail, availableTeams: teams });
        }

        // Verify the employee belongs to this team
        const team = await Team.findOne({ teamName, employees: req.session.userEmail });
        if (!team) {
            return res.status(403).send("Unauthorized: Not a member of this team.");
        }

        const teamMemberEmails = team.employees.filter(email => email !== req.session.userEmail);
        const teamMembers = await Employee.find({ email: { $in: teamMemberEmails } });

        const messages = await TeamMessage.find({ teamName }).sort({ createdAt: 1 });

        res.render("team-message", { teamName, messages, teamMembers, email: req.session.userEmail });

    } catch (err) {
        console.error("Error fetching team messages:", err);
        res.status(500).send("Error loading team chat");
    }
});

app.post("/team-message", isEmployee, async (req, res) => {
    try {
        const { message, teamName } = req.body;
        const employeeEmail = req.session.userEmail;

        if (!message || !teamName) {
            return res.status(400).send("Message and team name are required.");
        }

        // Verify sender is in the team
        const team = await Team.findOne({ teamName, employees: employeeEmail });
        if (!team) {
            return res.status(403).send("Unauthorized: Not a member of this team.");
        }

        await TeamMessage.create({
            teamName,
            senderEmail: employeeEmail,
            message
        });

        res.redirect(`/team-message?teamName=${encodeURIComponent(teamName)}`);
    } catch (err) {
        console.error("Error sending team message:", err);
        res.status(500).send("Failed to send message.");
    }
});

// ADMIN/SUBADMIN MESSAGE ROUTES
app.get("/admin-subadmin-chat", isAuthenticated, async (req, res) => {
    try {
        if (req.session.userRole !== "admin" && req.session.userRole !== "subadmin") {
            return res.status(403).send("Unauthorized: Admin or Subadmin access required.");
        }

        const userRole = req.session.userRole;
        const channel = req.query.channel || "general"; // "general" or specific subadmin email

        let query = {};

        if (userRole === "admin") {
            if (channel === "general") {
                // General channel: messages sent to "all" (receiverEmail = "all@subadmin.com")
                query = {
                    $or: [
                        { receiverEmail: "all@subadmin.com" },
                        { senderEmail: req.session.userEmail, receiverEmail: "all@subadmin.com" }
                    ]
                };
            } else {
                // Specific subadmin chat
                query = {
                    $or: [
                        { senderEmail: req.session.userEmail, receiverEmail: channel },
                        { senderEmail: channel, receiverEmail: req.session.userEmail }
                    ]
                };
            }
        } else if (userRole === "subadmin") {
            if (channel === "general") {
                // General channel: messages from admin to all
                query = { receiverEmail: "all@subadmin.com" };
            } else {
                // Direct chat with admin
                query = {
                    $or: [
                        { senderEmail: req.session.userEmail, receiverEmail: { $regex: "@admin\\.com$" } },
                        { senderEmail: { $regex: "@admin\\.com$" }, receiverEmail: req.session.userEmail }
                    ]
                };
            }
        }

        const messages = await AdminSubadminMessage.find(query).sort({ createdAt: 1 });

        // Fetch all subadmins for the admin to select
        let subadmins = [];
        if (userRole === "admin") {
            subadmins = await collection.find({ role: "subadmin" });
        }

        res.render("admin-subadmin-chat", {
            messages,
            userRole,
            userEmail: req.session.userEmail,
            subadmins,
            currentChannel: channel
        });

    } catch (err) {
        console.error("Error fetching admin/subadmin chat:", err);
        res.status(500).send("Error loading admin/subadmin chat");
    }
});

app.post("/admin-subadmin-chat", isAuthenticated, async (req, res) => {
    try {
        if (req.session.userRole !== "admin" && req.session.userRole !== "subadmin") {
            return res.status(403).send("Unauthorized: Admin or Subadmin access required.");
        }

        const { message, receiverEmail, channel } = req.body;
        const senderEmail = req.session.userEmail;
        const userRole = req.session.userRole;

        if (!message || !receiverEmail) {
            return res.status(400).send("Message and receiver are required.");
        }

        // For general channel, use special receiver email
        const actualReceiver = receiverEmail === "general" ? "all@subadmin.com" : receiverEmail;

        // Validation for subadmin
        if (userRole === "subadmin" && actualReceiver !== "all@subadmin.com") {
            const receiver = await collection.findOne({ email: actualReceiver });
            if (!receiver || receiver.role !== "admin") {
                return res.status(403).send("Subadmins can only send messages in General or to Admin.");
            }
        }

        await AdminSubadminMessage.create({
            senderEmail,
            receiverEmail: actualReceiver,
            message
        });

        // Redirect back to the channel
        const redirectChannel = channel || "general";
        res.redirect(`/admin-subadmin-chat?channel=${encodeURIComponent(redirectChannel)}`);
    } catch (err) {
        console.error("Error sending admin/subadmin message:", err);
        res.status(500).send("Failed to send message.");
    }
});


// Team Management Routes
app.get("/view-teammgmt", isAdmin, async (req, res) => {
    try {
        const subadmins = await collection.find({ role: "subadmin" });
        const employees = await collection.find({ role: "employee" });
        const teams = await Team.find();

        res.render("view-teammgmt", {
            subadmins,
            employees,
            teams
        });
    } catch (err) {
        console.error("Error fetching team management data", err);
        res.status(500).send("Error loading team management page");
    }
});

app.post("/create-team", isAdmin, async (req, res) => {
    try {
        const { teamName, subadminEmail, employees } = req.body;
        // Basic validation
        if (!teamName || !subadminEmail) {
            return res.status(400).send("Team name and Sub-Admin are required");
        }

        // Check if team name already exists
        const existingTeam = await Team.findOne({ teamName });
        if (existingTeam) {
            return res.status(400).send("Team name already exists");
        }

        // Validate subadmin exists
        const subadmin = await collection.findOne({ email: subadminEmail, role: "subadmin" });
        if (!subadmin) {
            return res.status(404).send("Sub-admin not found");
        }

        // Validate employees exist
        const employeeEmails = Array.isArray(employees) ? employees : [employees];
        const validEmployees = await collection.find({
            email: { $in: employeeEmails },
            role: "employee"
        });

        if (validEmployees.length !== employeeEmails.length) {
            return res.status(404).send("Some employees not found");
        }

        // Create team
        const team = await Team.create({
            teamName,
            subadminEmail,
            employees: employeeEmails
        });

        res.redirect("/view-teammgmt");
    } catch (err) {
        console.error("Error creating team", err);
        res.status(500).send("Failed to create team");
    }
})

app.get("/edit-team/:id", isAdmin, async (req, res) => {
    try {
        const teamId = req.params.id;
        const team = await Team.findById(teamId);
        const subadmins = await collection.find({ role: "subadmin" });
        const employees = await collection.find({ role: "employee" });

        if (!team) {
            return res.status(404).send("Team not found");
        }

        res.render("edit-team", { team, subadmins, employees });
    } catch (err) {
        console.error("Error fetching team for edit", err);
        res.status(500).send("Error loading team");
    }
})

app.post("/update-team/:id", isAdmin, async (req, res) => {
    try {
        const teamId = req.params.id;
        const { teamName, subadminEmail, employees } = req.body;

        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).send("Team not found");
        }

        // Validate subadmin exists
        const subadmin = await collection.findOne({ email: subadminEmail, role: "subadmin" });
        if (!subadmin) {
            return res.status(404).send("Sub-admin not found");
        }

        // Validate employees exist
        const employeeEmails = Array.isArray(employees) ? employees : [employees];
        const validEmployees = await collection.find({
            email: { $in: employeeEmails },
            role: "employee"
        });

        if (validEmployees.length !== employeeEmails.length) {
            return res.status(404).send("Some employees not found");
        }

        // Update team
        await Team.findByIdAndUpdate(teamId, {
            teamName,
            subadminEmail,
            employees: employeeEmails
        });

        res.redirect("/view-teammgmt");
    } catch (err) {
        console.error("Error updating team", err);
        res.status(500).send("Failed to update team");
    }
})

app.get("/delete-team/:id", isAdmin, async (req, res) => {
    try {
        const teamId = req.params.id;
        await Team.findByIdAndDelete(teamId);
        res.redirect("/view-teammgmt");
    } catch (err) {
        console.error("Error deleting team", err);
        res.status(500).send("Failed to delete team");
    }
})


// Quick status update endpoint
app.post("/update-status/:id", async (req, res) => {
    try {
        const { status } = req.body;
        const taskId = req.params.id;

        if (!status) {
            return res.status(400).json({ error: "Status is required" });
        }

        const oldTask = await Task.findById(taskId);
        if (!oldTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        console.log("Update-status session:", req.session.userEmail);
        const changedBy = req.session.userEmail || "Unknown";
        const activityEntry = {
            field: "Status",
            oldValue: oldTask.status,
            newValue: status,
            changedBy,
            changedAt: new Date()
        };

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            {
                status,
                $push: { activityLog: activityEntry }
            },
            { new: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        res.json({ success: true, task: updatedTask });
    } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ error: "Failed to update status" });
    }
});

// Quick assignee update endpoint
app.post("/update-assignee/:id", async (req, res) => {
    try {
        const { assigneeEmail } = req.body;
        const taskId = req.params.id;

        if (!assigneeEmail) {
            return res.status(400).json({ error: "Assignee email is required" });
        }

        const oldTask = await Task.findById(taskId);
        if (!oldTask) {
            return res.status(404).json({ error: "Task not found" });
        }

        console.log("Update-assignee session:", req.session.userEmail);
        const changedBy = req.session.userEmail || "Unknown";
        const activityEntry = {
            field: "Assignee",
            oldValue: oldTask.assigneeEmail,
            newValue: assigneeEmail,
            changedBy,
            changedAt: new Date()
        };

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            {
                assigneeEmail,
                $push: { activityLog: activityEntry }
            },
            { new: true }
        );

        // Update user task assignments
        if (oldTask.assigneeEmail !== assigneeEmail) {
            await collection.updateOne(
                { email: oldTask.assigneeEmail },
                { $pull: { assignedTasks: taskId } }
            );

            await collection.updateOne(
                { email: assigneeEmail },
                { $addToSet: { assignedTasks: taskId } }
            );
        }

        res.json({ success: true, task: updatedTask });
    } catch (error) {
        console.error("Error updating assignee:", error);
        res.status(500).json({ error: "Failed to update assignee" });
    }
});

// Example route handler
app.get('/task/:id', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id); // or your DB fetch logic
        if (!task) {
            return res.status(404).send('Task not found');
        }
        res.render('emptaskDetails', { task, /* other variables if needed */ });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});