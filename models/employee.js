const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    // List of team names the employee belongs to
    teams: [{
        type: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Employee = mongoose.model("employees", EmployeeSchema);
module.exports = Employee;