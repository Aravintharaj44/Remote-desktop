const { app, BrowserWindow, ipcMain, desktopCapturer, session, screen } = require("electron");
const path = require("path");
const { mouse, keyboard, Key, Button, Point } = require("@nut-tree-fork/nut-js");

let controlEnabled = false;
mouse.config.mouseSpeed = 100000; // snap instantly
keyboard.config.autoDelayMs = 0;

function toKey(code) {
  if (/^Key[A-Z]$/.test(code)) return Key[code.slice(3)];
  if (/^Digit\d$/.test(code)) return Key["Num" + code.slice(5)];
  const map = { Enter: Key.Enter, Backspace: Key.Backspace, Space: Key.Space, Tab: Key.Tab, Escape: Key.Escape,
    ArrowUp: Key.Up, ArrowDown: Key.Down, ArrowLeft: Key.Left, ArrowRight: Key.Right,
    ShiftLeft: Key.LeftShift, ShiftRight: Key.RightShift, ControlLeft: Key.LeftControl, ControlRight: Key.RightControl,
    AltLeft: Key.LeftAlt, AltRight: Key.RightAlt, Delete: Key.Delete, Home: Key.Home, End: Key.End };
  return map[code];
}

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    cb({ video: sources[0] });
  });

  const win = new BrowserWindow({
    width: 480, height: 640,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(process.env.HOST_URL || "http://localhost:5173/host");
});

ipcMain.handle("control:set", (_e, on) => { controlEnabled = !!on; });

ipcMain.on("input", async (_e, ev) => {
  if (!controlEnabled || !ev || typeof ev !== "object") return;
  const { bounds } = screen.getPrimaryDisplay();
  try {
    if (ev.t === "move" || ev.t === "down" || ev.t === "up") {
      const x = Math.min(Math.max(Number(ev.x), 0), 1), y = Math.min(Math.max(Number(ev.y), 0), 1);
      await mouse.setPosition(new Point(bounds.x + x * bounds.width, bounds.y + y * bounds.height));
    }
    const btn = ev.b === 2 ? Button.RIGHT : ev.b === 1 ? Button.MIDDLE : Button.LEFT;
    if (ev.t === "down") await mouse.pressButton(btn);
    else if (ev.t === "up") await mouse.releaseButton(btn);
    else if (ev.t === "wheel") await (ev.dy > 0 ? mouse.scrollDown(3) : mouse.scrollUp(3));
    else if (ev.t === "kdown" || ev.t === "kup") {
      const k = toKey(String(ev.code));
      if (k !== undefined) await (ev.t === "kdown" ? keyboard.pressKey(k) : keyboard.releaseKey(k));
    }
  } catch (e) { console.error("input error", e.message); }
});