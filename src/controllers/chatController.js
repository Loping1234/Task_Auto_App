const collection = require("../config");
const Team = require("../../models/team");
const Employee = require("../../models/employee");
const TeamMessage = require("../../models/teamMessage");
const AdminSubadminMessage = require("../../models/adminSubadminMessage");
const Notification = require("../../models/notification");
const { emitNotifications } = require("../utils/emitNotification");

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
        console.log("--- sendTeamMessage Debug ---");
        console.log("Headers Content-Type:", req.headers['content-type']);
        console.log("Body:", req.body);
        console.log("Files:", req.files);

        const { email, role } = req.user;
        const teamName = decodeURIComponent(req.params.teamName);
        const { message } = req.body;

        if ((!message || !message.trim()) && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        if (role === "employee") {
            const employee = await Employee.findOne({ email });
            if (!employee?.teams?.includes(teamName)) {
                return res.status(403).json({ message: "You are not a member of this team" });
            }
        }

        let attachments = [];
        if (req.files && req.files.length > 0) {
            attachments = req.files.map(file => ({
                url: file.location || `/imgs/${file.filename}`, // S3 or Local
                type: file.mimetype,
                name: file.originalname,
                size: file.size
            }));
        }

        const newMessage = await TeamMessage.create({
            teamName,
            senderEmail: email,
            message: message ? message.trim() : "",
            attachments
        });

        const io = req.app.get('io');
        io?.to(`team:${teamName}`).emit('chat:team:new_message', newMessage);

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
                    emitNotifications(req.app.get('io'), notifications);
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

        if ((!message || !message.trim()) && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        let actualReceiver = receiverEmail;
        if (receiverEmail === 'general' || channel === 'general') {
            actualReceiver = 'all@subadmin.com';
        }

        let attachments = [];
        if (req.files && req.files.length > 0) {
            attachments = req.files.map(file => ({
                url: file.location || `/imgs/${file.filename}`,
                type: file.mimetype,
                name: file.originalname,
                size: file.size
            }));
        }

        const newMessage = await AdminSubadminMessage.create({
            senderEmail: email,
            receiverEmail: actualReceiver,
            message: message ? message.trim() : "",
            attachments
        });
        try {
            const io = req.app.get('io');
            if (io) {
                if (actualReceiver === 'all@subadmin.com') {
                    io.to('admin:general').emit('chat:admin:new_message', newMessage);
                } else {
                    const dmRoom = role === 'admin'
                        ? `admin:dm:${actualReceiver}`
                        : `admin:dm:${email}`;
                    io.to(dmRoom).emit('chat:admin:new_message', newMessage);
                }
            }
        } catch (socketErr) {
            console.error('[ADMIN CHAT SOCKET EMIT ERROR]', socketErr);
        }
        try {
            const notifications = [];
            const io = req.app.get('io');
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
                emitNotifications(req.app.get('io'), notifications);
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

const editMessage = async (req, res) => {
    try {
        const { email } = req.user;
        const { messageId } = req.params;
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ message: "Message cannot be empty" });
        }

        // Try finding in TeamMessage first
        let msg = await TeamMessage.findById(messageId);
        let type = 'team';

        // If not found, try AdminSubadminMessage
        if (!msg) {
            msg = await AdminSubadminMessage.findById(messageId);
            type = 'admin';
        }

        if (!msg) {
            return res.status(404).json({ message: "Message not found" });
        }

        if (msg.senderEmail !== email) {
            return res.status(403).json({ message: "You can only edit your own messages" });
        }

        msg.message = message.trim();
        msg.isEdited = true;
        msg.editedAt = new Date();
        await msg.save();

        const io = req.app.get('io');
        if (io) {
            if (type === 'team') {
                io.to(`team:${msg.teamName}`).emit('chat:message_updated', msg);
            } else {
                // Admin chat broadcast logic
                if (msg.receiverEmail === 'all@subadmin.com') {
                    io.to('admin:general').emit('chat:message_updated', msg);
                } else {
                    // Emit to DM rooms of both sender and receiver
                    const role = req.user.role; // This might be tricky if we don't have role here easily, but we have msg details
                    // Safer to emission to specific DM rooms directly if we reconstruct them, 
                    // or just emit to the rooms the clients are listening to:
                    // Receiver's DM room
                    io.to(`admin:dm:${msg.receiverEmail}`).emit('chat:message_updated', msg);
                    // Sender's DM room (so they see the update on other devices)
                    io.to(`admin:dm:${msg.senderEmail}`).emit('chat:message_updated', msg);
                }
            }
        }

        res.json({ message: msg });
    } catch (err) {
        console.error("Edit message error", err);
        res.status(500).json({ message: "Failed to edit message" });
    }
};

module.exports = {
    getEmployeeTeams,
    getTeamMessages,
    sendTeamMessage,
    getAdminMessages,
    sendAdminMessage,
    editMessage
};
