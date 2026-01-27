const mongoose = require("mongoose");
const connect = mongoose.connect("mongodb://localhost:27017/Login-tut");

connect.then(() =>{
    console.log("Database connected successfully");
})
.catch(() => {
    console.log("Database cannot be connected");
})

const LoginSchema = new mongoose.Schema({
    email: {
      type: String,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    role:{
      type: String,
      enum: ["admin" ,"subadmin", "employee"],
      default: "employee"
    },
    assignedTasks:[{
      type: mongoose.Schema.Types.ObjectId,
      ref: "tasks"
    }]
});

const collection = new mongoose.model("users", LoginSchema);
module.exports = collection;