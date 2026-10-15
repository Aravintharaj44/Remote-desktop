import { useEffect, useRef, useState } from "react";
import { connectSocket, startViewerPeer } from "../services/rtc";
import { listDevices } from "../api";

const clamp = (n) => Math.min(Math.max(n, 0), 1);

export default function Viewer({ token }) {
  const [devices, setDevices] = useState([]);
  const [remoteId, setRemoteId] = useState("");
  const [status, setStatus] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  const boxRef = useRef(null);
  const videoRef = useRef(null);
  const chRef = useRef(null);
  const socketRef = useRef(null);
  const stopRef = useRef(null);
  const lastMove = useRef(0);

  const send = (ev) => chRef.current?.readyState === "open" && chRef.current.send(JSON.stringify(ev));

  // Position inside the REAL video picture (ignores black letterbox bars)
  const pos = (e) => {
    const v = videoRef.current;
    const r = v.getBoundingClientRect();
    if (!v.videoWidth) return { x: 0, y: 0 };
    const scale = Math.min(r.width / v.videoWidth, r.height / v.videoHeight);
    const w = v.videoWidth * scale, h = v.videoHeight * scale;
    const ox = r.left + (r.width - w) / 2, oy = r.top + (r.height - h) / 2;
    return { x: clamp((e.clientX - ox) / w), y: clamp((e.clientY - oy) / h) };
  };

  useEffect(() => {
    listDevices(token).then((r) => setDevices(r.devices)).catch(() => {});
    const s = connectSocket(token);
    socketRef.current = s;
    s.on("session:denied", () => setStatus("Request denied"));
    s.on("session:ended", () => {
      stopRef.current?.();
      chRef.current = null;
      setSessionId(null);
      setStatus("Session ended");
      if (document.fullscreenElement) document.exitFullscreen();
    });
    return () => s.disconnect();
  }, [token]);

  // Fullscreen + keyboard lock (lets Alt+Tab, Win key, etc. go to the remote PC)
  useEffect(() => {
    const onChange = () => {
      const fs = !!document.fullscreenElement;
      setFullscreen(fs);
      if (fs) {
        navigator.keyboard?.lock?.().catch(() => {});
        videoRef.current?.focus();
      } else {
        navigator.keyboard?.unlock?.();
        send({ t: "release" });
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Wheel needs a non-passive listener to prevent page scrolling
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onWheel = (e) => { e.preventDefault(); send({ t: "wheel", dy: e.deltaY }); };
    v.addEventListener("wheel", onWheel, { passive: false });
    return () => v.removeEventListener("wheel", onWheel);
  }, []);

  function connect(deviceId) {
    const s = socketRef.current;
    setStatus("Waiting for approval…");
    s.once("session:accepted", ({ sessionId }) => {
      setSessionId(sessionId);
      stopRef.current = startViewerPeer({
        socket: s, sessionId, videoEl: videoRef.current,
        onChannel: (ch) => { chRef.current = ch; setStatus("Connected"); videoRef.current?.focus(); },
      });
    });
    s.emit("session:request", { deviceId }, (res) => !res.ok && setStatus(res.message || "Failed"));
  }

  const goFullscreen = () => boxRef.current?.requestFullscreen?.();
  const disconnect = () => socketRef.current.emit("session:end", { sessionId });

  return (
    <section className="panel">
      {!sessionId && (
        <>
          <input value={remoteId} onChange={(e) => setRemoteId(e.target.value.trim())} placeholder="Enter remote Device ID" />
          <button onClick={() => connect(remoteId)} disabled={!remoteId}>Connect</button>
          {devices.map((d) => (
            <button key={d.id} disabled={!d.online} onClick={() => connect(d.id)}>
              {d.name} {d.online ? "(online)" : "(offline)"}
            </button>
          ))}
        </>
      )}
      <p role="status">{status}</p>

      {sessionId && !fullscreen && (
        <div>
          <button onClick={goFullscreen}>⛶ Full screen</button>{" "}
          <button className="secondary" onClick={disconnect}>Disconnect</button>
        </div>
      )}

      <div ref={boxRef} style={{ background: "#000", display: sessionId ? "block" : "none", position: "relative" }}>
        {fullscreen && (
          <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, opacity: 0.6 }}>
            <button onClick={() => document.exitFullscreen()}>Exit full screen</button>{" "}
            <button onClick={disconnect}>Disconnect</button>
          </div>
        )}
        <video
          ref={videoRef} autoPlay playsInline muted tabIndex={0}
          style={{ width: "100%", height: fullscreen ? "100vh" : "auto", objectFit: "contain", outline: "none", cursor: "none", display: "block" }}
          onMouseMove={(e) => {
            const n = performance.now();
            if (n - lastMove.current > 16) { lastMove.current = n; send({ t: "move", ...pos(e) }); }
          }}
          onMouseDown={(e) => { e.preventDefault(); videoRef.current.focus(); send({ t: "down", b: e.button, ...pos(e) }); }}
          onMouseUp={(e) => send({ t: "up", b: e.button, ...pos(e) })}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => { e.preventDefault(); if (!e.repeat) send({ t: "kdown", code: e.code }); }}
          onKeyUp={(e) => { e.preventDefault(); send({ t: "kup", code: e.code }); }}
          onBlur={() => send({ t: "release" })}
        />
      </div>
    </section>
  );
}