import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { ProjectManager } from './services/ProjectManager';
import fs from 'fs';

// Declare Vite environment variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Initialize auto-updates
const { updateElectronApp } = require('update-electron-app');
updateElectronApp({
  repo: 'YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME'
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize project manager
const projectManager = new ProjectManager();

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// Project management IPC handlers
ipcMain.handle('create-project', async (_, { name, folderPath, aemSdkPath, licensePath }) => {
  return projectManager.createProject(name, folderPath, aemSdkPath, licensePath);
});

ipcMain.handle('load-project', async (_, id) => {
  return projectManager.loadProject(id);
});

ipcMain.handle('get-all-projects', async () => {
  return projectManager.getAllProjects();
});

ipcMain.handle('update-project', async (_, { id, updates }) => {
  return projectManager.updateProject(id, updates);
});

ipcMain.handle('delete-project', async (_, id) => {
  return projectManager.deleteProject(id);
});

ipcMain.handle('set-last-project-id', async (_, id) => {
  projectManager.setLastProjectId(id);
  return true;
});

ipcMain.handle('get-last-project-id', async () => {
  return projectManager.getLastProjectId();
});

ipcMain.handle('show-open-dialog', async (_, options) => {
  return dialog.showOpenDialog(options);
});

// File system operations
ipcMain.handle('read-directory', async (_, dirPath, showHidden = false) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => showHidden || !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        isSymlink: entry.isSymbolicLink()
      }));
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
});

ipcMain.handle('check-file-exists', async (_, filePath) => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('read-file', async (_, filePath) => {
  try {
    const stat = await fs.promises.stat(filePath);
    
    // Only read text files under 5MB to avoid performance issues
    const isLargeFile = stat.size > 5 * 1024 * 1024;
    if (isLargeFile) {
      return { error: 'File is too large to read (>5MB)' };
    }
    
    // Read the file as UTF-8 text
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { content };
  } catch (error: any) {
    console.error('Error reading file:', error);
    return { error: `Error reading file: ${error.message}` };
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
