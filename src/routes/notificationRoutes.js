// src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const {
    getNotifications,
    markRead,
    markUnread,
    markAllRead
} = require("../controllers/notificationController");

// IMPORTANT: read-all must come BEFORE :id routes
router.put("/read-all", verifyToken, markAllRead);

router.get("/", verifyToken, getNotifications);
router.put("/:id/read", verifyToken, markRead);
router.put("/:id/unread", verifyToken, markUnread);

module.exports = router;
