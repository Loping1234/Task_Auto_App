const Project = require("../../models/project");

// Helper: Compute project status from its tasks' statuses
const computeProjectStatus = (project) => {
    if (!project.tasks || project.tasks.length === 0) {
        return { status: "N/A", progress: 0, breakdown: {} };
    }

    const statuses = project.customStatuses || [];
    const maxOrder = statuses.length > 0 ? Math.max(...statuses.map(s => s.order)) : 1;

    let totalProgress = 0;
    const breakdown = {};

    project.tasks.forEach(task => {
        const taskStatus = task.status || "N/A";
        breakdown[taskStatus] = (breakdown[taskStatus] || 0) + 1;

        // Find the custom status order for this task's status
        const customStatus = statuses.find(s => s.label === taskStatus);
        if (customStatus) {
            totalProgress += (customStatus.order / maxOrder) * 100;
        }
    });

    const progress = Math.round(totalProgress / project.tasks.length);

    // Determine overall status label
    let status = "In Progress";
    if (progress === 0) status = "N/A";
    else if (progress === 100) status = "Completed";
    else if (progress <= 25) status = "Just Started";

    return { status, progress, breakdown };
};

// CREATE PROJECT (Admin only)
const createProject = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can create projects" });
        }

        const { projectName, description, customStatuses } = req.body;

        const existing = await Project.findOne({ projectName });
        if (existing) {
            return res.status(400).json({ message: "A project with this name already exists" });
        }

        // Default statuses if none provided
        const defaultStatuses = [
            { label: "To Do", order: 1, color: "#6b7280" },
            { label: "In Progress", order: 2, color: "#3b82f6" },
            { label: "Review", order: 3, color: "#f59e0b" },
            { label: "Completed", order: 4, color: "#10b981" }
        ];

        const project = new Project({
            projectName,
            description: description || "",
            createdBy: req.user.id,
            customStatuses: customStatuses || defaultStatuses
        });

        await project.save();
        res.status(201).json({ message: "Project created successfully", project });
    } catch (err) {
        console.error("Create project error", err);
        res.status(500).json({ message: "Failed to create project" });
    }
};

// GET ALL PROJECTS (Admin: all, Subadmin: assigned only)
const getAllProjects = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === "subadmin") {
            query = { assignedSubadmins: req.user.id };
        } else if (req.user.role === "employee") {
            query = { employees: req.user.id };
        }

        const projects = await Project.find(query)
            .populate("createdBy", "fullName email")
            .populate("assignedSubadmins", "fullName email")
            .populate("employees", "fullName email")
            .populate("tasks", "title status assigneeEmail startDate endDate")
            .sort({ createdAt: -1 });

        // Add computed status to each project
        const projectsWithStatus = projects.map(p => {
            const proj = p.toObject();
            const { status, progress, breakdown } = computeProjectStatus(proj);
            return { ...proj, computedStatus: status, progress, statusBreakdown: breakdown };
        });

        res.json({ projects: projectsWithStatus });
    } catch (err) {
        console.error("Get all projects error", err);
        res.status(500).json({ message: "Failed to fetch projects" });
    }
};

// GET PROJECT BY ID
const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate("createdBy", "fullName email")
            .populate("assignedSubadmins", "fullName email profilePicture")
            .populate("employees", "fullName email profilePicture")
            .populate("tasks");

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const proj = project.toObject();
        const { status, progress, breakdown } = computeProjectStatus(proj);

        res.json({ project: { ...proj, computedStatus: status, progress, statusBreakdown: breakdown } });
    } catch (err) {
        console.error("Get project error", err);
        res.status(500).json({ message: "Failed to fetch project" });
    }
};

