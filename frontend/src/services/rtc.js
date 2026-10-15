import { io } from "socket.io-client";

export const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }; // add TURN for production

export const connectSocket = (token) => io(import.meta.env.VITE_API_URL, { auth: { token } });

// Host: share screen, accept input over data channel
export async function startHostPeer({ socket, sessionId, onEnd }) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
  const pc = new RTCPeerConnection(ICE);
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  const ch = pc.createDataChannel("input");
  ch.onmessage = (e) => { try { window.remoteDesk.sendInput(JSON.parse(e.data)); } catch {} };

  pc.onicecandidate = (e) => e.candidate && socket.emit("signal", { sessionId, data: { candidate: e.candidate } });
  pc.onconnectionstatechange = () => ["failed", "closed", "disconnected"].includes(pc.connectionState) && onEnd();

  const onSignal = async ({ data }) => {
    if (data.answer) await pc.setRemoteDescription(data.answer);
    if (data.candidate) await pc.addIceCandidate(data.candidate);
  };
  socket.on("signal", onSignal);

  await pc.setLocalDescription(await pc.createOffer());
  socket.emit("signal", { sessionId, data: { offer: pc.localDescription } });

  return () => { socket.off("signal", onSignal); stream.getTracks().forEach((t) => t.stop()); pc.close(); };
}

// Viewer: receive video, send input
export function startViewerPeer({ socket, sessionId, videoEl, onChannel }) {
  const pc = new RTCPeerConnection(ICE);
  pc.ontrack = (e) => { videoEl.srcObject = e.streams[0]; };
  pc.ondatachannel = (e) => onChannel(e.channel);
  pc.onicecandidate = (e) => e.candidate && socket.emit("signal", { sessionId, data: { candidate: e.candidate } });

  const onSignal = async ({ data }) => {
    if (data.offer) {
      await pc.setRemoteDescription(data.offer);
      await pc.setLocalDescription(await pc.createAnswer());
      socket.emit("signal", { sessionId, data: { answer: pc.localDescription } });
    }
    if (data.candidate) await pc.addIceCandidate(data.candidate);
  };
  socket.on("signal", onSignal);
  return () => { socket.off("signal", onSignal); pc.close(); };
}