
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const rateLimit = require("express-rate-limit");
const getOrigins = require("./src/config/origins");


const authRoutes = require("./src/routes/auth");
const deviceRoutes = require("./src/routes/devices");
const { attachSignaling } = require("./src/sockets/signaling");

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 5000);

app.disable("x-powered-by");
app.use(helmet());

// app.use(
//   cors({
//     origin: process.env.CLIENT_ORIGIN,
//     methods: ["GET", "POST"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: getOrigins(),
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10kb" }));

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
  }),
  authRoutes
);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

app.use(
  "/api/devices",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
  }),
  deviceRoutes
);

// Attach the existing real-time signaling functionality.
attachSignaling(server);

async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error(
      "MONGODB_URI and JWT_SECRET must be configured in the backend .env file."
    );
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected successfully.");

  // server.listen(PORT, "127.0.0.1", () => {
  //   console.log(`API running at http://127.0.0.1:${PORT}`);
  // });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`API listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
