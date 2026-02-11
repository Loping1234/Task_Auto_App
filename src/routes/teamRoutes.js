// src/routes/teamRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin, isAdminOrSubadmin } = require("../middleware/auth");
const {
    getAllTeams,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    getEmployees,
    getSubadmins
} = require("../controllers/teamController");

// Employees & Subadmins (mounted under /api but defined here for organization)
router.get("/employees", verifyToken, getEmployees);
router.get("/subadmins", verifyToken, isAdminOrSubadmin, getSubadmins);

// Teams CRUD
router.get("/teams", verifyToken, getAllTeams);
router.get("/teams/:teamName", verifyToken, isAdminOrSubadmin, getTeam);
router.post("/teams", verifyToken, isAdmin, createTeam);
router.put("/teams/:teamName", verifyToken, isAdmin, updateTeam);
router.delete("/teams/:teamName", verifyToken, isAdmin, deleteTeam);

module.exports = router;
