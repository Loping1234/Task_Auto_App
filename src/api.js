require('dotenv').config();
const express = require("express");
const http = require('http');
const cors = require("cors");
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://task-auto-app-9k64.vercel.app'
];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        // Allow all vercel.app subdomains
        if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ==========================================
// SOCKET.IO (Real-time chat)
// ==========================================

const collection = require('./config');
const { JWT_SECRET } = require('./middleware/auth');
const Team = require('../models/team');
const Employee = require('../models/employee');

const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

// Make io available in route handlers/controllers
app.set('io', io);

// Authenticate sockets via the same JWT used by REST APIs
io.use(async (socket, next) => {
    try {
        const headerAuth = socket.handshake.headers?.authorization;
        const authToken = socket.handshake.auth?.token;

        let token;
        if (typeof authToken === 'string' && authToken.trim()) {
            token = authToken.trim();
        } else if (typeof headerAuth === 'string' && headerAuth.startsWith('Bearer ')) {
            token = headerAuth.split(' ')[1];
        }

        if (!token) {
            return next(new Error('Unauthorized'));
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await collection.findById(decoded.id);
        if (!user) {
            return next(new Error('Unauthorized'));
        }

        socket.user = {
            id: user._id,
            email: user.email,
            role: user.role
        };
        return next();
    } catch (err) {
        return next(new Error('Unauthorized'));
    }
});

io.on('connection', (socket) => {
    const userId = socket.user?.id?.toString();
    if (userId) {
        socket.join(`notif:${userId}`);
    }
    socket.on('chat:join', async ({ room } = {}) => {
        try {
            if (typeof room !== 'string' || !room.trim()) return;

            // Team rooms: team:<teamName>
            if (room.startsWith('team:')) {
                const teamName = room.slice('team:'.length);
                if (!teamName) return;

                if (socket.user?.role === 'employee') {
                    const employee = await Employee.findOne({ email: socket.user.email });
                    if (!employee?.teams?.includes(teamName)) return;
                }

                const team = await Team.findOne({ teamName });
                if (!team) return;

                await socket.join(room);
                return;
            }

            // Admin chat rooms
            // - admin:general
            // - admin:dm:<subadminEmail>
            if (room === 'admin:general') {
                if (!['admin', 'subadmin'].includes(socket.user?.role)) return;
                await socket.join(room);
                return;
            }

            if (room.startsWith('admin:dm:')) {
                if (!['admin', 'subadmin'].includes(socket.user?.role)) return;
                const subadminEmail = room.slice('admin:dm:'.length);
                if (!subadminEmail) return;

                // Subadmins can only join their own DM room; admins can join any.
                if (socket.user.role === 'subadmin' && socket.user.email !== subadminEmail) return;

                await socket.join(room);
            }
            // Typing indicators
            socket.on('chat:typing', ({ room }) => {
                socket.to(room).emit('chat:typing', { user: socket.user.email, room });
            });

            socket.on('chat:stop_typing', ({ room }) => {
                socket.to(room).emit('chat:stop_typing', { user: socket.user.email, room });
            });
        } catch (err) {
            // ignore join errors to avoid crashing socket handlers
        }
    });

    socket.on('chat:leave', async ({ room } = {}) => {
        try {
            if (typeof room !== 'string' || !room.trim()) return;
            await socket.leave(room);
        } catch (err) {
            // ignore
        }
    });
});

// ==========================================
// IMAGE UPLOAD SETUP
// ==========================================

// Serve static images (Legacy support for old images)
const imgsDir = path.join(__dirname, '../imgs');
if (!fs.existsSync(imgsDir)) {
    fs.mkdirSync(imgsDir, { recursive: true });
}
app.use('/imgs', express.static(imgsDir));

let upload;

if (process.env.AWS_BUCKET_NAME) {
    // Use S3 storage in production
    const s3Client = require('./config/s3');
    const multerS3 = require('multer-s3');

    upload = multer({
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
    console.log('✅ Using S3 for file uploads');
} else {
    // Fallback to local disk storage
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, imgsDir),
        filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
    });
    upload = multer({ storage });
    console.log('⚠️  AWS_BUCKET_NAME not set — using local disk for file uploads');
}

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
app.use("/api/chat", chatRoutes(upload));
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
server.listen(PORT, () => {
    console.log(`API Server running on port ${PORT}`);
    console.log(`Frontend: http://localhost:5173 (Vite dev server)`);
    console.log(`API: http://localhost:${PORT}/api`);
});
