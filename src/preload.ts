// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { Project, ProjectSettings } from './types/Project';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    // Project management
    checkRunningInstances: (project: Project) => 
      ipcRenderer.invoke('check-running-instances', project),
    createProject: (name: string, folderPath: string, aemSdkPath: string, licensePath: string, classic?: boolean, classicQuickstartPath?: string) => 
      ipcRenderer.invoke('create-project', { name, folderPath, aemSdkPath, licensePath, classic, classicQuickstartPath }),
    importProject: (name: string, folderPath: string) => 
      ipcRenderer.invoke('import-project', { name, folderPath }),
    loadProject: (id: string) => 
      ipcRenderer.invoke('load-project', id),
    getAllProjects: () => 
      ipcRenderer.invoke('get-all-projects'),
    updateProject: (id: string, updates: Partial<Project>) => 
      ipcRenderer.invoke('update-project', { id, updates }),
    deleteProject: (id: string) => 
      ipcRenderer.invoke('delete-project', id),
    setLastProjectId: (id: string | null) =>
      ipcRenderer.invoke('set-last-project-id', id),
    getLastProjectId: () =>
      ipcRenderer.invoke('get-last-project-id'),
    
    // Global settings
    getGlobalSettings: () =>
      ipcRenderer.invoke('get-global-settings'),
    setGlobalSettings: (settings: { aemSdkPath?: string; licensePath?: string }) =>
      ipcRenderer.invoke('set-global-settings', settings),
    
    // Menu
    refreshMenu: () =>
      ipcRenderer.invoke('refresh-menu'),
    cleanupOrphanedProjects: () =>
      ipcRenderer.invoke('cleanup-orphaned-projects'),
    
    // Dialog
    showOpenDialog: (options: Electron.OpenDialogOptions) => 
      ipcRenderer.invoke('show-open-dialog', options),
    
    // Browser
    openUrl: (url: string) =>
      ipcRenderer.invoke('open-url', url),
    openInFinder: (folderPath: string) =>
      ipcRenderer.invoke('open-in-finder', folderPath),
    openInEditor: (folderPath: string, project?: Project) =>
      ipcRenderer.invoke('open-in-editor', folderPath, project),
    
      
    // File system operations
    readDirectory: (dirPath: string, showHidden = false) =>
      ipcRenderer.invoke('read-directory', dirPath, showHidden),
    readFile: (filePath: string) =>
      ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('write-file', filePath, content),

    // AEM Installation
    installAEM: (project: Project) =>
      ipcRenderer.invoke('install-aem', project),
    deleteAEM: (project: Project) =>
      ipcRenderer.invoke('delete-aem', project),

    // AEM Instance Management
    startAemInstance: (
      project: Project,
      instanceType: 'author' | 'publisher',
      debug = false
    ) => ipcRenderer.invoke('start-aem-instance', project, instanceType, { debug }),
    
    stopAemInstance: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('stop-aem-instance', project, instanceType),
    
    isAemInstanceRunning: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('is-aem-instance-running', project, instanceType),

    getAemInstancePid: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('get-aem-instance-pid', project, instanceType),

    getAemInstanceDebugStatus: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('get-aem-instance-debug-status', project, instanceType),

    getAvailableLogFiles: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('get-available-log-files', project, instanceType),

    getSelectedLogFiles: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('get-selected-log-files', project, instanceType),

    updateLogFiles: (project: Project, instanceType: 'author' | 'publisher', logFiles: string[]) =>
      ipcRenderer.invoke('update-log-files', project, instanceType, logFiles),

    killAllAemInstances: (project: Project) =>
      ipcRenderer.invoke('kill-all-aem-instances', project),

    // Package Installation
    installPackage: (project: Project, instance: 'author' | 'publisher', packageUrl: string) =>
      ipcRenderer.invoke('install-package', project, instance, packageUrl),
    
    // Package Management
    listPackages: (project: Project) =>
      ipcRenderer.invoke('list-packages', project),
    createPackage: (project: Project, name: string, instances: string[], paths: string[]) =>
      ipcRenderer.invoke('create-package', project, name, instances, paths),
    deletePackage: (project: Project, packageName: string) =>
      ipcRenderer.invoke('delete-package', project, packageName),
    rebuildPackage: (project: Project, name: string, instances: string[]) =>
      ipcRenderer.invoke('rebuild-package', project, name, instances),

    // Replication Settings
    setupReplication: (project: Project, instance: 'author' | 'publisher' | 'dispatcher') =>
      ipcRenderer.invoke('setup-replication', project, instance),

    // Screenshot and Health Check functionality
    takeAemScreenshot: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('take-aem-screenshot', project, instanceType),
    
    getLatestScreenshot: (project: Project, instanceType: 'author' | 'publisher' | 'dispatcher') =>
      ipcRenderer.invoke('get-latest-screenshot', project, instanceType),
    
    getHealthStatus: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('get-health-status', project, instanceType),

    // Read screenshot as base64 data URL
    readScreenshot: (screenshotPath: string) =>
      ipcRenderer.invoke('read-screenshot', screenshotPath),

    // Terminal management
    createTerminal: (options: { cwd?: string; shell?: string }) =>
      ipcRenderer.invoke('create-terminal', options),
    writeTerminal: (terminalId: string, data: string) =>
      ipcRenderer.invoke('write-terminal', terminalId, data),
    resizeTerminal: (terminalId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('resize-terminal', terminalId, cols, rows),
    killTerminal: (terminalId: string) =>
      ipcRenderer.invoke('kill-terminal', terminalId),
    
    // AEM Process Manager
    startAemProcess: (project: Project, options: any) =>
      ipcRenderer.invoke('start-aem-process', project, options),
    stopAemProcess: (processId: string) =>
      ipcRenderer.invoke('stop-aem-process', processId),
    
    // Clear all terminals (used when switching projects)
    clearAllTerminals: () =>
      ipcRenderer.invoke('clear-all-terminals'),

    // Oak-run.jar functionality
    isOakJarAvailable: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('is-oak-jar-available', project, instanceType),
    
    loadOakJar: (project: Project) =>
      ipcRenderer.invoke('load-oak-jar', project),
    

    runOakCompaction: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('run-oak-compaction', project, instanceType),

    runBackupAll: (project: Project, tarName: string, compress?: boolean) =>
      ipcRenderer.invoke('run-backup-all', project, tarName, compress),

    runRestoreAll: (project: Project, tarName: string) =>
      ipcRenderer.invoke('run-restore-all', project, tarName),

    listBackupsAll: (project: Project) =>
      ipcRenderer.invoke('list-backups-all', project),
    
    deleteBackupAll: (project: Project, tarName: string) =>
      ipcRenderer.invoke('delete-backup-all', project, tarName),

    // Automation Tasks
    runAutomationTask: (project: Project, task: string, parameters?: { [key: string]: string }) =>
      ipcRenderer.invoke('run-automation-task', project, task, parameters),

    // Automation progress streaming
    onAutomationProgress: (callback: (data: { projectId: string; taskType: string; message: string; timestamp: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { projectId: string; taskType: string; message: string; timestamp: string }) => callback(data);
      ipcRenderer.on('automation-progress', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('automation-progress', handler);
      };
    },



    // Project Settings
    getProjectSettings: (project: Project) =>
      ipcRenderer.invoke('get-project-settings', project),
    saveProjectSettings: (project: Project, settings: ProjectSettings) =>
      ipcRenderer.invoke('save-project-settings', project, settings),
    
    // Editor Availability Check
    checkEditorAvailability: () =>
      ipcRenderer.invoke('check-editor-availability'),

    // Dev project utilities
    openDevProject: (project: Project, type: 'files' | 'terminal' | 'editor') =>
      ipcRenderer.invoke('open-dev-project', project, type),

    // Terminal event listeners
    onTerminalData: (callback: (terminalId: string, data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, terminalId: string, data: string) => callback(terminalId, data);
      ipcRenderer.on('terminal-data', handler);
      return () => ipcRenderer.removeListener('terminal-data', handler);
    },
    onTerminalExit: (callback: (terminalId: string, code: number | null, signal: string | null) => void) => {
      const handler = (_: Electron.IpcRendererEvent, terminalId: string, code: number | null, signal: string | null) => callback(terminalId, code, signal);
      ipcRenderer.on('terminal-exit', handler);
      return () => ipcRenderer.removeListener('terminal-exit', handler);
    },
    onTerminalError: (callback: (terminalId: string, error: string) => void) => {
      const listener = (_: any, terminalId: string, error: string) => callback(terminalId, error);
      ipcRenderer.on('terminal-error', listener);
      return () => ipcRenderer.removeListener('terminal-error', listener);
    },

    // Listen for terminals cleared event
    onTerminalsCleared: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('terminals-cleared', listener);
      return () => ipcRenderer.removeListener('terminals-cleared', listener);
    },

    // Log streaming
    onAemLogData: (callback: (data: { projectId: string; instanceType: string; data: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { projectId: string; instanceType: string; data: string }) => callback(data);
      ipcRenderer.on('aem-log-data', handler);
      
      // Also handle batched data
      const batchHandler = (_: Electron.IpcRendererEvent, batchData: { projectId: string; instanceType: string; lines: string[] }) => {
        batchData.lines.forEach(line => {
          callback({
            projectId: batchData.projectId,
            instanceType: batchData.instanceType,
            data: line
          });
        });
      };
      ipcRenderer.on('aem-log-data-batch', batchHandler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('aem-log-data', handler);
        ipcRenderer.removeListener('aem-log-data-batch', batchHandler);
      };
    },

    // PID status streaming
    onAemPidStatus: (callback: (data: { projectId: string; instanceType: string; pid: number | null; isRunning: boolean }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { projectId: string; instanceType: string; pid: number | null; isRunning: boolean }) => callback(data);
      ipcRenderer.on('aem-pid-status', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('aem-pid-status', handler);
      };
    },

    // Health status streaming
    onAemHealthStatus: (callback: (data: { projectId: string; instanceType: string; status: unknown }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { projectId: string; instanceType: string; status: unknown }) => callback(data);
      ipcRenderer.on('aem-health-status', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('aem-health-status', handler);
      };
    },
    
    removeAemLogDataListener: (cleanup?: () => void) => {
      if (cleanup) {
        cleanup();
      } else {
        // Fallback: remove all listeners (not recommended for multiple components)
        ipcRenderer.removeAllListeners('aem-log-data');
        ipcRenderer.removeAllListeners('aem-log-data-batch');
      }
    },

    // Menu event listeners
    onOpenNewProjectDialog: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('open-new-project-dialog', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('open-new-project-dialog', handler);
      };
    },

    onOpenProjectFolder: (callback: (folderPath: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, folderPath: string) => callback(folderPath);
      ipcRenderer.on('open-project-folder', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('open-project-folder', handler);
      };
    },

    onOpenRecentProject: (callback: (projectId: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, projectId: string) => callback(projectId);
      ipcRenderer.on('open-recent-project', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('open-recent-project', handler);
      };
    },

    onOpenAboutDialog: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('open-about-dialog', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('open-about-dialog', handler);
      };
    },

    // System Check
    runSystemCheck: (settings: ProjectSettings) =>
      ipcRenderer.invoke('run-system-check', settings),

    // Dispatcher Management
    startDispatcher: (project: Project) =>
      ipcRenderer.invoke('start-dispatcher', project),
    
    stopDispatcher: (project: Project) =>
      ipcRenderer.invoke('stop-dispatcher', project),
    
    killDispatcher: (project: Project) =>
      ipcRenderer.invoke('kill-dispatcher', project),
    
    getDispatcherStatus: (project: Project) =>
      ipcRenderer.invoke('get-dispatcher-status', project),
    
    flushDispatcher: (project: Project) =>
      ipcRenderer.invoke('flush-dispatcher', project),

    clearDispatcherCache: (project: Project) =>
      ipcRenderer.invoke('clear-dispatcher-cache', project),

    // Dispatcher Health Checking
    takeDispatcherScreenshot: (project: Project) =>
      ipcRenderer.invoke('take-dispatcher-screenshot', project),
    
    getDispatcherHealthStatus: (project: Project) =>
      ipcRenderer.invoke('get-dispatcher-health-status', project),
    
    checkDispatcherHealth: (project: Project) =>
      ipcRenderer.invoke('check-dispatcher-health', project),
    
    getDispatcherContainerId: (project: Project) =>
      ipcRenderer.invoke('get-dispatcher-container-id', project),

    // Dispatcher log streaming
    onDispatcherLogData: (callback: (data: { projectId: string; data: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { projectId: string; data: string }) => callback(data);
      ipcRenderer.on('dispatcher-log-data', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('dispatcher-log-data', handler);
      };
    },

    // Dispatcher status streaming
    onDispatcherStatus: (callback: (data: { projectId: string; isRunning: boolean; pid: number | null; port: number }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { projectId: string; isRunning: boolean; pid: number | null; port: number }) => callback(data);
      ipcRenderer.on('dispatcher-status', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('dispatcher-status', handler);
      };
    },

    // HTTPS Service
    startSslProxy: (project: Project) =>
      ipcRenderer.invoke('start-ssl-proxy', project),
    
    stopSslProxy: (project: Project) =>
      ipcRenderer.invoke('stop-ssl-proxy', project),
    
    isSslProxyRunning: (project: Project) =>
      ipcRenderer.invoke('is-ssl-proxy-running', project),

    // SSL Proxy status streaming
    onSslProxyStatus: (callback: (data: { projectId: string; isRunning: boolean; port: number }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { projectId: string; isRunning: boolean; port: number }) => callback(data);
      ipcRenderer.on('ssl-proxy-status', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('ssl-proxy-status', handler);
      };
    },
  }
);
