const mongoose = require("mongoose");

const SubadminSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

const Subadmins = mongoose.model("subadmins", SubadminSchema);
module.exports = Subadmins;
