const mongoose = require("mongoose");
module.exports = mongoose.model("Session", new mongoose.Schema(
  {
    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    viewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "active", "denied", "ended"], default: "pending" },
    endedAt: Date,
  },
  { timestamps: true }
));