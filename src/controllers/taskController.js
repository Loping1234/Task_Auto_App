// src/controllers/taskController.js
const collection = require("../config");
const Task = require("../../models/task");
const Team = require("../../models/team");
const Employee = require("../../models/employee");
const Notification = require("../../models/notification");

// Helper function to get teammate emails
async function getTeammateEmails(teams, excludeEmail) {
    const teammateTeams = await Team.find({ teamName: { $in: teams } });
    const allEmails = [...new Set(teammateTeams.flatMap(t => t.employees))];
    return allEmails.filter(e => e !== excludeEmail);
}

const getAllTasks = async (req, res) => {
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

        const tasks = await Task.find(query).sort({ createdAt: -1 });
        res.json({ tasks });
    } catch (err) {
        console.error("Get tasks error", err);
        res.status(500).json({ message: "Error loading tasks" });
    }
};

const createTask = async (req, res) => {
    try {
        const { title, description, startDate, endDate, status, assigneeEmail, teamName } = req.body;
        const { role } = req.user;

        if (role === 'employee') {
            // Optional: Add validation logic here
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
                const assignee = await collection.findOne({ email: assigneeEmail });
                if (assignee && assignee._id.toString() !== req.user.id) {
                    await Notification.create({
                        recipient: assignee._id,
                        sender: req.user.id,
                        task: task._id,
                        message: `You have been assigned a new task: "${title}" by ${req.user.email}`,
                        type: 'assignment',
                        priority: 'primary',
                        category: 'assignment'
                    });
                }
            } catch (notifErr) {
                console.error("[NOTIFICATION ERROR]:", notifErr);
            }
        }

        res.status(201).json({ task, message: "Task created successfully" });
    } catch (err) {
        console.error("Create task error", err);
        res.status(500).json({ message: "Failed to create task" });
    }
};

const updateAssignee = async (req, res) => {
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
};

const getTeamTasks = async (req, res) => {
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
};

const getTask = async (req, res) => {
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
};

const updateTask = async (req, res) => {
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
};

const updateStatus = async (req, res) => {
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

            if (req.user.role === 'employee') {
                try {
                    const recipients = new Set();

                    if (task.teamName) {
                        const team = await Team.findOne({ teamName: task.teamName });
                        if (team && team.subadminEmail) {
                            const subadmin = await collection.findOne({ email: team.subadminEmail });
                            if (subadmin) recipients.add(subadmin._id.toString());
                        }
                    }

                    const admins = await collection.find({ role: 'admin' });
                    admins.forEach(a => recipients.add(a._id.toString()));

                    const uniqueRecipients = Array.from(recipients);
                    if (uniqueRecipients.length > 0) {
                        try {
                            const notifPromises = uniqueRecipients.map(recipientId => {
                                return Notification.create({
                                    recipient: recipientId,
                                    sender: req.user.id,
                                    task: task._id,
                                    message: `Task "${task.title}" status updated to ${status} by ${req.user.email}`,
                                    type: 'status_change',
                                    priority: 'primary',
                                    category: 'status_change'
                                });
                            });
                            await Promise.all(notifPromises);
                        } catch (innerErr) {
                            console.error("Inner notification error", innerErr);
                        }
                    }
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
};

const deleteTask = async (req, res) => {
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
};

const addComment = async (req, res) => {
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
};

module.exports = {
    getAllTasks,
    createTask,
    updateAssignee,
    getTeamTasks,
    getTask,
    updateTask,
    updateStatus,
    deleteTask,
    addComment
};
