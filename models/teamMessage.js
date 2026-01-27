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
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const TeamMessage = mongoose.model("teamMessages", TeamMessageSchema);
module.exports = TeamMessage;