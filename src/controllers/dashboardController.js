// src/controllers/dashboardController.js
const collection = require("../config");
const Task = require("../../models/task");
const Team = require("../../models/team");
const Employee = require("../../models/employee");

const getStats = async (req, res) => {
    try {
        const { role, email } = req.user;

        // Helper: get task status breakdown for a query
        const getTaskBreakdown = async (query = {}) => {
            const [pending, inProgress, completed, na] = await Promise.all([
                Task.countDocuments({ ...query, status: "Pending" }),
                Task.countDocuments({ ...query, status: "In Progress" }),
                Task.countDocuments({ ...query, status: "Completed" }),
                Task.countDocuments({ ...query, status: "N/A" }),
            ]);
            return { pending, inProgress, completed, backlog: na };
        };

        // Helper: get recent tasks for a query
        const getRecentTasks = async (query = {}, limit = 5) => {
            return Task.find(query)
                .sort({ updatedAt: -1 })
                .limit(limit)
                .select("title status assigneeEmail teamName endDate updatedAt");
        };

        // Helper: get upcoming deadlines
        const getUpcomingDeadlines = async (query = {}, limit = 5) => {
            const now = new Date();
            const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            return Task.find({
                ...query,
                endDate: { $gte: now, $lte: weekLater },
                status: { $ne: "Completed" }
            })
                .sort({ endDate: 1 })
                .limit(limit)
                .select("title status assigneeEmail teamName endDate");
        };

        if (role === "admin") {
            const [subadmins, employees, taskCount, teamCount, taskBreakdown, recentTasks, upcomingDeadlines] = await Promise.all([
                collection.countDocuments({ role: "subadmin" }),
                collection.countDocuments({ role: "employee" }),
                Task.countDocuments(),
                Team.countDocuments(),
                getTaskBreakdown(),
                getRecentTasks(),
                getUpcomingDeadlines()
            ]);

            return res.json({
                subadminCount: subadmins,
                empCount: employees,
                taskCount,
                teamCount,
                taskBreakdown,
                recentTasks,
                upcomingDeadlines
            });
        }

        if (role === "subadmin") {
            const teams = await Team.find({ subadminEmail: email });
            const employeeEmails = [...new Set(teams.flatMap(t => t.employees))];
            const taskQuery = {
                $or: [
                    { assigneeEmail: { $in: employeeEmails } },
                    { teamName: { $in: teams.map(t => t.teamName) } }
                ]
            };

            const [empCount, taskCount, taskBreakdown, recentTasks, upcomingDeadlines] = await Promise.all([
                collection.countDocuments({ email: { $in: employeeEmails } }),
                Task.countDocuments(taskQuery),
                getTaskBreakdown(taskQuery),
                getRecentTasks(taskQuery),
                getUpcomingDeadlines(taskQuery)
            ]);

            return res.json({
                empCount,
                taskCount,
                teams: teams.map(t => t.teamName),
                taskBreakdown,
                recentTasks,
                upcomingDeadlines
            });
        }

        if (role === "employee") {
            const employee = await Employee.findOne({ email });
            const employeeTeams = employee?.teams || [];
            const myTaskQuery = { assigneeEmail: email };

            const [individualTasks, teamTasks, taskBreakdown, recentTasks, upcomingDeadlines] = await Promise.all([
                Task.countDocuments(myTaskQuery),
                employeeTeams.length > 0
                    ? Task.countDocuments({ teamName: { $in: employeeTeams }, assigneeEmail: { $ne: email } })
                    : 0,
                getTaskBreakdown(myTaskQuery),
                getRecentTasks(myTaskQuery),
                getUpcomingDeadlines(myTaskQuery)
            ]);

            return res.json({
                individualTaskCount: individualTasks,
                teamTaskCount: teamTasks,
                teams: employeeTeams,
                taskBreakdown,
                recentTasks,
                upcomingDeadlines
            });
        }

        res.status(403).json({ message: "Unauthorized role" });
    } catch (err) {
        console.error("Dashboard error", err);
        res.status(500).json({ message: "Error loading dashboard" });
    }
};

module.exports = { getStats };
