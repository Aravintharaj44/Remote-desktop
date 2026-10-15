const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: "15m",
    }
  );
}

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;

    if (
      !name ||
      name.length > 80 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Enter valid details and a password of 12–128 characters",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash,
    });

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token: createToken(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Unable to register",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = req.body.password;

    if (typeof password !== "string" || !email) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+passwordHash");

    const valid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!valid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token: createToken(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Unable to log in",
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.sub).select("name email");

  if (!user) {
    return res.status(401).json({
      message: "Account no longer exists",
    });
  }

  return res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
});

module.exports = router;