const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema({
    projectName: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        default: ""
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    assignedSubadmins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }],
    employees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "users"
    }],
    tasks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "tasks"
    }],
    customStatuses: [{
        label: { type: String, required: true },
        order: { type: Number, required: true },
        color: { type: String, default: "#6b7280" }
    }]
}, {
    timestamps: true
});

const Project = mongoose.model("projects", ProjectSchema);
module.exports = Project;