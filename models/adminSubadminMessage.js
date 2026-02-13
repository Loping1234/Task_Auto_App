const mongoose = require("mongoose");

const AdminSubadminMessageSchema = new mongoose.Schema({
    senderEmail: {
        type: String, // Can be admin.com or subadmin.com
        required: true
    },
    receiverEmail: {
        type: String, // Can be admin.com or subadmin.com
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
        type: String,
        name: String,
        size: Number
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: Date
});

const AdminSubadminMessage = mongoose.model("adminSubadminMessages", AdminSubadminMessageSchema);
module.exports = AdminSubadminMessage;