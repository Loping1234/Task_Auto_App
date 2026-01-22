const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: false
        },
        image: {
            type: String,
            required: false
        },
        imageContentType: {
            type: String,
            required: false
        },
        startDate: {
            type: Date,
            required: false
        },
        endDate: {
            type: Date,
            required: false
        },
        status: {
            type: String,
            enum: ["Pending", "In Progress", "Completed"],
            default: "Pending"
        },
        assigneeEmail: {
            type: String,
            required: true
        },
        titleHistory: [
            {
                value: String,
                changedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        descriptionHistory: [
            {
                value: String,
                changedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        activityLog: [
            {
                field: String,
                oldValue: String,
                newValue: String,
                changedBy: String,
                changedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        deletedAt: {
            type: Date,
            required: false
        },
        comments: [
            {
                text: {
                    type: String,
                    required: true
                },
                author: {
                    type: String,
                    required: true
                },
                image: {
                    type: String,
                    required: false
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

const Task = mongoose.model("tasks", TaskSchema);
module.exports = Task;
