import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
const WINDOW_WIDTH = 1280;
const WINDOW_HEIGHT = 960;

let mainWindow: BrowserWindow | null = null;

function applyWindowMode(win: BrowserWindow) {
  const restore = () => {
    if (win.isDestroyed()) return;

    if (win.isMaximized()) {
      win.unmaximize();
    }

    win.setResizable(false);
    win.setMinimumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
    win.setMaximumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
    win.setSize(WINDOW_WIDTH, WINDOW_HEIGHT, true);
    win.center();
  };

  if (win.isFullScreen()) {
    win.once('leave-full-screen', () => setTimeout(restore, 50));
    win.setFullScreen(false);
    return;
  }

  restore();
}

function applyFullscreenMode(win: BrowserWindow) {
  if (win.isDestroyed()) return;

  const apply = () => {
    if (win.isDestroyed()) return;

    win.setResizable(true);
    win.setMinimumSize(800, 600);
    win.setMaximumSize(10000, 10000);
    win.setFullScreen(true);
  };

  if (win.isFullScreen()) return;

  if (win.isMaximized()) {
    win.unmaximize();
  }

  if (win.isFullScreen()) {
    win.once('leave-full-screen', () => setTimeout(apply, 50));
    win.setFullScreen(false);
    return;
  }

  apply();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    resizable: false,
    fullscreenable: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  applyWindowMode(mainWindow);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('set-display-mode', (_event, mode: 'window' | 'fullscreen') => {
  if (!mainWindow) return false;
  if (mode === 'fullscreen') {
    applyFullscreenMode(mainWindow);
  } else {
    applyWindowMode(mainWindow);
  }
  return true;
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

app.whenReady().then(createWindow);
