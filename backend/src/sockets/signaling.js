const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const Device = require("../models/Device");
const Session = require("../models/Session");
const User = require("../models/User");
const getOrigins = require("../config/origins");


const hosts = new Map(); // deviceId -> host socket
const live = new Map();  // sessionId -> { host, viewer }

const isOnline = (id) => hosts.has(String(id));

function attachSignaling(httpServer) {
  // const io = new Server(httpServer, {
  //   cors: { origin: process.env.CLIENT_ORIGIN },
  //   maxHttpBufferSize: 1e5,
  // });

  const io = new Server(httpServer, {
    cors: { origin: getOrigins() },
    maxHttpBufferSize: 1e5,
  });

  io.use((socket, next) => {
    try {
      const p = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
      socket.userId = p.sub;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Host agent announces a device it owns
    socket.on("host:online", async ({ deviceId }, ack) => {
      const device = await Device.findOne({ _id: deviceId, owner: socket.userId });
      if (!device) return ack?.({ ok: false });
      socket.deviceId = String(device._id);
      hosts.set(socket.deviceId, socket);
      ack?.({ ok: true });
    });

    // Viewer asks to connect (MVP: only to devices on the same account)
    // socket.on("session:request", async ({ deviceId }, ack) => {
    //   const device = await Device.findOne({ _id: deviceId, owner: socket.userId });
    //   const host = device && hosts.get(String(device._id));
    //   if (!host) return ack?.({ ok: false, message: "Device offline" });

    //   const viewerUser = await User.findById(socket.userId).select("name email");
    //   const s = await Session.create({ device: device._id, host: device.owner, viewer: socket.userId });
    //   live.set(String(s._id), { host, viewer: socket });
    //   host.emit("session:incoming", { sessionId: String(s._id), from: viewerUser.name });
    //   ack?.({ ok: true, sessionId: String(s._id) });
    // });

    socket.on("session:request", async ({ deviceId }, ack) => {
      if (!/^[a-f0-9]{24}$/.test(String(deviceId))) {
        return ack?.({ ok: false, message: "Invalid device ID" });
      }
      const device = await Device.findById(deviceId);
      const host = device && hosts.get(String(device._id));
      if (!host) return ack?.({ ok: false, message: "Device offline or not found" });

      // one request at a time per device (stops prompt spam)
      for (const p of live.values()) {
        if (p.host === host) return ack?.({ ok: false, message: "Device is busy" });
      }

      const viewerUser = await User.findById(socket.userId).select("name email");
      const s = await Session.create({ device: device._id, host: device.owner, viewer: socket.userId });
      live.set(String(s._id), { host, viewer: socket });
      host.emit("session:incoming", {
        sessionId: String(s._id),
        from: `${viewerUser.name} (${viewerUser.email})`,
      });
      ack?.({ ok: true, sessionId: String(s._id) });
    });

    // Host approves or denies
    socket.on("session:respond", async ({ sessionId, accept }) => {
      const p = live.get(sessionId);
      if (!p || p.host !== socket) return;
      await Session.findByIdAndUpdate(sessionId, { status: accept ? "active" : "denied" });
      if (!accept) {
        p.viewer.emit("session:denied", { sessionId });
        live.delete(sessionId);
        return;
      }
      p.viewer.emit("session:accepted", { sessionId });
      p.host.emit("session:ready", { sessionId }); // host now creates the WebRTC offer
    });

    // Relay SDP / ICE between the two participants only
    socket.on("signal", ({ sessionId, data }) => {
      const p = live.get(sessionId);
      if (!p) return;
      const other = p.host === socket ? p.viewer : p.viewer === socket ? p.host : null;
      other?.emit("signal", { sessionId, data });
    });

    const end = async (sessionId) => {
      const p = live.get(sessionId);
      if (!p || (p.host !== socket && p.viewer !== socket)) return;
      live.delete(sessionId);
      await Session.findByIdAndUpdate(sessionId, { status: "ended", endedAt: new Date() });
      p.host.emit("session:ended", { sessionId });
      p.viewer.emit("session:ended", { sessionId });
    };
    socket.on("session:end", ({ sessionId }) => end(sessionId));

    socket.on("disconnect", () => {
      if (socket.deviceId && hosts.get(socket.deviceId) === socket) hosts.delete(socket.deviceId);
      for (const [id, p] of live) if (p.host === socket || p.viewer === socket) end(id);
    });
  });
}

module.exports = { attachSignaling, isOnline };