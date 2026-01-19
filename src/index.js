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
app.set('view engine', 'ejs');
app.use(express.static("public"));
app.get("/", (req, res) => {
    res.render("login");
});

app.get("/signup", (req, res) => {
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


app.get("/login", (req, res) => {
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

app.get("/admin-dashboard", async (req, res) =>{
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

app.get("/view-emp", async (req, res) =>{
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

app.get("/assign", async (req, res) => {
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

        res.redirect("/admin-dashboard");
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

app.get("/existingtasks", async (req, res) =>{
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

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error logging out", err);
            return res.status(500).send("Logout failed");
        }
        res.redirect("/");
    });
});

app.get("/update-task/:id", async (req, res) => {
    try {
        const taskId = req.params.id;
        const task = await Task.findById(taskId);
        
        if (!task) {
            return res.status(404).send("Task not found");
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

        const updatedTask = await Task.findByIdAndUpdate(
            taskId,
            updateData,
            {
                title,
                description,
                image: req.file ? req.file.buffer : null,
                imageContentType: req.file ? req.file.mimetype : null,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                status: status || "Pending",
                assigneeEmail
            },
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

app.get("/emp-dashboard", async (req, res) => {
    try {
        if (!req.session.userEmail) {
            return res.redirect("/login");
        }
        
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


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});