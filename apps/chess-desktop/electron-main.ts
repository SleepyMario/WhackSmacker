import { app, BrowserWindow } from "electron";
import { join } from "node:path";

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 760,
    minWidth: 640,
    minHeight: 560,
    title: "WhackSmacker Chess",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, "preload.js")
    }
  });

  if (process.env.VITE_DEV_SERVER_URL !== undefined) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    return;
  }

  await mainWindow.loadFile(join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  void createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
