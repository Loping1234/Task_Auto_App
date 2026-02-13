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

    // Admin-Subadmin chat with error handling
    router.post("/admin", verifyToken, isAdminOrSubadmin, (req, res, next) => {
        upload.array('attachments', 5)(req, res, (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(400).json({ message: err.message });
            }
            next();
        });
    }, sendAdminMessage);

    // Edit Message
    router.put("/message/:messageId", verifyToken, editMessage);

    return router;
};