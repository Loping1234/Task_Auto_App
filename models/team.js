const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: true,
        unique: true
    },
    subadminEmail: {
        type: String,
        required: true
    },
    employees: [{
        type: String,
        required: true
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Team = mongoose.model("teams", TeamSchema);
module.exports = Team;