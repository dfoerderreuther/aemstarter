import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu } from 'electron';
import path from 'node:path';
import fs from 'fs';
import started from 'electron-squirrel-startup';
import { Installer } from './main/services/Installer';
import { ProjectSettingsService } from './main/services/ProjectSettingsService';
import { PackageInstaller } from './main/services/PackageInstaller';
import { ReplicationSettings } from './main/services/ReplicationSettings';
import { Project, ProjectSettings } from './types/Project';
//import { BackupManager } from './main/services/BackupManager';
import { BackupService } from './main/services/BackupService';
import { SystemCheck } from './main/services/SystemCheck';
import { DevProjectUtils } from './main/services/DevProjectUtils';
import { AemInstanceManagerRegister } from './main/AemInstanceManagerRegister';
import { DispatcherManagerRegister } from './main/DispatcherManagerRegister';
import { ProjectManagerRegister } from './main/ProjectManagerRegister';
import { Automation } from './main/services/automation/Automation';
import { TerminalService } from './main/services/TerminalService';
import { spawn } from 'child_process';

// Set the app name immediately (this affects dock/taskbar display)
app.setName('AEM-Starter');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Set the app name again for emphasis
app.setName('AEM-Starter');

// Increase memory limits for AEM operations
app.commandLine.appendSwitch('max-old-space-size', '8192'); // 8GB
app.commandLine.appendSwitch('max-semi-space-size', '512'); // 512MB

// Setup logging for production builds
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
  const logDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, 'main.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  
  // Redirect console output to log file
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  console.log = (...args) => {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] LOG: ${args.join(' ')}\n`);
    originalConsoleLog(...args);
  };
  
  console.error = (...args) => {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ERROR: ${args.join(' ')}\n`);
    originalConsoleError(...args);
  };
  
  console.log('Main process logging initialized. Log file:', logFile);
}

// Declare Vite environment variables
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// Initialize auto-updates
//const { updateElectronApp } = require('update-electron-app');
//updateElectronApp({
//  repo: 'YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME'
//});

// Store reference to main window for menu actions
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  const getIconPath = () => {
    const iconDir = process.env.NODE_ENV === 'development' 
      ? path.join(__dirname, '../../icons')
      : path.join(process.resourcesPath, 'icons');
    
    // Use PNG for now since ICNS is causing loading issues
    return path.join(iconDir, 'icon.png');
  };

  const iconPath = getIconPath();
  console.log('Using icon path:', iconPath);
  console.log('Icon file exists:', fs.existsSync(iconPath));
    
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'AEM-Starter',
    icon: iconPath,
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
  // mainWindow.webContents.openDevTools();  // ← Comment this out for production
};

// Project management IPC handlers
ipcMain.handle('create-project', async (_, { name, folderPath, aemSdkPath, licensePath }) => {
  return ProjectManagerRegister.getManager().createProject(name, folderPath, aemSdkPath, licensePath);
});

ipcMain.handle('import-project', async (_, { name, folderPath }) => {
  return ProjectManagerRegister.getManager().importProject(name, folderPath);
});

ipcMain.handle('load-project', async (_, id) => {
  return ProjectManagerRegister.getManager().getProject(id);
});

ipcMain.handle('get-all-projects', async () => {
  return ProjectManagerRegister.getManager().getAllProjects();
});

ipcMain.handle('update-project', async (_, { id, updates }) => {
  return ProjectManagerRegister.getManager().updateProject(id, updates);
});

ipcMain.handle('delete-project', async (_, id) => {
  return ProjectManagerRegister.getManager().deleteProject(id);
});

ipcMain.handle('set-last-project-id', async (_, id) => {
  return ProjectManagerRegister.getManager().setLastProjectId(id);
});

ipcMain.handle('get-last-project-id', async () => {
  return ProjectManagerRegister.getManager().getLastProjectId();
});

ipcMain.handle('get-global-settings', async () => {
  return ProjectManagerRegister.getManager().getGlobalSettings();
});

ipcMain.handle('set-global-settings', async (_, settings) => {
  ProjectManagerRegister.getManager().setGlobalSettings(settings);
  return true;
});

