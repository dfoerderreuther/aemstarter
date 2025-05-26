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
  }
);
