import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron";
// import { createRequire } from 'node:module'
import { fileURLToPath } from "node:url";
import path from "node:path";

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let tray: Tray | null = null;
// "앱이 종료를 진행 중인지"를 추적하기 위한 변수
let isQuitting: boolean = false;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win?.hide();
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

function createTray(): void {
  // 트레이 아이콘 경로 지정
  const iconPath = path.join(process.env.VITE_PUBLIC, "tray.png");
  const trayIcon = nativeImage.createFromPath(iconPath);

  // Tray 생성
  tray = new Tray(trayIcon);
  tray.setToolTip("My Electron App");

  // Tray 우클릭 메뉴
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: () => {
        win?.show();
      },
    },
    {
      label: "Quit",
      click: () => {
        // 여기서만 실제로 앱을 종료하도록
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);

  // 트레이 아이콘을 더블클릭했을 때 메인 윈도우 보이기
  tray.on("double-click", () => {
    win?.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      win?.show();
    }
  });
});

// 모든 창이 닫혀도 완전히 종료하지 않으려면 아래처럼 처리 가능
app.on("window-all-closed", (event: { preventDefault: () => void }) => {
  // Windows, Linux 등에서 기본적으로 app.quit()이 실행되지 않도록
  event.preventDefault();
});
