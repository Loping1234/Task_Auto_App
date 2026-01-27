const mongoose = require("mongoose");

const Subadmin = new mongoose.Schema(
    {
        subadmin: {
            type: String
        }
});

const Subadmins = mongoose.model("tasks", TaskSchema);
module.exports = Subadmins;
