// src/controllers/notificationController.js
const mongoose = require("mongoose");
const collection = require("../config");
const Employee = require("../../models/employee");
const Notification = require("../../models/notification");
const Watchlist = require("../../models/watchlist");

const getNotifications = async (req, res) => {
    try {
        const targetUserId = req.query.userId || req.user.id;
        const typeFilter = req.query.type;

        // If requesting another user's notifications, check permission
        if (targetUserId !== req.user.id) {
            const ownerWatchlist = await Watchlist.findOne({ owner: targetUserId });

            if (!ownerWatchlist) {
                return res.status(403).json({ message: "You don't have permission to view this user's notifications" });
            }

            const myAccess = ownerWatchlist.watchers.find(w => {
                const watcherUserId = w.user?.toString() || w.userId?.toString();
                return watcherUserId === req.user.id || watcherUserId === req.user.id?.toString();
            });

            if (!myAccess) {
                return res.status(403).json({ message: "You don't have permission to view this user's notifications" });
            }

            let query = { recipient: targetUserId };

            const hasAllAccess = myAccess.allowedTypes && myAccess.allowedTypes.includes('all');

            if (!hasAllAccess && myAccess.allowedTypes && myAccess.allowedTypes.length > 0) {
                if (typeFilter && typeFilter !== 'all') {
                    if (!myAccess.allowedTypes.includes(typeFilter)) {
                        return res.json({ notifications: [] });
                    }
                    query.type = typeFilter;
                } else {
                    query.type = { $in: myAccess.allowedTypes };
                }
            } else if (typeFilter && typeFilter !== 'all') {
                query.type = typeFilter;
            }

            const notifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(50);
            return res.json({ notifications });
        }

        // Viewing own notifications
        let query = { recipient: targetUserId };

        if (typeFilter && typeFilter !== 'all') {
            query.type = typeFilter;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await Notification.countDocuments(query);
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            notifications,
            hasMore: total > skip + notifications.length,
            total,
            page
        });
    } catch (err) {
        console.error("Get notifications error", err);
        res.status(500).json({ message: "Error loading notifications" });
    }
};

const markRead = async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, {
            isRead: true,
            readAt: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        console.error("Mark read error", err);
        res.status(500).json({ message: "Error updating notification" });
    }
};

const markUnread = async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, {
            isRead: false,
            readAt: null
        });
        res.json({ success: true });
    } catch (err) {
        console.error("Mark unread error", err);
        res.status(500).json({ message: "Error updating notification" });
    }
};

const markAllRead = async (req, res) => {
    try {
        const { id } = req.user;
        await Notification.updateMany(
            { recipient: id, isRead: false },
            { isRead: true, readAt: new Date() }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Mark all read error", err);
        res.status(500).json({ message: "Error updating notifications" });
    }
};

module.exports = {
    getNotifications,
    markRead,
    markUnread,
    markAllRead
};
