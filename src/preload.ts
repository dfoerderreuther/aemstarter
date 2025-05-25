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
      options: {
        port: number;
        runmode: string;
        jvmOpts: string;
        debugPort?: number;
      }
    ) => ipcRenderer.invoke('start-aem-instance', project, instanceType, options),
    
    stopAemInstance: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('stop-aem-instance', project, instanceType),
    
    isAemInstanceRunning: (project: Project, instanceType: 'author' | 'publisher') =>
      ipcRenderer.invoke('is-aem-instance-running', project, instanceType),

    killAllAemInstances: (project: Project) =>
      ipcRenderer.invoke('kill-all-aem-instances', project),

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
