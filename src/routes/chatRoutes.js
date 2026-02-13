// src/routes/chatRoutes.js
const express = require("express");
const { verifyToken, isAdminOrSubadmin } = require("../middleware/auth");
const {
    getEmployeeTeams,
    getTeamMessages,
    sendTeamMessage,
    getAdminMessages,
    sendAdminMessage,
    editMessage
} = require("../controllers/chatController");

module.exports = (upload) => {
    const router = express.Router();

    // Team chat
    router.get("/teams", verifyToken, getEmployeeTeams);
    router.get("/team/:teamName", verifyToken, getTeamMessages);
    router.post("/team/:teamName", verifyToken, upload.array('attachments', 5), sendTeamMessage);

    // Admin-Subadmin chat
    router.get("/admin", verifyToken, isAdminOrSubadmin, getAdminMessages);
    router.post("/admin", verifyToken, isAdminOrSubadmin, upload.array('attachments', 5), sendAdminMessage);

    // Edit Message (works for both if controller handles logic)
    router.put("/message/:messageId", verifyToken, editMessage);

    return router;
};
