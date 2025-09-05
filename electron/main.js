const { app, BrowserWindow, ipcMain, protocol, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Secure path validation in main process (source of truth)
function validatePath(filePath) {
  const userDataPath = app.getPath('userData');
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(userDataPath)) {
    throw new Error('Access denied: Path outside allowed directory');
  }
  return resolvedPath;
}

// Keep a global reference of the window object
let mainWindow;
let oauthWindow;
let oauthCallback = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../resources/icon.png'),
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register custom protocol for OAuth callback
function registerOAuthProtocol() {
  protocol.registerHttpProtocol('ownjournal', (request, callback) => {
    const url = request.url;
    
    // Parse the OAuth callback URL
    if (url.startsWith('ownjournal://oauth/callback')) {
      if (oauthCallback) {
        oauthCallback(url);
        oauthCallback = null;
      }
      
      // Close OAuth window if open
      if (oauthWindow && !oauthWindow.isDestroyed()) {
        oauthWindow.close();
      }
    }
    
    callback({ url: 'about:blank' });
  });
}

// Handle OAuth flow
ipcMain.handle('oauth:start', async (event, authUrl) => {
  return new Promise((resolve, reject) => {
    oauthWindow = new BrowserWindow({
      width: 600,
      height: 700,
      show: false,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    oauthWindow.loadURL(authUrl);
    
    oauthWindow.once('ready-to-show', () => {
      oauthWindow.show();
    });

    // Store callback for protocol handler
    oauthCallback = (callbackUrl) => {
      resolve(callbackUrl);
    };

    // Handle window close
    oauthWindow.on('closed', () => {
      oauthWindow = null;
      if (oauthCallback) {
        oauthCallback = null;
        reject(new Error('OAuth window closed by user'));
      }
    });

    // Intercept navigation to catch redirect
    oauthWindow.webContents.on('will-redirect', (event, url) => {
      if (url.startsWith('ownjournal://')) {
        event.preventDefault();
        if (oauthCallback) {
          oauthCallback(url);
          oauthCallback = null;
        }
        oauthWindow.close();
      }
    });

    // Also check on did-navigate
    oauthWindow.webContents.on('did-navigate', (event, url) => {
      if (url.startsWith('ownjournal://')) {
        if (oauthCallback) {
          oauthCallback(url);
          oauthCallback = null;
        }
        oauthWindow.close();
      }
    });
  });
});

// Native file system operations
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const validPath = validatePath(filePath);
    const data = await fs.promises.readFile(validPath, 'utf8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  try {
    const validPath = validatePath(filePath);
    await fs.promises.writeFile(validPath, data, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:deleteFile', async (event, filePath) => {
  try {
    const validPath = validatePath(filePath);
    await fs.promises.unlink(validPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:listFiles', async (event, dirPath) => {
  try {
    const validPath = validatePath(dirPath);
    const files = await fs.promises.readdir(validPath);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  registerOAuthProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle deep links on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('ownjournal://') && oauthCallback) {
    oauthCallback(url);
    oauthCallback = null;
    if (oauthWindow && !oauthWindow.isDestroyed()) {
      oauthWindow.close();
    }
  }
});

// Set as default protocol client
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('ownjournal', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('ownjournal');
}
