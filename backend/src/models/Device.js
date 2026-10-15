const mongoose = require("mongoose");
module.exports = mongoose.model("Device", new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    platform: { type: String, maxlength: 30 },
  },
  { timestamps: true }
));