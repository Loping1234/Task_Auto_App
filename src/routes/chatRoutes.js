// src/routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken, isAdminOrSubadmin } = require("../middleware/auth");
const {
    getEmployeeTeams,
    getTeamMessages,
    sendTeamMessage,
    getAdminMessages,
    sendAdminMessage
} = require("../controllers/chatController");

// Team chat
router.get("/teams", verifyToken, getEmployeeTeams);
router.get("/team/:teamName", verifyToken, getTeamMessages);
router.post("/team/:teamName", verifyToken, sendTeamMessage);

// Admin-Subadmin chat
router.get("/admin", verifyToken, isAdminOrSubadmin, getAdminMessages);
router.post("/admin", verifyToken, isAdminOrSubadmin, sendAdminMessage);

module.exports = router;
