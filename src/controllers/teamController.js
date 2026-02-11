// src/controllers/teamController.js
const collection = require("../config");
const Task = require("../../models/task");
const Team = require("../../models/team");
const Employee = require("../../models/employee");
const Notification = require("../../models/notification");

const getAllTeams = async (req, res) => {
    try {
        const { role, email } = req.user;
        let query = {};

        if (role === "subadmin") {
            query = { subadminEmail: email };
        } else if (role === "employee") {
            const employee = await Employee.findOne({ email });
            const teamNames = employee?.teams || [];
            query = { teamName: { $in: teamNames } };
        }

        const teams = await Team.find(query);
        res.json({ teams });
    } catch (err) {
        console.error("Get teams error", err);
        res.status(500).json({ message: "Error loading teams" });
    }
};

const getTeam = async (req, res) => {
    try {
        const teamName = decodeURIComponent(req.params.teamName);
        const team = await Team.findOne({ teamName });

        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }
        res.json({ team });
    } catch (err) {
        console.error("Get team error", err);
        res.status(500).json({ message: "Error loading team" });
    }
};

const createTeam = async (req, res) => {
    try {
        const { teamName, subadminEmail, employees } = req.body;

        if (!teamName || !subadminEmail) {
            return res.status(400).json({ message: "Team name and Sub-Admin are required" });
        }

        const existingTeam = await Team.findOne({ teamName });
        if (existingTeam) {
            return res.status(400).json({ message: "Team name already exists" });
        }

        const employeeEmails = Array.isArray(employees) ? employees : (employees ? [employees] : []);

        if (employeeEmails.length > 0) {
            await Employee.updateMany(
                { email: { $in: employeeEmails } },
                { $addToSet: { teams: teamName } }
            );
        }

        const team = await Team.create({ teamName, subadminEmail, employees: employeeEmails });
        res.status(201).json({ team, message: "Team created successfully" });
    } catch (err) {
        console.error("Create team error", err);
        res.status(500).json({ message: "Failed to create team" });
    }
};

const updateTeam = async (req, res) => {
    try {
        const { subadminEmail, employees, newTeamName } = req.body;
        const oldTeamName = decodeURIComponent(req.params.teamName);

        const team = await Team.findOne({ teamName: oldTeamName });
        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }

        const employeeEmails = Array.isArray(employees) ? employees : (employees ? [employees] : []);

        const removedEmployees = team.employees.filter(e => !employeeEmails.includes(e));
        if (removedEmployees.length > 0) {
            await Employee.updateMany(
                { email: { $in: removedEmployees } },
                { $pull: { teams: oldTeamName } }
            );
        }

        const updatedTeamName = newTeamName || oldTeamName;
        await Team.updateOne(
            { teamName: oldTeamName },
            {
                teamName: updatedTeamName,
                subadminEmail,
                employees: employeeEmails,
                updatedAt: Date.now()
            }
        );

        if (employeeEmails.length > 0) {
            if (oldTeamName !== updatedTeamName) {
                await Employee.updateMany(
                    { email: { $in: employeeEmails } },
                    { $pull: { teams: oldTeamName } }
                );
            }
            await Employee.updateMany(
                { email: { $in: employeeEmails } },
                { $addToSet: { teams: updatedTeamName } }
            );
        }

        if (oldTeamName !== updatedTeamName) {
            await Task.updateMany({ teamName: oldTeamName }, { teamName: updatedTeamName });
        }

        // Send Team Management Notifications
        try {
            const notifications = [];
            const addedEmployees = employeeEmails.filter(e => !team.employees.includes(e));
            const unchangedEmployees = team.employees.filter(e => employeeEmails.includes(e));

            const subadmin = await collection.findOne({ email: subadminEmail });
            if (subadmin && subadmin.email !== req.user.email) {
                if (removedEmployees.length > 0 || addedEmployees.length > 0) {
                    notifications.push({
                        recipient: subadmin._id,
                        sender: req.user.id,
                        message: `Team "${updatedTeamName}" was updated`,
                        type: 'team_change',
                        priority: 'primary',
                        category: 'team_change',
                        metadata: { teamName: updatedTeamName, changeType: 'update' }
                    });
                }
            }

            for (const email of removedEmployees) {
                const user = await collection.findOne({ email });
                if (user) {
                    notifications.push({
                        recipient: user._id,
                        sender: req.user.id,
                        message: `You were removed from team "${updatedTeamName}"`,
                        type: 'team_change',
                        priority: 'primary',
                        category: 'team_change',
                        metadata: { teamName: updatedTeamName, changeType: 'removed' }
                    });
                }
            }

            for (const email of addedEmployees) {
                const user = await collection.findOne({ email });
                if (user) {
                    notifications.push({
                        recipient: user._id,
                        sender: req.user.id,
                        message: `You were added to team "${updatedTeamName}"`,
                        type: 'team_change',
                        priority: 'primary',
                        category: 'team_change',
                        metadata: { teamName: updatedTeamName, changeType: 'added' }
                    });
                }
            }

            for (const email of unchangedEmployees) {
                const user = await collection.findOne({ email });
                if (user && user.email !== req.user.email) {
                    const changes = [];
                    if (removedEmployees.length > 0) changes.push(`${removedEmployees.join(', ')} removed`);
                    if (addedEmployees.length > 0) changes.push(`${addedEmployees.join(', ')} added`);

                    if (changes.length > 0) {
                        notifications.push({
                            recipient: user._id,
                            sender: req.user.id,
                            message: `Team "${updatedTeamName}" updated: ${changes.join('; ')}`,
                            type: 'team_change',
                            priority: 'secondary',
                            category: 'team_change',
                            metadata: { teamName: updatedTeamName, changeType: 'member_change' }
                        });
                    }
                }
            }

            if (notifications.length > 0) {
                await Notification.insertMany(notifications);
            }
        } catch (notifErr) {
            console.error("[TEAM MANAGEMENT NOTIFICATION ERROR]", notifErr);
        }

        const updatedTeam = await Team.findOne({ teamName: updatedTeamName });
        res.json({ team: updatedTeam, message: "Team updated successfully" });
    } catch (err) {
        console.error("Update team error", err);
        res.status(500).json({ message: "Failed to update team" });
    }
};