// Refresh menu (useful when projects change)
ipcMain.handle('refresh-menu', async () => {
  createMenu();
  return true;
});

ipcMain.handle('show-open-dialog', async (_, options) => {
  return dialog.showOpenDialog(options);
});

ipcMain.handle('open-url', async (_, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Error opening URL:', error);
    throw error;
  }
});

ipcMain.handle('open-in-finder', async (_, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return true;
  } catch (error) {
    console.error('Error opening folder in finder:', error);
    throw error;
  }
});

ipcMain.handle('open-in-editor', async (_, folderPath: string, project?: Project) => {
  try {
    if (!project) {
      // Fallback: try to open with default editor
      await shell.openPath(folderPath);
      return true;
    }

    const settings = ProjectSettingsService.getSettings(project);
    const customEditorPath = settings.dev.customEditorPath;
    const editor = settings.dev.editor;
    
    const command = editor === 'custom' && customEditorPath ? customEditorPath : editor;
    
    // Parse command and arguments
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = [...parts.slice(1), folderPath];

    // Spawn detached process that runs independently of the app
    const child = spawn(cmd, args, {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    });

    // Unreference the child process so parent can exit independently
    child.unref();
    
    return true;
  } catch (error) {
    console.error('Error opening folder in editor:', error);
    throw error;
  }
});

// File system operations
ipcMain.handle('read-directory', async (_, dirPath, showHidden = false) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => showHidden || !entry.name.startsWith('.'))
      .map(entry => {
        const entryPath = path.join(dirPath, entry.name);
        let isDirectory = entry.isDirectory();
        let isFile = entry.isFile();
        const isSymlink = entry.isSymbolicLink();
        
        // For symlinks, check what they point to
        if (isSymlink) {
          try {
            const stats = fs.statSync(entryPath); // This follows the symlink
            isDirectory = stats.isDirectory();
            isFile = stats.isFile();
          } catch (error) {
            // If we can't stat the symlink target (broken symlink), 
            // keep the original values
            console.warn(`Could not stat symlink target for ${entryPath}:`, error);
          }
        }
        
        return {
          name: entry.name,
          path: entryPath,
          isDirectory,
          isFile,
          isSymlink
        };
      });
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
ipcMain.handle('start-aem-instance', async (_, project: Project, instanceType: 'author' | 'publisher', options?: { debug?: boolean }) => {
  try {
    const manager = AemInstanceManagerRegister.getInstanceManager(project);

    // Determine start type based on debug flag
    const startType = options?.debug ? 'debug' : 'start';
    await manager.startInstance(instanceType, startType);
    return true;
  } catch (error) {
    console.error('Error starting AEM instance:', error);
    throw error;
  }
});

ipcMain.handle('stop-aem-instance', async (_, project: Project, instanceType: 'author' | 'publisher') => {
  try {
    const manager = AemInstanceManagerRegister.getInstanceManager(project);
    await manager.stopInstance(instanceType);
    return true;
  } catch (error) {
    console.error('Error stopping AEM instance:', error);
    throw error;
  }
});

ipcMain.handle('is-aem-instance-running', (_, project: Project, instanceType: 'author' | 'publisher') => {
  const manager = AemInstanceManagerRegister.getInstanceManager(project);
  return manager.isInstanceRunning(instanceType);
});

ipcMain.handle('get-aem-instance-pid', (_, project: Project, instanceType: 'author' | 'publisher') => {
  const manager = AemInstanceManagerRegister.getInstanceManager(project);
  return manager.getInstancePid(instanceType);
});

ipcMain.handle('get-aem-instance-debug-status', (_, project: Project, instanceType: 'author' | 'publisher') => {
  const manager = AemInstanceManagerRegister.getInstanceManager(project);
  return manager.isInstanceInDebugMode(instanceType);
});

ipcMain.handle('get-available-log-files', (_, project: Project, instanceType: 'author' | 'publisher') => {
  const manager = AemInstanceManagerRegister.getInstanceManager(project);
  return manager.getAvailableLogFiles(instanceType);
});

ipcMain.handle('get-selected-log-files', (_, project: Project, instanceType: 'author' | 'publisher') => {
  const manager = AemInstanceManagerRegister.getInstanceManager(project);
  return manager.getSelectedLogFiles(instanceType);
});

