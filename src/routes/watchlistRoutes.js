// src/routes/watchlistRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const {
    getMySettings,
    updateWatchlist,
    getICanWatch
} = require("../controllers/watchlistController");

router.get("/my-settings", verifyToken, getMySettings);
router.put("/update", verifyToken, updateWatchlist);
router.get("/i-can-watch", verifyToken, getICanWatch);

module.exports = router;
