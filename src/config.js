const mongoose = require("mongoose");
const connect = mongoose.connect("mongodb://localhost:27017/Login-tut");

connect.then(() => {
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
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  emailVerificationToken: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["admin", "subadmin", "employee"],
    default: "employee"
  },
  fullName: {
    type: String,
    required: true
  },
  profilePicture: {
    type: String,
    default: "default-avatar.png"
  },
  loginOtp: {
    type: String
  },
  loginOtpExpires: {
    type: Date
  },
  twoFactorEnabled: {
    type: Boolean,
    default: true
  },
  assignedTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "tasks"
  }]
});

const collection = new mongoose.model("users", LoginSchema);
module.exports = collection;