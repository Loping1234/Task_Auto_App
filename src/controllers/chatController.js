// src/controllers/chatController.js
const collection = require("../config");
const Team = require("../../models/team");
const Employee = require("../../models/employee");
const TeamMessage = require("../../models/teamMessage");
const AdminSubadminMessage = require("../../models/adminSubadminMessage");
const Notification = require("../../models/notification");

const getEmployeeTeams = async (req, res) => {
    try {
        const { email, role } = req.user;

        if (role !== "employee") {
            return res.status(403).json({ message: "Only employees can access team chat" });
        }

        const employee = await Employee.findOne({ email });
        const teamNames = employee?.teams || [];

        const teams = await Team.find({ teamName: { $in: teamNames } });
        res.json({ teams });
    } catch (err) {
        console.error("Get chat teams error", err);
        res.status(500).json({ message: "Error loading teams" });
    }
};

const getTeamMessages = async (req, res) => {
    try {
        const { email, role } = req.user;
        const teamName = decodeURIComponent(req.params.teamName);

        if (role === "employee") {
            const employee = await Employee.findOne({ email });
            if (!employee?.teams?.includes(teamName)) {
                return res.status(403).json({ message: "You are not a member of this team" });
            }
        }

        const team = await Team.findOne({ teamName });
        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }

        const messages = await TeamMessage.find({ teamName }).sort({ createdAt: 1 });
        const members = await Employee.find({ teams: teamName });

        res.json({
            messages,
            members: members.map(m => ({ email: m.email, name: m.name }))
        });
    } catch (err) {
        console.error("Get team messages error", err);
        res.status(500).json({ message: "Error loading messages" });
    }
};

const sendTeamMessage = async (req, res) => {
    try {
        const { email, role } = req.user;
        const teamName = decodeURIComponent(req.params.teamName);
        const { message } = req.body;

        if (!message?.trim()) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        if (role === "employee") {
            const employee = await Employee.findOne({ email });
            if (!employee?.teams?.includes(teamName)) {
                return res.status(403).json({ message: "You are not a member of this team" });
            }
        }

        const newMessage = await TeamMessage.create({
            teamName,
            senderEmail: email,
            message: message.trim()
        });

        // Send Chat Notifications to team members
        try {
            const team = await Team.findOne({ teamName });
            if (team) {
                const recipientEmails = team.employees.filter(e => e !== email);
                const notifications = [];

                for (const recipientEmail of recipientEmails) {
                    const recipient = await collection.findOne({ email: recipientEmail });
                    if (recipient) {
                        notifications.push({
                            recipient: recipient._id,
                            sender: req.user.id,
                            message: `You have unread messages in ${teamName} chat`,
                            type: 'chat',
                            priority: 'primary',
                            category: 'chat',
                            metadata: { chatName: teamName }
                        });
                    }
                }

                if (notifications.length > 0) {
                    await Notification.insertMany(notifications);
                }
            }
        } catch (notifErr) {
            console.error("[TEAM CHAT NOTIFICATION ERROR]", notifErr);
        }

        res.status(201).json({ message: newMessage });
    } catch (err) {
        console.error("Send team message error", err);
        res.status(500).json({ message: "Failed to send message" });
    }
};

const getAdminMessages = async (req, res) => {
    try {
        const { email, role } = req.user;
        const channel = req.query.channel || 'general';

        let query = {};

        if (channel === 'general') {
            query = { receiverEmail: 'all@subadmin.com' };
        } else if (role === 'admin') {
            query = {
                $or: [
                    { senderEmail: email, receiverEmail: channel },
                    { senderEmail: channel, receiverEmail: email },
                    { receiverEmail: 'all@subadmin.com' }
                ]
            };
        } else {
            query = {
                $or: [
                    { senderEmail: email },
                    { receiverEmail: email },
                    { receiverEmail: 'all@subadmin.com' }
                ]
            };
        }

        const messages = await AdminSubadminMessage.find(query).sort({ createdAt: 1 });
        res.json({ messages });
    } catch (err) {
        console.error("Get admin chat error", err);
        res.status(500).json({ message: "Error loading messages" });
    }
};

const sendAdminMessage = async (req, res) => {
    try {
        const { email, role } = req.user;
        const { receiverEmail, message, channel } = req.body;

        if (!message?.trim()) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        let actualReceiver = receiverEmail;
        if (receiverEmail === 'general' || channel === 'general') {
            actualReceiver = 'all@subadmin.com';
        }

        const newMessage = await AdminSubadminMessage.create({
            senderEmail: email,
            receiverEmail: actualReceiver,
            message: message.trim()
        });

        // Send Chat Notifications
        try {
            const notifications = [];

            if (actualReceiver === 'all@subadmin.com') {
                const subadmins = await collection.find({ role: 'subadmin' });
                const admin = await collection.findOne({ role: 'admin' });

                const recipients = [...subadmins];
                if (admin) recipients.push(admin);

                for (const recipient of recipients) {
                    if (recipient.email !== email) {
                        notifications.push({
                            recipient: recipient._id,
                            sender: req.user.id,
                            message: `You have unread messages in Admin Chat (General)`,
                            type: 'chat',
                            priority: 'primary',
                            category: 'chat',
                            metadata: { chatName: 'Admin Chat - General' }
                        });
                    }
                }
            } else {
                const recipient = await collection.findOne({ email: actualReceiver });
                if (recipient) {
                    notifications.push({
                        recipient: recipient._id,
                        sender: req.user.id,
                        message: `You have unread messages from ${email}`,
                        type: 'chat',
                        priority: 'primary',
                        category: 'chat',
                        metadata: { chatName: `Admin Chat - ${email}` }
                    });
                }
            }

            if (notifications.length > 0) {
                await Notification.insertMany(notifications);
            }
        } catch (notifErr) {
            console.error("[ADMIN CHAT NOTIFICATION ERROR]", notifErr);
        }

        res.status(201).json({ message: newMessage });
    } catch (err) {
        console.error("Send admin chat error", err);
        res.status(500).json({ message: "Failed to send message" });
    }
};

module.exports = {
    getEmployeeTeams,
    getTeamMessages,
    sendTeamMessage,
    getAdminMessages,
    sendAdminMessage
};
