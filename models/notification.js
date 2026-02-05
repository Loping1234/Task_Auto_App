const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users', // Matches the specific collection name defined in config.js
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'tasks'
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        default: 'general'
    },
    priority: {
        type: String,
        enum: ['primary', 'secondary'],
        default: 'primary'
    },
    category: {
        type: String,
        enum: ['chat', 'task_edit', 'team_change', 'status_change', 'assignment'],
        default: 'assignment'
    },
    metadata: {
        chatName: String,
        teamName: String,
        changeType: String,
        affectedUser: String
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
