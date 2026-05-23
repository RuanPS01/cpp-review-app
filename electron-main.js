const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

// Start the server
require('./server/index.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
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

// IPC Handler for Moodle Login & Cookie Capture
ipcMain.handle('open-moodle-login', async (event, moodleUrl, credentials) => {
  return new Promise((resolve) => {
    const loginWin = new BrowserWindow({
      width: 1000,
      height: 800,
      parent: mainWindow,
      modal: true,
      title: 'Conectando ao Moodle...',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    loginWin.loadURL(moodleUrl);

    let loginAttempted = false;
    let isClosed = false;

    const interval = setInterval(async () => {
      if (isClosed || loginWin.isDestroyed()) {
        clearInterval(interval);
        return;
      }
      await checkCookies();
    }, 2000);

    const checkCookies = async () => {
      if (isClosed || loginWin.isDestroyed()) return;

      try {
        const currentUrl = loginWin.webContents.getURL();
        
        // Auto-fill logic with more robust checks
        if (currentUrl.includes('login/index.php') && credentials && !loginAttempted) {
            console.log('[DEBUG] Attempting auto-fill...');
            await loginWin.webContents.executeJavaScript(`
                (function() {
                    const u = document.getElementById('username');
                    const p = document.getElementById('password');
                    if (u && p) {
                        u.value = "${credentials.username}";
                        p.value = "${credentials.password}";
                        const btn = document.querySelector('button[type="submit"]') || 
                                    document.getElementById('loginbtn') || 
                                    document.querySelector('form input[type="submit"]');
                        if (btn) {
                            btn.click();
                            return true;
                        }
                    }
                    return false;
                })()
            `).then(success => {
                if (success) {
                    console.log('[DEBUG] Auto-fill submitted.');
                    loginAttempted = true;
                }
            }).catch(e => console.error('[DEBUG] JS Auto-fill error:', e));
        }

        // Wait until we are NO LONGER on the login page AND have a MoodleSession
        if (currentUrl.includes('login/index.php') || currentUrl.includes('error=')) {
            return;
        }

        const cookies = await loginWin.webContents.session.cookies.get({});
        const moodleSession = cookies.find(c => c.name === 'MoodleSession');
        
        if (moodleSession) {
          // Extra wait to ensure all tokens are finalized
          await new Promise(r => setTimeout(r, 1500));
          
          if (isClosed || loginWin.isDestroyed()) return;

          const finalCookies = await loginWin.webContents.session.cookies.get({});
          const cookieString = finalCookies.map(c => `${c.name}=${c.value}`).join('; ');
          const userAgent = loginWin.webContents.getUserAgent();
          
          console.log(`[DEBUG] Session captured successfully from ${currentUrl}`);
          isClosed = true;
          clearInterval(interval);
          resolve({ cookie: cookieString, userAgent });
          loginWin.close();
        }
      } catch (e) {
        if (!e.message?.includes('destroyed')) {
            console.error('Error during cookie check:', e);
        }
      }
    };

    loginWin.webContents.on('did-finish-load', checkCookies);
    loginWin.webContents.on('did-navigate', checkCookies);

    loginWin.on('closed', () => {
      isClosed = true;
      clearInterval(interval);
      resolve(null);
    });
  });
});

ipcMain.handle('moodle-download-zip', async (event, url) => {
  try {
    const { net } = require('electron');
    const response = await session.defaultSession.fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    return {
      success: true,
      data: Buffer.from(buffer).toString('base64'), // Send as base64 to renderer
      url: response.url
    };
  } catch (e) {
    console.error('Electron Download Error:', e);
    return { success: false, error: e.message };
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
