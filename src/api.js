require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ==========================================
// IMAGE UPLOAD SETUP
// ==========================================

// ==========================================
// IMAGE UPLOAD SETUP (S3)
// ==========================================

const s3Client = require('./config/s3');
const multerS3 = require('multer-s3');

const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: process.env.AWS_BUCKET_NAME,
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function (req, file, cb) {
            cb(null, Date.now().toString() + '-' + file.originalname);
        }
    })
});

// Serve static images (Legacy support for old images)
const imgsDir = path.join(__dirname, '../imgs');
if (!fs.existsSync(imgsDir)) {
    fs.mkdirSync(imgsDir, { recursive: true });
}
app.use('/imgs', express.static(imgsDir));

// ==========================================
// ROUTES
// ==========================================

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const taskRoutes = require("./routes/taskRoutes");
const teamRoutes = require("./routes/teamRoutes");
const chatRoutes = require("./routes/chatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const watchlistRoutes = require("./routes/watchlistRoutes");
const projectRoutes = require("./routes/projectRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes(upload));           // Pass upload middleware
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tasks", taskRoutes(upload));            // Pass upload middleware
app.use("/api", teamRoutes);                          // /api/teams, /api/employees, /api/subadmins
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/projects", projectRoutes);
// ==========================================
// SERVE REACT APP (Production)
// ==========================================

const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));

    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(clientBuildPath, 'index.html'));
        }
    });
}

// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
    console.log(`Frontend: http://localhost:5173 (Vite dev server)`);
    console.log(`API: http://localhost:${PORT}/api`);
});
