// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

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
    checkFileExists: (filePath: string) =>
      ipcRenderer.invoke('check-file-exists', filePath),
    readFile: (filePath: string) =>
      ipcRenderer.invoke('read-file', filePath),
    createDirectory: (dirPath: string) =>
      ipcRenderer.invoke('create-directory', dirPath),
    copyFile: (sourcePath: string, targetPath: string) =>
      ipcRenderer.invoke('copy-file', sourcePath, targetPath),
    unzipFile: (zipPath: string, targetPath: string) =>
      ipcRenderer.invoke('unzip-file', zipPath, targetPath),
  }
);
