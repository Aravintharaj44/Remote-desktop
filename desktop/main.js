const { app, BrowserWindow, ipcMain, desktopCapturer, session, screen } = require("electron");
const path = require("path");
const { mouse, keyboard, Key, Button, Point } = require("@nut-tree-fork/nut-js");

mouse.config.autoDelayMs = 0;
keyboard.config.autoDelayMs = 0;

let controlEnabled = false;
const downKeys = new Set();
const downButtons = new Set();
const clamp = (n) => Math.min(Math.max(Number(n) || 0, 0), 1);

const SPECIAL = {
  Enter: Key.Enter, NumpadEnter: Key.Enter, Backspace: Key.Backspace, Space: Key.Space, Tab: Key.Tab,
  Escape: Key.Escape, ArrowUp: Key.Up, ArrowDown: Key.Down, ArrowLeft: Key.Left, ArrowRight: Key.Right,
  ShiftLeft: Key.LeftShift, ShiftRight: Key.RightShift, ControlLeft: Key.LeftControl,
  ControlRight: Key.RightControl, AltLeft: Key.LeftAlt, AltRight: Key.RightAlt,
  MetaLeft: Key.LeftSuper, MetaRight: Key.RightSuper, Delete: Key.Delete, Home: Key.Home, End: Key.End,
  PageUp: Key.PageUp, PageDown: Key.PageDown, Insert: Key.Insert, CapsLock: Key.CapsLock,
  Minus: Key.Minus, Equal: Key.Equal, BracketLeft: Key.LeftBracket, BracketRight: Key.RightBracket,
  Backslash: Key.Backslash, Semicolon: Key.Semicolon, Quote: Key.Quote, Comma: Key.Comma,
  Period: Key.Period, Slash: Key.Slash, Backquote: Key.Grave,
};

function toKey(code) {
  if (/^Key[A-Z]$/.test(code)) return Key[code.slice(3)];
  if (/^Digit\d$/.test(code)) return Key["Num" + code.slice(5)];
  if (/^F\d{1,2}$/.test(code)) return Key[code];
  if (/^Numpad\d$/.test(code)) return Key["NumPad" + code.slice(6)];
  return SPECIAL[code];
}

function toScreenPoint(nx, ny) {
  const b = screen.getPrimaryDisplay().bounds;
  const dip = { x: Math.round(b.x + nx * b.width), y: Math.round(b.y + ny * b.height) };
  // convert DIP -> physical pixels (fixes Windows display scaling)
  const p = process.platform !== "darwin" && screen.dipToScreenPoint ? screen.dipToScreenPoint(dip) : dip;
  return new Point(p.x, p.y);
}

async function releaseAll() {
  for (const k of downKeys) await keyboard.releaseKey(k).catch(() => {});
  for (const b of downButtons) await mouse.releaseButton(b).catch(() => {});
  downKeys.clear();
  downButtons.clear();
}

const buttonOf = (n) => (n === 2 ? Button.RIGHT : n === 1 ? Button.MIDDLE : Button.LEFT);

async function handle(ev) {
  switch (ev.t) {
    case "move":
      await mouse.setPosition(toScreenPoint(clamp(ev.x), clamp(ev.y)));
      break;
    case "down": {
      await mouse.setPosition(toScreenPoint(clamp(ev.x), clamp(ev.y)));
      const b = buttonOf(ev.b);
      downButtons.add(b);
      await mouse.pressButton(b);
      break;
    }
    case "up": {
      await mouse.setPosition(toScreenPoint(clamp(ev.x), clamp(ev.y)));
      const b = buttonOf(ev.b);
      downButtons.delete(b);
      await mouse.releaseButton(b);
      break;
    }
    case "wheel": {
      const n = Math.max(1, Math.round(Math.abs(Number(ev.dy) || 0) / 40));
      await (ev.dy > 0 ? mouse.scrollDown(n) : mouse.scrollUp(n));
      break;
    }
    case "kdown": {
      const k = toKey(String(ev.code));
      if (k === undefined) break;
      downKeys.add(k);
      await keyboard.pressKey(k);
      break;
    }
    case "kup": {
      const k = toKey(String(ev.code));
      if (k === undefined) break;
      downKeys.delete(k);
      await keyboard.releaseKey(k);
      break;
    }
    case "release":
      await releaseAll();
      break;
  }
}

// Serialized queue; mouse-move events are merged so we never fall behind
let queue = Promise.resolve();
let pendingMove = null;
const enqueue = (fn) => { queue = queue.then(fn).catch((e) => console.error("input error:", e.message)); };

ipcMain.on("input", (_e, ev) => {
  if (!controlEnabled || !ev || typeof ev !== "object") return;
  if (ev.t === "move") {
    const already = !!pendingMove;
    pendingMove = ev;
    if (already) return;
    enqueue(async () => { const m = pendingMove; pendingMove = null; await handle(m); });
    return;
  }
  enqueue(() => handle(ev));
});

ipcMain.handle("control:set", (_e, on) => {
  controlEnabled = !!on;
  if (!on) enqueue(releaseAll);
});

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    const primary = String(screen.getPrimaryDisplay().id);
    cb({ video: sources.find((s) => s.display_id === primary) || sources[0] });
  });

  const win = new BrowserWindow({
    width: 480, height: 640,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(process.env.HOST_URL || "http://localhost:5173/host");
});

app.on("window-all-closed", () => app.quit());