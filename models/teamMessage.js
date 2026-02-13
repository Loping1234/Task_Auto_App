const mongoose = require("mongoose");

const TeamMessageSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: true,
        index: true
    },
    senderEmail: {
        type: String,
        required: true
    },
    message: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    attachments: [{
        url: String,
        type: { type: String },
        name: String,
        size: Number
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: Date
});

const TeamMessage = mongoose.model("teamMessages", TeamMessageSchema);
module.exports = TeamMessage;