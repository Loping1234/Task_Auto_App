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
const upload = multer({storage:storage});
app.use('/fontawesome', express.static('node_modules/@fortawesome/fontawesome-free'));
app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(session({
    secret: 'thisisarandomkey',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

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
        if (req.session.userRole === "subadmin") {
            return res.redirect("/subadmin-dashboard");
        } else if (req.session.userRole === "employee") {
            return res.redirect("/emp-dashboard");
        }
        else{
            return res.redirect("/admin-dashboard");
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
        const data = {
            email: req.body.email,
            password: hashedPassword,
            role: domain === "subadmin.com" ? "subadmin" : "employee"
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
    try{
        const user = await collection.findOne({ email: req.body.email });
        if(!user){
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
                if (domain === "emp.com"){
                    res.redirect("/emp-dashboard");
                }
                else if (domain === "subadmin.com"){
                    res.redirect("/subadmin-dashboard");
                }
                else if(domain === "admin.com"){
                    res.redirect("/admin-dashboard");
                }
            });
        }
        else{
            res.status(401).send("Invalid password");
        }
    }
    catch  (err) {
        console.error("Login error", err);
        res.status(500).send("Login failed");
    }
});

app.get("/subadmin-dashboard", isSubadmin, async (req, res) =>{
    try{
        // Get teams assigned to this subadmin
        const teams = await Team.find({ subadminEmail: req.session.userEmail });
        const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
        
        const employees = await collection.find({
            email: { $in: employeeEmails }
        });
        const options = employees.map(emp=> `<option value="${emp.email}">${emp.email}</option>`).join('');
        const allTasks = await Task.find({ $or: [{ assigneeEmail: { $in: employeeEmails } }, { teamName: { $in: teams.map(t => t.teamName) } }] }).sort({ createdAt: -1});
        const empCount = employees.length;
        const emp_names = employees.map(emp => emp.email);
        const taskCount = allTasks.length;
        const task_names = allTasks.map(task => task.title)
        res.render("subadmin", {options, teams, tasks:allTasks, emp: empCount, employees, taskCount, task_names, emp_names});
    }
    catch(err){
        console.error("Error fetching subadmin dashboard data", err)
        res.status(500).send("Error loading subadmin dashboard");
    }
})

app.get("/view-emp", isAuthenticated, async (req, res) =>{
    try{
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
        res.render("viewemps", {employee, userRole: req.session.userRole});
        }
    catch(err){
        console.error("Error fetching employees", err);
        res.status(500).send("Error loading employees");
    }
})

app.get("/viewsubadm", isAdmin, async (req, res) =>{
    try{
        const subadmins = await collection.find({
            role: "subadmin"
        })
        res.render("viewsubadm", {subadmins});
        }
    catch(err){
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

app.get("/assign", isSubadmin, async (req, res) => {
    try {
        const teams = await Team.find({ subadminEmail: req.session.userEmail });
        const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
        
        const employees = await collection.find({
            email: { $in: employeeEmails }
        });
        const options = employees.map(emp=> `<option value="${emp.email}">Employee: ${emp.email}</option>`).join('');
        const teamOptions = teams.map(team => `<option value="${team.teamName}">Team: ${team.teamName}</option>`).join('');
        
        res.render("assign", { options, teamOptions });
    } catch (err) {
        console.error("Error loading assign page", err);
        res.status(500).send("Error loading assign page");
    }
});

app.post("/assign", isSubadmin, upload.single('image'), async (req, res) => {
    try{
        const { title, description, startDate, endDate, status, assigneeEmail, teamName } = req.body;
        
        // Validation: Must have a title and either an individual assignee or a team
        if (!title || (!assigneeEmail && !teamName)) {
            return res.status(400).send("Title and either an assignee or a team are required");
        }
        
        // Fetch the subadmin's teams for authorization
        const subadminTeams = await Team.find({ subadminEmail: req.session.userEmail });
        const subadminTeamNames = subadminTeams.map(t => t.teamName);

        // Authorization checks
        if (assigneeEmail) {
            const employeeEmails = [...new Set(subadminTeams.flatMap(team => team.employees))];
            if (!employeeEmails.includes(assigneeEmail)) {
                return res.status(403).send("Unauthorized: Employee not in your teams");
            }
        }
        
        if (teamName) {
            if (!subadminTeamNames.includes(teamName)) {
                return res.status(403).send("Unauthorized: Team is not managed by you");
            }
        }

        const taskData = {
            title,
            description,
            image: req.file ? req.file.filename : null,
            imageContentType: req.file ? req.file.mimetype : null,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            status: status || "Pending",
            assigneeEmail: assigneeEmail || null, // Individual assignment
            teamName: teamName || null // Team assignment
        };

        const task = await Task.create(taskData);

        // Update employee's assignedTasks only if it's an individual assignment (not strictly necessary for employee model update, but keeping existing logic)
        // If it's a team task, we don't update individual employee tasks here, as they see it via their teamName.
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
    catch(err){
        console.error("Error assigning tasks", err)
        res.status(500).send("Assigning failed");
    }
})

app.get("/task-img/:id", async (req, res) =>{
    try{
        const task = await Task.findById(req.params.id);
        if (!task || !task.image){
            return res.status(404).send("Image not found");
        }
        const imagePath = path.join(imgsDir, task.image);
        if (!fs.existsSync(imagePath)) {
            return res.status(404).send("Image file not found");
        }
        res.sendFile(imagePath);
    }
    catch(err){
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

app.get('/emptaskComment/:id', async(req, res) => {
    const id = req.params.id;
    const employees = await collection.find({
        $or: [
            { role: "employee" },
            { email: { $regex: "@emp\\.com$" } }
        ]
    });
    const options = employees.map(emp=> `<option value="${emp.email}">${emp.email}</option>`).join('');
    const allTasks = await Task.find().sort({ createdAt: -1});
    res.render("emptaskComment", {options, tasks:allTasks, employees}); 
  });
  

app.get("/existingtasks", isAuthenticated, async (req, res) =>{
    try{
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
            // For employees, show their individual tasks by default. 
            // If teamName is provided, show team tasks for that team.
            if (teamName) {
                 // Security check: ensure employee is in the team
                 const team = await Team.findOne({ teamName, employees: req.session.userEmail });
                 if (!team) return res.status(403).send("Unauthorized");
                 query = { teamName: teamName };
            } else {
                 query = { assigneeEmail: req.session.userEmail };
            }
            employees = []; // Not needed for employee view
        } else {
            return res.status(403).send("Unauthorized");
        }

        const options = employees.map(emp=> `<option value="${emp.email}">${emp.email}</option>`).join('');
        const allTasks = await Task.find(query).sort({ createdAt: -1});
        res.render("existingtasks", {options, tasks:allTasks, employees, userRole: req.session.userRole});        
    }
    catch (err){
        console.error("Error fetching tasks", err)
        res.status(500).send("No tasks found");
    }
})

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
        let teams = []; // Declare teams variable
        if (req.session.userRole === "admin") {
            employees = await collection.find({ role: "employee" });
            teams = await Team.find(); // Fetch all teams for admin
        } else if (req.session.userRole === "subadmin") {
            teams = await Team.find({ subadminEmail: req.session.userEmail }); // Fetch managed teams
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            employees = await collection.find({ email: { $in: employeeEmails } });
        }
        
        // Generate combined options for assignment dropdown
        const employeeOptions = employees.map(emp=> `<option value="emp:${emp.email}">Employee: ${emp.email}</option>`).join('');
        const teamOptions = teams.map(team => `<option value="team:${team.teamName}">Team: ${team.teamName}</option>`).join('');

        res.render("taskDetails", { 
            task, 
            employees, // Keep employees for original purpose if needed
            employeeOptions,
            teamOptions,
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

        if (!title || !assigneeEmail) {
            return res.status(400).send("Title and assignee are required");
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

        const oldTask = await Task.findOne(findQuery);
        if (!oldTask) {
            return res.status(404).send("Task not found or unauthorized");
        }

        // Check if new assignee is valid for this subadmin
        if (req.session.userRole === "subadmin") {
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
            status: status || "Pending",
            assigneeEmail
        };

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

        res.redirect("/existingtasks");
    } catch (err) {
        console.error("Error updating task", err);
        res.status(500).send("Update failed");
    }
});

app.post("/delete-task/:id", isAuthenticated, async (req, res) => {
    try {
        const taskId = req.params.id;
        
        let findQuery = { _id: taskId };
        if (req.session.userRole === "subadmin") {
            const teams = await Team.find({ subadminEmail: req.session.userEmail });
            const employeeEmails = [...new Set(teams.flatMap(team => team.employees))];
            findQuery.assigneeEmail = { $in: employeeEmails };
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

        res.redirect("/existingtasks");
    } catch (err) {
        console.error("Error deleting task", err);
        res.status(500).send("Delete failed");
    }
});

app.get("/emp-dashboard", isEmployee, async (req, res) => {
    try {
        let employee = await Employee.findOne({ email: req.session.userEmail });
        
        // If employee document doesn't exist (legacy users), create it
        if (!employee) {
            employee = await Employee.create({
                name: req.session.userEmail.split("@")[0],
                email: req.session.userEmail,
                password: "password_placeholder"
            });
        }
        
        const employeeTeams = employee.teams || [];
        // Support legacy single teamName field if it exists
        if (employee.teamName && !employeeTeams.includes(employee.teamName)) {
            employeeTeams.push(employee.teamName);
        }

        const individualTasks = await Task.find({ assigneeEmail: req.session.userEmail });
        const teamTasks = await Task.find({ teamName: { $in: employeeTeams } });
        
        res.render("employee", { 
            email: req.session.userEmail, 
            individualTaskCount: individualTasks.length,
            teamTaskCount: teamTasks.length,
            teams: employeeTeams // Pass just the names for sidebar or reference
        });
    } catch (err) {
        console.error("Error fetching tasks", err);
        res.status(500).send("Error loading employee dashboard");
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
        
        // Fetch all messages involving the current user's email or the admin email
        const messages = await AdminSubadminMessage.find({
            $or: [
                { senderEmail: req.session.userEmail },
                { receiverEmail: req.session.userEmail },
                // Allow subadmins to see messages from admin to other subadmins as a shared channel
                // We'll define the admin email as 'admin@admin.com' or assume it's in the collection with role 'admin'
                { senderEmail: { $regex: "@admin\.com$" }, receiverEmail: { $regex: "@subadmin\.com$" } } 
            ]
        }).sort({ createdAt: 1 });
        
        // Fetch all subadmins for the admin to select
        let subadmins = [];
        if (userRole === "admin") {
            subadmins = await collection.find({ role: "subadmin" });
        }
        
        res.render("admin-subadmin-chat", { messages, userRole, userEmail: req.session.userEmail, subadmins });
        
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

        const { message, receiverEmail } = req.body;
        const senderEmail = req.session.userEmail;
        const userRole = req.session.userRole;

        if (!message || !receiverEmail) {
            return res.status(400).send("Message and receiver are required.");
        }
        
        // Basic role validation: Admin can only send to subadmin/admin. Subadmin can only send to admin.
        const receiver = await collection.findOne({ email: receiverEmail });
        
        if (!receiver && receiverEmail !== "admin@admin.com") { // Assuming "admin@admin.com" is a constant
            return res.status(404).send("Receiver not found.");
        }
        
        if (userRole === "subadmin" && receiverEmail.split("@")[1] !== "admin.com") {
             return res.status(403).send("Subadmins can only send messages to the Admin.");
        }

        if (userRole === "admin" && receiver.role !== "subadmin" && receiver.role !== "admin") {
            return res.status(403).send("Admin can only send messages to other Admins or Subadmins.");
        }

        await AdminSubadminMessage.create({
            senderEmail,
            receiverEmail,
            message
        });

        res.redirect("/admin-subadmin-chat");
    } catch (err) {
        console.error("Error sending admin/subadmin message:", err);
        res.status(500).send("Failed to send message.");
    }
});

app.get("/admin-dashboard", isAdmin, async (req, res) => {
    try {
        const subadmins = await collection.find({ role: "subadmin" });
        const employees = await collection.find({ role: "employee" });
        const allTasks = await Task.find().sort({ createdAt: -1});
        const teams = await Team.find(); 
        
        const subadminCount = subadmins.length;
        const empCount = employees.length;
        const taskCount = allTasks.length;
        const teamCount = teams.length;
        
        res.render("admin-dashboard", { 
            subadmins, 
            employees,
            subadminCount, 
            empCount, 
            taskCount,
            teamCount
        });
    } catch (err) {
        console.error("Error fetching admin data", err);
        res.status(500).send("Error loading admin dashboard");
    }
})

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