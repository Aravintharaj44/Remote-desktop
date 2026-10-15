import { useEffect, useRef, useState } from "react";
import { connectSocket, startHostPeer } from "../services/rtc";
import { createDevice } from "../api";

export default function HostPanel({ token }) {
  const [deviceId, setDeviceId] = useState(localStorage.getItem("deviceId") || "");
  const [incoming, setIncoming] = useState(null);
  const [active, setActive] = useState(null);
  const socketRef = useRef(null);
  const stopRef = useRef(null);
  const [online, setOnline] = useState(false);

  async function register() {
    const { device } = await createDevice(token, { name: "My computer", platform: navigator.platform });
    localStorage.setItem("deviceId", device.id);
    setDeviceId(device.id);
  }

  useEffect(() => {
    if (!deviceId) return;
    const s = connectSocket(token);
    socketRef.current = s;
    // s.on("connect", () => s.emit("host:online", { deviceId }));
    s.on("connect", () => {
      s.emit("host:online", { deviceId }, (res) => {
        if (res?.ok) {
          setOnline(true);
        } else {
          // stored ID belongs to another account, so reset and re-register
          localStorage.removeItem("deviceId");
          setDeviceId("");
          setOnline(false);
        }
      });
    });
    s.on("disconnect", () => setOnline(false));
    s.on("session:incoming", setIncoming);
    s.on("session:ready", async ({ sessionId }) => {
      stopRef.current = await startHostPeer({ socket: s, sessionId, onEnd: () => endSession(sessionId) });
      await window.remoteDesk.setControl(true);
      setActive({ sessionId });
    });
    s.on("session:ended", cleanup);
    return () => { cleanup(); s.disconnect(); };
  }, [deviceId, token]);

  function cleanup() {
    window.remoteDesk.setControl(false);
    stopRef.current?.(); stopRef.current = null;
    setActive(null); setIncoming(null);
  }
  function endSession(sessionId) { socketRef.current?.emit("session:end", { sessionId }); cleanup(); }
  function respond(accept) {
    socketRef.current.emit("session:respond", { sessionId: incoming.sessionId, accept });
    setIncoming(null);
  }

  if (!deviceId) return <button onClick={register}>Register this computer</button>;
  return (
    <section className="panel">
      <p>Device ID: <code>{deviceId}</code> ({online ? "online" : "connecting…"})</p>
      {incoming && (
        <div role="alertdialog">
          <p><b>{incoming.from}</b> wants to view and control this computer.</p>
          <button onClick={() => respond(true)}>Allow</button>
          <button className="secondary" onClick={() => respond(false)}>Deny</button>
        </div>
      )}
      {active && (
        <div className="banner">
          🔴 Your screen is being shared and controlled.
          <button onClick={() => endSession(active.sessionId)}>Stop</button>
        </div>
      )}
    </section>
  );
}