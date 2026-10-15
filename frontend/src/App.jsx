import { useState } from "react";
import { loginUser, registerUser } from "./api";
import "./App.css";
import HostPanel from "./components/HostPanel";
import Viewer from "./components/Viewer";
export default function App() {
  const isHost = window.location.pathname === "/host";
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const result =
        mode === "login"
          ? await loginUser({ email, password })
          : await registerUser({ name, email, password });

      setUser(result.user);
      setToken(result.token);
      setMessage("Successfully authenticated.");
      setPassword("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setUser(null);
    setToken("");
    setDeviceId("");
    setMessage("You have signed out.");
  }

  if (user) {
    return (
      <main className="shell">
        <header className="topbar">
          <h1>RemoteDesk</h1>
          <button onClick={logout}>Sign out</button>
        </header>

        <section className="panel">
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h2>Welcome, {user.name}</h2>
          <p>{user.email}</p>

          {isHost ? (
            <HostPanel token={token} />
          ) : (
            <Viewer token={token} />
          )}
        </section>

        {message && <p role="status">{message}</p>}
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">SECURE REMOTE ACCESS</p>
        <h1>RemoteDesk</h1>
        <p>Connect to computers you own or are authorized to access.</p>

        <div className="tabs">
          <button
            className={mode === "login" ? "selected" : "secondary"}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "selected" : "secondary"}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={80}
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
          </label>

          <button type="submit" disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {message && <p role="status">{message}</p>}
      </section>
    </main>
  );
}