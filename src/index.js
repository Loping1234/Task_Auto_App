const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const collection = require("./config");
const Task = require("../models/task");
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

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

// Middleware to check if user is already logged in (for login/signup pages)
const isAlreadyAuthenticated = (req, res, next) => {
    if (req.session.userEmail) {
        if (req.session.userRole === "admin") {
            return res.redirect("/admin-dashboard");
        } else if (req.session.userRole === "employee") {
            return res.redirect("/emp-dashboard");
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
            role: domain === "admin.com" ? "admin" : "employee"
        };
        const userdata = await collection.create(data);
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
                else if (domain === "admin.com"){
                    res.redirect("/admin-dashboard");
                }
                else{
                    res.redirect("/dashboard");
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

app.get("/admin-dashboard", isAuthenticated, async (req, res) =>{
    try{
        const employees = await collection.find({
            $or: [
                { role: "employee" },
                { email: { $regex: "@emp\\.com$" } }
            ]
        });
        const options = employees.map(emp=> `<option value="${emp.email}">${emp.email}</option>`).join('');
        const allTasks = await Task.find().sort({ createdAt: -1});
        const emp = employees.length;
        const emp_names = employees.map(emp => emp.email);
        const taskCount = allTasks.length;
        const task_names = allTasks.map(taskCount => taskCount.title)
        res.render("admin", {options, tasks:allTasks, emp, employees, taskCount, task_names, emp_names});
    }
    catch(err){
        console.error("Error fetching employees", err)
        res.status(500).send("Error loading admin dashboard");
    }
})

app.get("/view-emp", isAuthenticated, async (req, res) =>{
    try{
        const employee = await collection.find({
            $or: [
                {role: "employee"},
                {email: {$regex: "@emp\\.com$"}}
            ]
        })
        res.render("viewemps", {employee});
        }
    catch(err){
        console.error("Error fetching employees", err);
        res.status(500).send("Error loading employees");
    }
})

app.get("/assign", isAuthenticated, async (req, res) => {
    try {
        const employees = await collection.find({
            $or: [
                { role: "employee" },
                { email: { $regex: "@emp\\.com$" } }
            ]
        });
        const options = employees.map(emp=> `<option value="${emp.email}">${emp.email}</option>`).join('');
        res.render("assign", { options });
    } catch (err) {
        console.error("Error loading assign page", err);
        res.status(500).send("Error loading assign page");
    }
});

app.post("/assign", upload.single('image'), async (req, res) => {
    try{
        const { title, description, startDate, endDate, status, assigneeEmail } = req.body;
        if (!title || !assigneeEmail) {
            return res.status(400).send("Title and assignee are required");
        }
        const assignee = await collection.findOne({ email: assigneeEmail, role: "employee" });
        if (!assignee) {
            return res.status(404).send("Assignee not found");
        }

        const task = await Task.create({
            title,
            description,
            image: req.file ? req.file.filename : null,
            imageContentType: req.file ? req.file.mimetype : null,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            status: status || "Pending",
            assigneeEmail
        });

        assignee.assignedTasks = Array.isArray(assignee.assignedTasks) ? assignee.assignedTasks : [];
        assignee.assignedTasks.push(task._id);
        await assignee.save();

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

app.get('/emptaskDetails/:id', async (req, res) => {
    try {
      const taskId = req.params.id;
      const task = await Task.findById(taskId);
      const employees = await collection.find({
        $or: [
          { role: "employee" },
          { email: { $regex: "@emp\\.com$" } }
        ]
      });
      if (!task) {
        return res.status(404).send('Task not found');
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
        const employees = await collection.find({
            $or: [
                { role: "employee" },
                { email: { $regex: "@emp\\.com$" } }
            ]
        });
        const options = employees.map(emp=> `<option value="${emp.email}">${emp.email}</option>`).join('');
        const allTasks = await Task.find().sort({ createdAt: -1});
        res.render("existingtasks", {options, tasks:allTasks, employees});        
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
        // Employee can only view tasks assigned to them
        if (req.session.userRole === "employee") {
            findQuery.assigneeEmail = req.session.userEmail;
        }

        const task = await Task.findOne(findQuery);
        
        if (!task) {
            return res.status(404).send("Task not found or unauthorized");
        }

        // Sort activity log by date, newest first
        if (task.activityLog) {
            task.activityLog.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
        }
        
        const employees = await collection.find({
            $or: [
                { role: "employee" },
                { email: { $regex: "@emp\\.com$" } }
            ]
        });
        
        res.render("taskDetails", { 
            task, 
            employees, 
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

app.get("/update-task/:id", isAuthenticated, async (req, res) => {
    try {
        const taskId = req.params.id;
        
        let findQuery = { _id: taskId };
        // Employee can only view tasks assigned to them
        if (req.session.userRole === "employee") {
            findQuery.assigneeEmail = req.session.userEmail;
        }

        const task = await Task.findOne(findQuery);
        
        if (!task) {
            return res.status(404).send("Task not found or unauthorized");
        }

        const employees = await collection.find({
            $or: [
                { role: "employee" },
                { email: { $regex: "@emp\\.com$" } }
            ]
        });
        
        res.render("edit-task", { task, employees });
    } catch (err) {
        console.error("Error loading edit page", err);
        res.status(500).send("Error loading edit page");
    }
});

app.post("/update-task/:id", upload.single('image'), async (req, res) => {
    try {
        const { title, description, startDate, endDate, status, assigneeEmail } = req.body;
        const taskId = req.params.id;

        if (!title || !assigneeEmail) {
            return res.status(400).send("Title and assignee are required");
        }

        const oldTask = await Task.findById(taskId);
        if (!oldTask) {
            return res.status(404).send("Task not found");
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

app.post("/delete-task/:id", async (req, res) => {
    try {
        const taskId = req.params.id;
        
        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).send("Task not found");
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

app.get("/emp-dashboard", isAuthenticated, async (req, res) => {
    try {
        const tasks = await Task.find({ assigneeEmail: req.session.userEmail });
        res.render("employee", { tasks, email: req.session.userEmail });
    } catch (err) {
        console.error("Error fetching tasks", err);
        res.status(500).send("Error loading employee dashboard");
    }
});

app.get("/dashboard", (req, res) => {
    res.render("home");
});

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