// UPDATE PROJECT (Admin only)
const updateProject = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can update projects" });
        }

        const { projectName, description, employees, assignedSubadmins } = req.body;

        const updateData = {
            projectName,
            description
        };

        if (employees) updateData.employees = employees;
        if (assignedSubadmins) updateData.assignedSubadmins = assignedSubadmins;

        const project = await Project.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        res.json({ message: "Project updated successfully", project });
    } catch (err) {
        console.error("Update project error", err);
        res.status(500).json({ message: "Failed to update project" });
    }
};

// DELETE PROJECT (Admin only)
const deleteProject = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can delete projects" });
        }

        const project = await Project.findByIdAndDelete(req.params.id);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        res.json({ message: "Project deleted successfully" });
    } catch (err) {
        console.error("Delete project error", err);
        res.status(500).json({ message: "Failed to delete project" });
    }
};

// ADD MEMBERS TO PROJECT (Admin only)
const addMembers = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can manage project members" });
        }

        const { employees, assignedSubadmins } = req.body;
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        if (employees && employees.length > 0) {
            employees.forEach(empId => {
                if (!project.employees.includes(empId)) {
                    project.employees.push(empId);
                }
            });
        }

        if (assignedSubadmins && assignedSubadmins.length > 0) {
            assignedSubadmins.forEach(subId => {
                if (!project.assignedSubadmins.includes(subId)) {
                    project.assignedSubadmins.push(subId);
                }
            });
        }

        await project.save();

        const updated = await Project.findById(req.params.id)
            .populate("employees", "fullName email")
            .populate("assignedSubadmins", "fullName email");

        res.json({ message: "Members added successfully", project: updated });
    } catch (err) {
        console.error("Add members error", err);
        res.status(500).json({ message: "Failed to add members" });
    }
};

// REMOVE MEMBER FROM PROJECT (Admin only)
const removeMember = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can manage project members" });
        }

        const { userId, memberType } = req.body; // memberType: "employee" or "subadmin"
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        if (memberType === "employee") {
            project.employees = project.employees.filter(id => id.toString() !== userId);
        } else if (memberType === "subadmin") {
            project.assignedSubadmins = project.assignedSubadmins.filter(id => id.toString() !== userId);
        }

        await project.save();
        res.json({ message: "Member removed successfully", project });
    } catch (err) {
        console.error("Remove member error", err);
        res.status(500).json({ message: "Failed to remove member" });
    }
};

// UPDATE CUSTOM STATUSES (Admin only)
const updateCustomStatuses = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can customize statuses" });
        }

        const { customStatuses } = req.body;

        if (!customStatuses || !Array.isArray(customStatuses) || customStatuses.length === 0) {
            return res.status(400).json({ message: "At least one status is required" });
        }

        const project = await Project.findByIdAndUpdate(
            req.params.id,
            { customStatuses },
            { new: true }
        );

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        res.json({ message: "Statuses updated successfully", customStatuses: project.customStatuses });
    } catch (err) {
        console.error("Update statuses error", err);
        res.status(500).json({ message: "Failed to update statuses" });
    }
};

// ADD TASK TO PROJECT (Admin only)
const addTaskToProject = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can add tasks to projects" });
        }

        const { taskId } = req.body;
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        if (project.tasks.includes(taskId)) {
            return res.status(400).json({ message: "Task already in this project" });
        }

        project.tasks.push(taskId);
        await project.save();

        res.json({ message: "Task added to project", project });
    } catch (err) {
        console.error("Add task to project error", err);
        res.status(500).json({ message: "Failed to add task to project" });
    }
};

// REMOVE TASK FROM PROJECT (Admin only)
const removeTaskFromProject = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can remove tasks from projects" });
        }

        const { taskId } = req.body;
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        project.tasks = project.tasks.filter(id => id.toString() !== taskId);
        await project.save();

        res.json({ message: "Task removed from project", project });
    } catch (err) {
        console.error("Remove task from project error", err);
        res.status(500).json({ message: "Failed to remove task from project" });
    }
};

module.exports = {
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    deleteProject,
    addMembers,
    removeMember,
    updateCustomStatuses,
    addTaskToProject,
    removeTaskFromProject
};
