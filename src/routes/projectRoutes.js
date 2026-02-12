const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin, isAdminOrSubadmin } = require("../middleware/auth");

const {
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
} = require("../controllers/projectController");

// Project CRUD
router.get("/", verifyToken, getAllProjects);
router.get("/:id", verifyToken, getProjectById);
router.post("/", verifyToken, isAdmin, createProject);
router.put("/:id", verifyToken, isAdmin, updateProject);
router.delete("/:id", verifyToken, isAdmin, deleteProject);

// Members management
router.post("/:id/members", verifyToken, isAdmin, addMembers);
router.delete("/:id/members", verifyToken, isAdmin, removeMember);

// Custom statuses
router.put("/:id/statuses", verifyToken, isAdmin, updateCustomStatuses);

// Tasks in project
router.post("/:id/tasks", verifyToken, isAdmin, addTaskToProject);
router.delete("/:id/tasks", verifyToken, isAdmin, removeTaskFromProject);

module.exports = router;