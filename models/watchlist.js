const mongoose = require('mongoose');

// Watchlist schema - stores who can view a user's notifications
// Owner grants access to watchers, each watcher can see specific notification types
const watchlistSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        unique: true // Each user has one watchlist settings document
    },
    watchers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            required: true
        },
        // Which notification types this watcher can see
        // ['all'] means all types, or specific types like ['assignment', 'task_edit']
        allowedTypes: [{
            type: String,
            enum: ['all', 'assignment', 'task_edit', 'team_change', 'chat', 'status_change']
        }],
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Watchlist', watchlistSchema);
