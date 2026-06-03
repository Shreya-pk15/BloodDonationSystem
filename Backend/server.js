const dns = require("dns");
// Campus/corporate DNS often blocks SRV lookups required by mongodb+srv://
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const setupSocket = require("./socket");
const startBroadcastCron = require("./cron/broadcastCron");
const startWeeklyAnalyticsCron = require("./cron/weeklyAnalyticsCron");

// ROUTES
const authRoutes = require("./routes/authRoutes");
const requestRoutes = require("./routes/requestRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();

// Middleware
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// HTTP server
const server = http.createServer(app);

// SOCKET SETUP
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Socket connection setup
setupSocket(io);

// make io accessible globally
app.set("io", io);

// ROUTES USE
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/messages", messageRoutes);

// Spec requirement: GET /api/donor/history directly mapped
const { getDonationHistory } = require("./controllers/userController");
const authMiddleware = require("./middleware/authMiddleware");
app.get("/api/donor/history", authMiddleware, getDonationHistory);

// Test route
app.get("/", (req, res) => {
  res.send("Backend running...");
});

// MongoDB connection — start cron and server only after successful DB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");

    // Start cron broadcast system after DB is ready
    startBroadcastCron(io);
    startWeeklyAnalyticsCron(io);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("Mongo Error:", err);
    if (err && err.stack) console.error(err.stack);
    // Exit so we don't run cron/tasks without DB
    process.exit(1);
  });