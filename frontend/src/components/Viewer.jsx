import { useEffect, useRef, useState } from "react";
import { connectSocket, startViewerPeer } from "../services/rtc";
import { listDevices } from "../api";

export default function Viewer({ token }) {
    const [devices, setDevices] = useState([]);
    const [status, setStatus] = useState("");
    const [remoteId, setRemoteId] = useState("");
    const [sessionId, setSessionId] = useState(null);
    const videoRef = useRef(null);
    const chRef = useRef(null);
    const socketRef = useRef(null);
    const stopRef = useRef(null);
    const lastMove = useRef(0);

    useEffect(() => {
        listDevices(token).then((r) => setDevices(r.devices));
        const s = connectSocket(token);
        socketRef.current = s;
        s.on("session:denied", () => setStatus("Request denied"));
        s.on("session:ended", () => { stopRef.current?.(); setSessionId(null); setStatus("Session ended"); });
        return () => s.disconnect();
    }, [token]);

    function connect(deviceId) {
        const s = socketRef.current;
        setStatus("Waiting for approval…");
        s.once("session:accepted", ({ sessionId }) => {
            setSessionId(sessionId);
            stopRef.current = startViewerPeer({
                socket: s, sessionId, videoEl: videoRef.current,
                onChannel: (ch) => { chRef.current = ch; setStatus("Connected"); },
            });
        });
        s.emit("session:request", { deviceId }, (res) => !res.ok && setStatus(res.message || "Failed"));
    }

    const send = (ev) => chRef.current?.readyState === "open" && chRef.current.send(JSON.stringify(ev));
    const pos = (e) => {
        const r = videoRef.current.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };

    return (
        <section className="panel">
            {devices.map((d) => (
                <button key={d.id} disabled={!d.online} onClick={() => connect(d.id)}>
                    {d.name} {d.online ? "(online)" : "(offline)"}
                </button>
            ))}
            <p role="status">{status}</p>
            {sessionId && <button onClick={() => socketRef.current.emit("session:end", { sessionId })}>Disconnect</button>}
            <input
                value={remoteId}
                onChange={(e) => setRemoteId(e.target.value.trim())}
                placeholder="Enter remote Device ID"
            />
            <button onClick={() => connect(remoteId)} disabled={!remoteId}>Connect</button>
            <video
                ref={videoRef} autoPlay playsInline muted tabIndex={0}
                style={{ width: "100%", background: "#000", outline: "none", display: sessionId ? "block" : "none" }}
                onMouseMove={(e) => { const n = performance.now(); if (n - lastMove.current > 16) { lastMove.current = n; send({ t: "move", ...pos(e) }); } }}
                onMouseDown={(e) => send({ t: "down", b: e.button, ...pos(e) })}
                onMouseUp={(e) => send({ t: "up", b: e.button, ...pos(e) })}
                onWheel={(e) => send({ t: "wheel", dy: e.deltaY })}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => { e.preventDefault(); send({ t: "kdown", code: e.code }); }}
                onKeyUp={(e) => { e.preventDefault(); send({ t: "kup", code: e.code }); }}
            />
        </section>
    );
}