const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

// Start the server
// We import the server logic. We might need to adjust server/index.js 
// to ensure it doesn't conflict with Electron or handles paths correctly.
require('./server/index.js');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'client', 'public', 'favicon.svg')
  });

  // Remove the menu bar
  mainWindow.setMenu(null);
  
  // Open maximized
  mainWindow.maximize();

  // Permite abrir o DevTools com Ctrl+Shift+I mesmo em produção
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev) {
    // Wait a bit for Vite to start
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        // Retry if it fails
        setTimeout(() => mainWindow.loadURL('http://localhost:5173'), 2000);
      });
    }, 1000);
    // Open DevTools by default in dev mode
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
