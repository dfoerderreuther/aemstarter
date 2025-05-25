import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { ProjectManager } from './main/services/ProjectManager';
import { Installer } from './main/installer/Installer';
import { AemInstanceManager } from './main/services/AemInstanceManager';
import { ProjectSettings } from './main/services/ProjectSettings';
import fs from 'fs';
import { Project } from './types/Project';

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

// Store AEM instance managers
const instanceManagers = new Map<string, AemInstanceManager>();

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';",
          "script-src 'self' 'unsafe-eval';",
          "style-src 'self' 'unsafe-inline';",
          "font-src 'self' data:;",
          "img-src 'self' data:;",
          "connect-src 'self';",
          "worker-src 'self' blob:;"
        ].join(' ')
      }
    });
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
  return projectManager.getProject(id);
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
  return projectManager.setLastProjectId(id);
});

ipcMain.handle('get-last-project-id', async () => {
  return projectManager.getLastProjectId();
});

ipcMain.handle('get-global-settings', async () => {
  return projectManager.getGlobalSettings();
});

ipcMain.handle('set-global-settings', async (_, settings) => {
  projectManager.setGlobalSettings(settings);
  return true;
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

ipcMain.handle('read-file', async (_, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { content };
  } catch (error) {
    console.error('Error reading file:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('write-file', async (_, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return {};
  } catch (error) {
    console.error('Error writing file:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

// AEM Installation
ipcMain.handle('install-aem', async (_, project: Project) => {
  try {
    const installer = new Installer(project);
    await installer.install();
    return true;
  } catch (error) {
    console.error('Error installing AEM:', error);
    throw error;
  }
});

ipcMain.handle('delete-aem', async (_, project: Project) => {
  try {
    const installer = new Installer(project);
    await installer.delete();
    return true;
  } catch (error) {
    console.error('Error deleting AEM:', error);
    throw error;
  }
});

// AEM Instance Management
ipcMain.handle('start-aem-instance', async (_, project: Project, instanceType: 'author' | 'publisher', options: { port: number; runmode: string; jvmOpts: string; debugPort?: number }) => {
  try {
    let manager = instanceManagers.get(project.id);
    if (!manager) {
      manager = new AemInstanceManager(project);
      instanceManagers.set(project.id, manager);
    }

    // Determine start type based on whether debug port is provided
    const startType = options.debugPort ? 'debug' : 'start';
    await manager.startInstance(instanceType, startType);
    return true;
  } catch (error) {
    console.error('Error starting AEM instance:', error);
    throw error;
  }
});

ipcMain.handle('stop-aem-instance', async (_, project: Project, instanceType: 'author' | 'publisher') => {
  try {
    const manager = instanceManagers.get(project.id);
    if (!manager) {
      return false;
    }

    await manager.stopInstance(instanceType);
    return true;
  } catch (error) {
    console.error('Error stopping AEM instance:', error);
    throw error;
  }
});

ipcMain.handle('is-aem-instance-running', (_, project: Project, instanceType: 'author' | 'publisher') => {
  const manager = instanceManagers.get(project.id);
  return manager ? manager.isInstanceRunning(instanceType) : false;
});

ipcMain.handle('get-aem-instance-pid', (_, project: Project, instanceType: 'author' | 'publisher') => {
  const manager = instanceManagers.get(project.id);
  return manager ? manager.getInstancePid(instanceType) : null;
});

ipcMain.handle('get-available-log-files', (_, project: Project, instanceType: 'author' | 'publisher') => {
  console.log(`[main.ts] get-available-log-files called for project ${project.id}, instance ${instanceType}`);
  console.log(`[main.ts] Available managers:`, Array.from(instanceManagers.keys()));
  
  let manager = instanceManagers.get(project.id);
  if (!manager) {
    console.log(`[main.ts] No manager found, creating new AemInstanceManager for project ${project.id}`);
    manager = new AemInstanceManager(project);
    instanceManagers.set(project.id, manager);
  }
  
  console.log(`[main.ts] Calling manager.getAvailableLogFiles(${instanceType})`);
  const result = manager.getAvailableLogFiles(instanceType);
  console.log(`[main.ts] Manager returned:`, result);
  return result;
});

ipcMain.handle('get-selected-log-files', (_, project: Project, instanceType: 'author' | 'publisher') => {
  let manager = instanceManagers.get(project.id);
  if (!manager) {
    manager = new AemInstanceManager(project);
    instanceManagers.set(project.id, manager);
  }
  return manager.getSelectedLogFiles(instanceType);
});

ipcMain.handle('update-log-files', async (_, project: Project, instanceType: 'author' | 'publisher', logFiles: string[]) => {
  try {
    let manager = instanceManagers.get(project.id);
    if (!manager) {
      manager = new AemInstanceManager(project);
      instanceManagers.set(project.id, manager);
    }

    await manager.updateLogFiles(instanceType, logFiles);
    return true;
  } catch (error) {
    console.error('Error updating log files:', error);
    throw error;
  }
});

ipcMain.handle('kill-all-aem-instances', async (_, project: Project) => {
  try {
    const manager = instanceManagers.get(project.id);
    if (!manager) {
      return false;
    }

    await manager.killAllInstances();
    return true;
  } catch (error) {
    console.error('Error killing all AEM instances:', error);
    throw error;
  }
});

// Project Settings
ipcMain.handle('get-project-settings', async (_, project: Project) => {
  try {
    return ProjectSettings.getSettings(project);
  } catch (error) {
    console.error('Error getting project settings:', error);
    throw error;
  }
});

ipcMain.handle('save-project-settings', async (_, project: Project, settings: any) => {
  try {
    ProjectSettings.saveSettings(project, settings);
    return true;
  } catch (error) {
    console.error('Error saving project settings:', error);
    throw error;
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
