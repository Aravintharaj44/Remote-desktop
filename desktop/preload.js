const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("remoteDesk", {
  setControl: (on) => ipcRenderer.invoke("control:set", on),
  sendInput: (ev) => ipcRenderer.send("input", ev),
});