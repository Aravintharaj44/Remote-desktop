module.exports = () =>
  (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);