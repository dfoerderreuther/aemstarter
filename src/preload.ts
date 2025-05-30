// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { Project } from './types/Project';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    // Project management
    createProject: (name: string, folderPath: string, aemSdkPath: string, licensePath: string) => 
      ipcRenderer.invoke('create-project', { name, folderPath, aemSdkPath, licensePath }),
    importProject: (name: string, folderPath: string) => 
      ipcRenderer.invoke('import-project', { name, folderPath }),
    loadProject: (id: string) => 
      ipcRenderer.invoke('load-project', id),
    getAllProjects: () => 
      ipcRenderer.invoke('get-all-projects'),
    updateProject: (id: string, updates: any) => 
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
    
    // Dialog
    showOpenDialog: (options: any) => 
      ipcRenderer.invoke('show-open-dialog', options),
    
    // Browser
    openUrl: (url: string) =>
      ipcRenderer.invoke('open-url', url),
      
    // File system operations
    readDirectory: (dirPath: string, showHidden: boolean = false) =>
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
      options?: {
        debug?: boolean;
      }
    ) => ipcRenderer.invoke('start-aem-instance', project, instanceType, options),
    
    stopAemInstance: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('stop-aem-instance', project, instanceType),
    
    isAemInstanceRunning: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('is-aem-instance-running', project, instanceType),

    getAemInstancePid: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('get-aem-instance-pid', project, instanceType),

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

    // Replication Settings
    setupReplication: (project: Project, instance: 'author' | 'publisher') =>
      ipcRenderer.invoke('setup-replication', project, instance),

    // Screenshot and Health Check functionality
    takeAemScreenshot: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('take-aem-screenshot', project, instanceType),
    
    getLatestScreenshot: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('get-latest-screenshot', project, instanceType),
    
    getHealthStatus: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('get-health-status', project, instanceType),

    // Read screenshot as base64 data URL
    readScreenshot: (screenshotPath: string) =>
      ipcRenderer.invoke('read-screenshot', screenshotPath),



    // Oak-run.jar functionality
    isOakJarAvailable: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('is-oak-jar-available', project, instanceType),
    
    loadOakJar: (project: Project) =>
      ipcRenderer.invoke('load-oak-jar', project),
    
    runOakCompaction: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('run-oak-compaction', project, instanceType),
    


    // Project Settings
    getProjectSettings: (project: Project) =>
      ipcRenderer.invoke('get-project-settings', project),
    saveProjectSettings: (project: Project, settings: any) =>
      ipcRenderer.invoke('save-project-settings', project, settings),

    // Log streaming
    onAemLogData: (callback: (data: { projectId: string; instanceType: string; data: string }) => void) => {
      const handler = (_: any, data: { projectId: string; instanceType: string; data: string }) => callback(data);
      ipcRenderer.on('aem-log-data', handler);
      
      // Also handle batched data
      const batchHandler = (_: any, batchData: { projectId: string; instanceType: string; lines: string[] }) => {
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
      const handler = (_: any, data: { projectId: string; instanceType: string; pid: number | null; isRunning: boolean }) => callback(data);
      ipcRenderer.on('aem-pid-status', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('aem-pid-status', handler);
      };
    },

    // Health status streaming
    onAemHealthStatus: (callback: (data: { projectId: string; instanceType: string; status: any }) => void) => {
      const handler = (_: any, data: { projectId: string; instanceType: string; status: any }) => callback(data);
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
      const handler = (_: any, folderPath: string) => callback(folderPath);
      ipcRenderer.on('open-project-folder', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('open-project-folder', handler);
      };
    },

    onOpenRecentProject: (callback: (projectId: string) => void) => {
      const handler = (_: any, projectId: string) => callback(projectId);
      ipcRenderer.on('open-recent-project', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('open-recent-project', handler);
      };
    },

    // Dispatcher Management
    startDispatcher: (project: Project) =>
      ipcRenderer.invoke('start-dispatcher', project),
    
    stopDispatcher: (project: Project) =>
      ipcRenderer.invoke('stop-dispatcher', project),
    
    getDispatcherStatus: (project: Project) =>
      ipcRenderer.invoke('get-dispatcher-status', project),
    
    flushDispatcher: (project: Project) =>
      ipcRenderer.invoke('flush-dispatcher', project),

    // Dispatcher Health Checking
    takeDispatcherScreenshot: (project: Project) =>
      ipcRenderer.invoke('take-dispatcher-screenshot', project),
    
    getDispatcherHealthStatus: (project: Project) =>
      ipcRenderer.invoke('get-dispatcher-health-status', project),
    
    checkDispatcherHealth: (project: Project) =>
      ipcRenderer.invoke('check-dispatcher-health', project),

    // Dispatcher log streaming
    onDispatcherLogData: (callback: (data: { projectId: string; data: string }) => void) => {
      const handler = (_: any, data: { projectId: string; data: string }) => callback(data);
      ipcRenderer.on('dispatcher-log-data', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('dispatcher-log-data', handler);
      };
    },

    // Dispatcher status streaming
    onDispatcherStatus: (callback: (data: { projectId: string; isRunning: boolean; pid: number | null; port: number }) => void) => {
      const handler = (_: any, data: { projectId: string; isRunning: boolean; pid: number | null; port: number }) => callback(data);
      ipcRenderer.on('dispatcher-status', handler);
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('dispatcher-status', handler);
      };
    },
  }
);
