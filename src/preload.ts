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
    
    // Dialog
    showOpenDialog: (options: any) => 
      ipcRenderer.invoke('show-open-dialog', options),
      
    // File system operations
    readDirectory: (dirPath: string, showHidden: boolean = false) =>
      ipcRenderer.invoke('read-directory', dirPath, showHidden),
    readFile: (filePath: string) =>
      ipcRenderer.invoke('read-file', filePath),

    installAEM: (project: Project) =>
      ipcRenderer.invoke('install-aem', project),
    deleteAEM: (project: Project) =>
      ipcRenderer.invoke('delete-aem', project),
  }
);