const deleteTeam = async (req, res) => {
    try {
        const teamName = decodeURIComponent(req.params.teamName);

        const team = await Team.findOne({ teamName });
        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }

        await Employee.updateMany(
            { teams: teamName },
            { $pull: { teams: teamName } }
        );

        await Task.updateMany(
            { teamName },
            { $set: { teamName: null, assigneeEmail: null } }
        );

        await Team.deleteOne({ teamName });
        res.json({ message: "Team deleted successfully" });
    } catch (err) {
        console.error("Delete team error", err);
        res.status(500).json({ message: "Failed to delete team" });
    }
};

const getEmployees = async (req, res) => {
    try {
        const { role, email } = req.user;
        let query = { role: "employee" };

        if (role === "subadmin") {
            const teams = await Team.find({ subadminEmail: email });
            const employeeEmails = [...new Set(teams.flatMap(t => t.employees))];
            query = { email: { $in: employeeEmails } };
        } else if (role === "employee") {
            const employee = await Employee.findOne({ email });
            const teams = employee?.teams || [];
            const teammateTeams = await Team.find({ teamName: { $in: teams } });
            const allEmails = [...new Set(teammateTeams.flatMap(t => t.employees))];
            query = { email: { $in: allEmails } };
        }

        const employees = await collection.find(query);

        const employeeDetails = await Promise.all(
            employees.map(async (emp) => {
                const empModel = await Employee.findOne({ email: emp.email });
                return {
                    _id: emp._id,
                    email: emp.email,
                    name: empModel?.name || emp.email.split("@")[0],
                    teams: empModel?.teams || []
                };
            })
        );

        res.json({ employees: employeeDetails });
    } catch (err) {
        console.error("Get employees error", err);
        res.status(500).json({ message: "Error loading employees" });
    }
};

const getSubadmins = async (req, res) => {
    try {
        const subadmins = await collection.find({ role: "subadmin" });
        res.json({
            subadmins: subadmins.map(s => ({
                _id: s._id,
                email: s.email
            }))
        });
    } catch (err) {
        console.error("Get subadmins error", err);
        res.status(500).json({ message: "Error loading subadmins" });
    }
};

module.exports = {
    getAllTeams,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    getEmployees,
    getSubadmins
};