ipcMain.handle('update-log-files', async (_, project: Project, instanceType: 'author' | 'publisher', logFiles: string[]) => {
  try {
    const manager = AemInstanceManagerRegister.getInstanceManager(project);
    await manager.updateLogFiles(instanceType, logFiles);
    return true;
  } catch (error) {
    console.error('Error updating log files:', error);
    throw error;
  }
});

ipcMain.handle('kill-all-aem-instances', async (_, project: Project) => {
  try {
    const manager = AemInstanceManagerRegister.getInstanceManager(project);
    await manager.killAllInstances();
    return true;
  } catch (error) {
    console.error('Error killing all AEM instances:', error);
    throw error;
  }
});

// Screenshot and Health Check functionality
ipcMain.handle('take-aem-screenshot', async (_, project: Project, instanceType: 'author' | 'publisher') => {
  try {
    const manager = AemInstanceManagerRegister.getInstanceManager(project);
    const screenshotPath = await manager.takeScreenshot(instanceType);
    return screenshotPath;
  } catch (error) {
    console.error('Error taking screenshot:', error);
    throw error;
  }
});

ipcMain.handle('get-latest-screenshot', async (_, project: Project, instanceType: 'author' | 'publisher' | 'dispatcher') => {
  try {
    console.log(`[main] Getting latest screenshot for ${project.name} ${instanceType}`);
    
    // First try to get from memory (health status)
    let screenshotPath: string | null = null;
    
    if (instanceType === 'author' || instanceType === 'publisher') {
      const manager = AemInstanceManagerRegister.getInstanceManager(project);
      screenshotPath = manager.getLatestScreenshot(instanceType);
      if (screenshotPath) {
        console.log(`[main] Found screenshot from health status: ${screenshotPath}`);
        return screenshotPath;
      }
    }
    
    // If not found in memory, look for files on disk
    const screenshotsDir = path.join(project.folderPath, 'screenshots');
    console.log(`[main] Looking for screenshot files in: ${screenshotsDir}`);
    
    if (!fs.existsSync(screenshotsDir)) {
      console.log(`[main] Screenshots directory does not exist: ${screenshotsDir}`);
      return null;
    }
    
    // Get all screenshot files for this instance type
    const files = fs.readdirSync(screenshotsDir)
      .filter(file => file.startsWith(`${instanceType}-`) && file.endsWith('.png'))
      .map(file => ({
        name: file,
        path: path.join(screenshotsDir, file),
        mtime: fs.statSync(path.join(screenshotsDir, file)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Sort by most recent first
    
    if (files.length > 0) {
      const latestScreenshot = files[0].path;
      console.log(`[main] Found latest screenshot file: ${latestScreenshot}`);
      return latestScreenshot;
    }
    
    console.log(`[main] No screenshot files found for ${instanceType}`);
    return null;
  } catch (error) {
    console.error('Error getting latest screenshot:', error);
    return null;
  }
});

ipcMain.handle('get-health-status', async (_, project: Project, instanceType: 'author' | 'publisher') => {
  try {
    const manager = AemInstanceManagerRegister.getInstanceManager(project);
    return manager.getHealthStatus(instanceType);
  } catch (error) {
    console.error('Error getting health status:', error);
    return null;
  }
});

// Read screenshot file as base64 data URL
ipcMain.handle('read-screenshot', async (_, screenshotPath: string) => {
  try {
    if (!screenshotPath || !fs.existsSync(screenshotPath)) {
      return null;
    }

    const imageBuffer = await fs.promises.readFile(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = screenshotPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error) {
    console.error('Error reading screenshot:', error);
    return null;
  }
});

// Register custom protocol for secure local file access
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
]);

// Project Settings
ipcMain.handle('get-project-settings', async (_, project: Project) => {
  try {
    return ProjectSettingsService.getSettings(project);
  } catch (error) {
    console.error('Error getting project settings:', error);
    throw error;
  }
});

// System Check - Editor Availability
ipcMain.handle('check-editor-availability', async () => {
  try {
    const systemCheck = new SystemCheck();
    return await systemCheck.checkEditorAvailability();
  } catch (error) {
    console.error('Error checking editor availability:', error);
    throw error;
  }
});

ipcMain.handle('save-project-settings', async (_, project: Project, settings: ProjectSettings) => {
  try {
    // Update the project settings in memory and save to file
    const updatedProject = ProjectManagerRegister.getManager().updateProjectSettings(project.id, settings);
    
    if (!updatedProject) {
      throw new Error('Project not found');
    }
    
    // Check if health checking was enabled for running instances and start it
    const manager = AemInstanceManagerRegister.getInstanceManager(updatedProject);
    // Check author instance
    if (settings.general?.healthCheck && manager.isInstanceRunning('author')) {
      console.log('[main] Starting health checking for author instance after settings change');
      manager.startHealthChecking('author');
    }
    
    // Check publisher instance  
    if (settings.general?.healthCheck && manager.isInstanceRunning('publisher')) {
      console.log('[main] Starting health checking for publisher instance after settings change');
      manager.startHealthChecking('publisher');
    }
    
    // Check dispatcher health checking
    const dispatcherManager = DispatcherManagerRegister.getManager(updatedProject);
    if (dispatcherManager.isDispatcherRunning()) {
      if (settings.general?.healthCheck) {
        console.log('[main] Starting health checking for dispatcher after settings change');
        dispatcherManager.startHealthChecking();
      } else if (!settings.general?.healthCheck) {
        console.log('[main] Stopping health checking for dispatcher after settings change');
        dispatcherManager.stopHealthChecking();
      }
    }
    
    // Refresh menu to update recent projects with new name if it changed
    createMenu();
    
    // Return the updated project so the frontend can update its state
    return updatedProject;
  } catch (error) {
    console.error('Error saving project settings:', error);
    throw error;
  }
});

// Package Installation
ipcMain.handle('install-package', async (_, project: Project, instance: 'author' | 'publisher', packageUrl: string) => {
  try {
    const packageInstaller = new PackageInstaller(project);
    await packageInstaller.installPackage(instance, packageUrl);
    return true;
  } catch (error) {
    console.error('Error installing package:', error);
    throw error;
  }
});

// Replication Settings
ipcMain.handle('setup-replication', async (_, project: Project, instance: 'author' | 'publisher' | 'dispatcher') => {
  try {
    const replicationSettings = ReplicationSettings.getInstance();
    const result = await replicationSettings.setReplication(project, instance);
    return result;
  } catch (error) {
    console.error('Error setting up replication:', error);
    throw error;
  }
});

// Oak-run.jar functionality
ipcMain.handle('is-oak-jar-available', (_, project: Project, instanceType: 'author' | 'publisher') => {
  try {
    const manager = AemInstanceManagerRegister.getInstanceManager(project);
    return manager.isOakJarAvailable(instanceType);
  } catch (error) {
    console.error('Error checking oak-run.jar availability:', error);
    return false;
  }
});

ipcMain.handle('load-oak-jar', async (_, project: Project) => {
  try {
    const manager = AemInstanceManagerRegister.getInstanceManager(project);
    await manager.loadOakJar();
    return true;
  } catch (error) {
    console.error('Error loading oak-run.jar:', error);
    throw error;
  }
});

ipcMain.handle('run-oak-compaction', async (_, project: Project, instanceType: 'author' | 'publisher') => {
  try {
    const backupManager = new BackupService(project);
    await backupManager.compact(instanceType);
    return true;
  } catch (error) {
    console.error('Error running oak compaction:', error);
    throw error;
  }
});

ipcMain.handle('run-backup-all', async (_, project: Project, tarName: string, compress = true) => {
  try {
    const backupManager = new BackupService(project);
    await backupManager.backup(tarName, compress);
    return true;
  } catch (error) {
    console.error('Error running backup all:', error);  
    throw error;
  }
});

ipcMain.handle('list-backups-all', async (_, project: Project) => {
  try {
    const backupManager = new BackupService(project);
    return await backupManager.listBackups()
  } catch (error) {
    console.error('Error listing backups:', error);
    throw error;
  }
});

ipcMain.handle('run-restore-all', async (_, project: Project, tarName: string) => {
  try {
    const backupManager = new BackupService(project);
    await backupManager.restore(tarName);
    return true;
  } catch (error) {
    console.error('Error running restore all:', error); 
    throw error;
  }
});

ipcMain.handle('delete-backup-all', async (_, project: Project, tarName: string) => {
  try {
    const backupManager = new BackupService(project);
    await backupManager.deleteBackup(tarName);
    return true;
  } catch (error) {
    console.error('Error deleting backup all:', error);
    throw error;
  }
});

// Automation Tasks
ipcMain.handle('run-automation-task', async (_, project: Project, task: string) => {
  try {
    await Automation.run(project, task, mainWindow || undefined);
    return true;
  } catch (error) {
    console.error('Error running automation task:', error);
    throw error;
  }
});

// Dispatcher Management
ipcMain.handle('start-dispatcher', async (_, project: Project) => {
  try {
    const manager = DispatcherManagerRegister.getManager(project);
    if (mainWindow) {
      manager.setMainWindow(mainWindow);
    }
    await manager.startDispatcher();
    return true;
  } catch (error) {
    console.error('Error starting dispatcher:', error);
    throw error;
  }
});

ipcMain.handle('stop-dispatcher', async (_, project: Project) => {
  try {
    const manager = DispatcherManagerRegister.getManager(project);
    await manager.stopDispatcher();
    return true;
  } catch (error) {
    console.error('Error stopping dispatcher:', error);
    throw error;
  }
});

ipcMain.handle('kill-dispatcher', async (_, project: Project) => {
  try {
    const manager = DispatcherManagerRegister.getManager(project);
    await manager.killDispatcher();
    return true;
  } catch (error) {
    console.error('Error killing dispatcher:', error);
    throw error;
  }
});

ipcMain.handle('get-dispatcher-status', async (_, project: Project) => {
  try {
    const manager = DispatcherManagerRegister.getManager(project);
    // Always update the main window reference for existing managers
    if (mainWindow) {
      manager.setMainWindow(mainWindow);
    }
    return manager.getDispatcherStatus();
  } catch (error) {
    console.error('Error getting dispatcher status:', error);
    return { isRunning: false, pid: null, port: 80, config: './dispatcher-sdk/src' };
  }
});

ipcMain.handle('flush-dispatcher', async (_, project: Project) => {
  try {
    const manager = DispatcherManagerRegister.getManager(project);
    // For now, clear cache as flush operation
    manager.clearCache();
    return true;
  } catch (error) {
    console.error('Error flushing dispatcher:', error);
    throw error;
  }
});

ipcMain.handle('clear-dispatcher-cache', async (_, project: Project) => {
  try {
    const manager = DispatcherManagerRegister.getManager(project);
    manager.clearCache();
    return true;
  } catch (error) {
    console.error('Error clearing dispatcher cache:', error);
    throw error;
  }
});

// Dispatcher Health Checking
ipcMain.handle('take-dispatcher-screenshot', async (_, project: Project) => {
  try {
    const manager = DispatcherManagerRegister.getManager(project);
    return await manager.takeScreenshot();
  } catch (error) {
    console.error('Error taking dispatcher screenshot:', error);
    throw error;
  }
});

ipcMain.handle('get-dispatcher-health-status', async (_, project: Project) => {
  try {
    const manager = DispatcherManagerRegister.getManager(project);
    return manager.getHealthStatus();
  } catch (error) {
    console.error('Error getting dispatcher health status:', error);
    return null;
  }
});

ipcMain.handle('check-dispatcher-health', async (_, project: Project) => {
  try {
    const manager = DispatcherManagerRegister.getManager(project);
    return await manager.checkHealth();
  } catch (error) {
    console.error('Error checking dispatcher health:', error);
    throw error;
  }
});

// System check IPC handler
ipcMain.handle('run-system-check', async (_, settings: ProjectSettings) => {
  try {
    const systemCheck = new SystemCheck();
    return await systemCheck.runAllChecks(settings);
  } catch (error) {
    console.error('Error running system check:', error);
    throw error;
  }
});

// Dev project utilities IPC handler
ipcMain.handle('open-dev-project', async (_, project: Project, type: 'files' | 'terminal' | 'editor') => {
  try {
    const devProjectUtils = new DevProjectUtils();
    await devProjectUtils.open(project, type);
    return true;
  } catch (error) {
    console.error('Error opening dev project:', error);
    throw error;
  }
});

// Terminal management
let terminalService: TerminalService;

function initializeTerminalService() {
  if (!terminalService) {
    terminalService = new TerminalService();
    if (mainWindow) {
      terminalService.setMainWindow(mainWindow);
    }
  }
}

// Terminal IPC handlers
ipcMain.handle('create-terminal', async (_, options: { cwd?: string; shell?: string }) => {
  initializeTerminalService();
  return terminalService.createTerminal(options);
});

ipcMain.handle('write-terminal', async (_, terminalId: string, data: string) => {
  initializeTerminalService();
  return terminalService.writeToTerminal(terminalId, data);
});

ipcMain.handle('resize-terminal', async (_, terminalId: string, cols: number, rows: number) => {
  initializeTerminalService();
  return terminalService.resizeTerminal(terminalId, cols, rows);
});

ipcMain.handle('kill-terminal', async (_, terminalId: string) => {
  initializeTerminalService();
  return terminalService.killTerminal(terminalId);
});

// Clear all terminals (used when switching projects)
ipcMain.handle('clear-all-terminals', async () => {
  initializeTerminalService();
  if (terminalService) {
    terminalService.clearAllTerminals();
    return true;
  }
  return false;
});

// Create application menu
const createMenu = () => {
  // Helper function to create recent projects submenu
  const createRecentProjectsSubmenu = (): Electron.MenuItemConstructorOptions[] => {
    const projects = ProjectManagerRegister.getManager().getAllProjects();
    
    if (projects.length === 0) {
      return [
        {
          label: 'No recent projects',
          enabled: false
        }
      ];
    }
    
    // Sort projects by lastModified date (most recent first)
    const sortedProjects = projects.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
    
    // Limit to 10 most recent projects
    const recentProjects = sortedProjects.slice(0, 10);
    
    return recentProjects.map(project => ({
      label: project.name,
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('open-recent-project', project.id);
        }
      }
    }));
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project...',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('open-new-project-dialog');
            }
          }
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!mainWindow) return;
            
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
              title: 'Open AEM-Starter Project',
              buttonLabel: 'Open Project',
              message: 'Select a folder containing an existing AEM-Starter project'
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('open-project-folder', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Recent Projects',
          submenu: createRecentProjectsSubmenu()
        },
        { type: 'separator' },
        {
          label: process.platform === 'darwin' ? 'Quit AEM-Starter' : 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    }
  ];

  // Add standard macOS menu items
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: 'About AEM-Starter',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('open-about-dialog');
            }
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // Add Edit menu for macOS
    template.push({
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    });

    // Add View menu for macOS
    template.push({
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    });

    // Add Window menu for macOS
    template.push({
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    });
  } else {
    // Add Help menu for non-macOS platforms
    template.push({
      label: 'Help',
      submenu: [
        {
          label: 'About AEM-Starter',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('open-about-dialog');
            }
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Set app name again when ready
  app.setName('AEM-Starter');
  
  // Register the custom protocol handler
  protocol.handle('local-file', async (request) => {
    try {
      const url = new URL(request.url);
      const filePath = decodeURIComponent(url.pathname);
      
      // Security check: ensure the file exists and is readable
      if (!fs.existsSync(filePath)) {
        return new Response('File not found', { status: 404 });
      }
      
      // Use net.fetch with file:// protocol for secure file access
      return net.fetch(`file://${filePath}`);
    } catch (error) {
      console.error('Error handling local-file protocol:', error);
      return new Response('Internal server error', { status: 500 });
    }
  });
  
  createWindow();
  createMenu();
  
  // Force set dock icon on macOS
  if (process.platform === 'darwin' && mainWindow && app.dock) {
    const iconPath = path.join(__dirname, '../../icons/icon.png');
    console.log('Setting dock icon:', iconPath);
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Clean up terminal sessions
  if (terminalService) {
    terminalService.cleanup();
  }
  
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
