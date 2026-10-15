const express = require("express");
const Device = require("../models/Device");
const { requireAuth } = require("../middleware/auth");
const { isOnline } = require("../sockets/signaling");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const devices = await Device.find({ owner: req.user.sub }).lean();
  res.json({ devices: devices.map((d) => ({ id: d._id, name: d.name, platform: d.platform, online: isOnline(d._id) })) });
});

router.post("/", async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name || name.length > 80) return res.status(400).json({ message: "Invalid device name" });
  const d = await Device.create({ owner: req.user.sub, name, platform: String(req.body.platform || "").slice(0, 30) });
  res.status(201).json({ device: { id: d._id, name: d.name } });
});

module.exports = router;