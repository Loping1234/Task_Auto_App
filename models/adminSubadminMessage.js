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
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const AdminSubadminMessage = mongoose.model("adminSubadminMessages", AdminSubadminMessageSchema);
module.exports = AdminSubadminMessage;