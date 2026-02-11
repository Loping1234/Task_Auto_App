// src/controllers/watchlistController.js
const mongoose = require("mongoose");
const collection = require("../config");
const Employee = require("../../models/employee");
const Watchlist = require("../../models/watchlist");

const getMySettings = async (req, res) => {
    try {
        const { id } = req.user;
        let watchlist = await Watchlist.findOne({ owner: id });

        if (!watchlist) {
            watchlist = { owner: id, watchers: [] };
        }

        const watchersWithDetails = await Promise.all(
            (watchlist.watchers || []).map(async (w) => {
                const user = await collection.findById(w.user || w.userId).lean();
                return {
                    userId: w.user || w.userId,
                    email: user?.email,
                    name: user?.name || user?.email?.split('@')[0],
                    role: user?.role,
                    allowedTypes: w.allowedTypes || ['all']
                };
            })
        );

        res.json({ watchers: watchersWithDetails });
    } catch (err) {
        console.error("Get watchlist settings error", err);
        res.status(500).json({ message: "Error loading watchlist" });
    }
};

const updateWatchlist = async (req, res) => {
    try {
        const { id } = req.user;
        const { watchers } = req.body;

        const watcherData = (watchers || []).map(w => ({
            user: w.userId,
            allowedTypes: w.allowedTypes || ['all'],
            addedAt: new Date()
        }));

        await Watchlist.findOneAndUpdate(
            { owner: id },
            {
                owner: id,
                watchers: watcherData,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Update watchlist error", err);
        res.status(500).json({ message: "Error updating watchlist" });
    }
};

const getICanWatch = async (req, res) => {
    try {
        const { id } = req.user;

        const watchlists = await Watchlist.find({
            'watchers.user': id
        }).lean();

        const canWatch = await Promise.all(
            watchlists.map(async (wl) => {
                const owner = await collection.findById(wl.owner).lean();
                const myEntry = wl.watchers.find(w => w.user?.toString() === id);
                return {
                    ownerId: wl.owner,
                    email: owner?.email,
                    name: owner?.name || owner?.email?.split('@')[0],
                    role: owner?.role,
                    allowedTypes: myEntry?.allowedTypes || ['all']
                };
            })
        );

        res.json({ canWatch });
    } catch (err) {
        console.error("Get i-can-watch error", err);
        res.status(500).json({ message: "Error loading watchable users" });
    }
};

module.exports = {
    getMySettings,
    updateWatchlist,
    getICanWatch
};
