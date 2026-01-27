const mongoose = require("mongoose");

const TeamSchema = new mongoose.Schema({
    teamName: {
        type: String,
        required: true,
        unique: true
    },
    // The subadmin who owns this team. Stored as email/string, which is fine for now.
    subadminEmail: {
        type: String,
        required: true
    },
    // Employees in the team (stored as email/string)
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