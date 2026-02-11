// src/routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken, isAdminOrSubadmin } = require("../middleware/auth");
const {
    getAllTasks,
    createTask,
    updateAssignee,
    getTeamTasks,
    getTask,
    updateTask,
    updateStatus,
    deleteTask,
    addComment
} = require("../controllers/taskController");

// Note: upload middleware is passed from api.js when mounting
module.exports = (upload) => {
    router.get("/", verifyToken, getAllTasks);
    router.post("/", verifyToken, upload.single('image'), createTask);

    // Specific routes BEFORE :id routes to prevent conflict
    router.get("/team-tasks", verifyToken, getTeamTasks);

    // Parameterized routes
    router.get("/:id", verifyToken, getTask);
    router.put("/:id", verifyToken, isAdminOrSubadmin, upload.single('image'), updateTask);
    router.patch("/:id/assignee", verifyToken, updateAssignee);
    router.patch("/:id/status", verifyToken, updateStatus);
    router.delete("/:id", verifyToken, isAdminOrSubadmin, deleteTask);
    router.post("/:id/comments", verifyToken, upload.single('image'), addComment);

    return router;
};
