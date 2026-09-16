const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let splashWindow = null;

let splashStartTime = Date.now();
const MIN_SPLASH_TIME = 3200; // Preserve 3.2s developer advertisement duration

function createSplashWindow() {
    splashStartTime = Date.now();
    splashWindow = new BrowserWindow({
        width: 520,
        height: 460,
        frame: false,
        transparent: false,
        alwaysOnTop: true,
        resizable: false,
        show: true,
        backgroundColor: '#0a0f1d',
        icon: path.join(__dirname, 'icons', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.center();
    splashWindow.show();
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1320,
        height: 850,
        minWidth: 1050,
        minHeight: 680,
        autoHideMenuBar: true,
        show: false,
        backgroundColor: '#0f172a',
        icon: path.join(__dirname, 'icons', 'icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        },
        title: "منظومة ضيوف الحرم لإدارة الرحلات والمانفيست"
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    let isRevealed = false;
    const revealMainWindow = () => {
        if (isRevealed) return;
        isRevealed = true;
        const elapsed = Date.now() - splashStartTime;
        const remaining = Math.max(0, MIN_SPLASH_TIME - elapsed);

        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
                splashWindow = null;
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.show();
                mainWindow.focus();
            }
        }, remaining);
    };

    mainWindow.webContents.on('did-finish-load', () => {
        revealMainWindow();
    });

    // Fallback: reveal main window after 10s max even if CDN scripts hang
    setTimeout(() => {
        revealMainWindow();
    }, 10000);

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.destroy();
            splashWindow = null;
        }
        app.exit(0);
    });
}

const fs = require('fs');
const { exec } = require('child_process');

function ensureDesktopShortcut() {
    if (process.platform !== 'win32') return;
    try {
        const targetExe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
        if (!targetExe || !fs.existsSync(targetExe)) return;

        // Skip if running from Temp without portable env
        if (!process.env.PORTABLE_EXECUTABLE_FILE && targetExe.toLowerCase().includes('\\temp\\')) {
            return;
        }

        const desktopDir = path.join(process.env.USERPROFILE || '', 'Desktop');
        const shortcutPath = path.join(desktopDir, 'ضيوف الحرم.lnk');

        if (!fs.existsSync(shortcutPath)) {
            const targetDir = path.dirname(targetExe);
            const psScript = `$w=(New-Object -COM WScript.Shell);$s=$w.CreateShortcut('${shortcutPath.replace(/'/g, "''")}');$s.TargetPath='${targetExe.replace(/'/g, "''")}';$s.WorkingDirectory='${targetDir.replace(/'/g, "''")}';$s.Description='منظومة ضيوف الحرم لإدارة الرحلات والمانفيست';$s.Save();`;
            exec(`powershell -NoProfile -Command "${psScript}"`, () => {});
        }
    } catch (e) {
        // silent fail
    }
}

// Passport OCR Scanner IPC Handler (Runs on Node Main Process)
ipcMain.handle('scan-passport-image', async (event, imageSource) => {
    try {
        let scannerPath = path.join(__dirname, 'assets', 'ocr', 'passport-scanner.js');
        if (typeof process !== 'undefined' && process.resourcesPath) {
            const unpackedDirect = path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'ocr', 'passport-scanner.js');
            if (fs.existsSync(unpackedDirect)) scannerPath = unpackedDirect;
        }
        if (scannerPath.includes('app.asar') && !scannerPath.includes('app.asar.unpacked')) {
            const unpacked = scannerPath.replace('app.asar', 'app.asar.unpacked');
            if (fs.existsSync(unpacked)) scannerPath = unpacked;
        }
        const scanner = require(scannerPath);
        const result = await scanner.scanPassportImageFile(imageSource, (progress) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('passport-scan-progress', progress);
            }
        });
        return { success: true, ...result };
    } catch (err) {
        console.error('Passport OCR scan error in main process:', err);
        return { success: false, error: err.message || 'فشلت عملية قراءة الجواز' };
    }
});

// ==========================================
// 🚀 SILENT AUTO-UPDATER (GitHub Releases)
// ==========================================
let autoUpdater = null;
try {
    const updaterModule = require('electron-updater');
    autoUpdater = updaterModule.autoUpdater;
    if (autoUpdater) {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
    }
} catch (e) {
    console.warn('AutoUpdater initialization note:', e.message);
}

function setupAutoUpdater() {
    if (!autoUpdater) return;

    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('app-update-available', info);
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded successfully:', info.version);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('app-update-downloaded', info);
        }
    });

    autoUpdater.on('error', (err) => {
        console.warn('AutoUpdater background check note:', err ? err.message : err);
    });

    // Check on startup after 8 seconds (when splash is done)
    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(e => console.warn('Update check catch:', e.message));
    }, 8000);

    // Periodically check every 2 hours in background
    setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify().catch(e => console.warn('Periodic update catch:', e.message));
    }, 2 * 60 * 60 * 1000);
}

ipcMain.on('apply-app-update-now', () => {
    if (autoUpdater) {
        try {
            autoUpdater.quitAndInstall(false, true);
        } catch (e) {
            console.error('quitAndInstall error:', e);
        }
    }
});

app.whenReady().then(() => {
    createSplashWindow();
    createMainWindow();
    setTimeout(() => {
        ensureDesktopShortcut();
    }, 1500);
    setupAutoUpdater();
});

app.on('window-all-closed', () => {
    app.exit(0);
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});