import { Project } from './Project';

declare global {
  interface Window {
    electronAPI: {
      getAllProjects: () => Promise<Project[]>;
      createProject: (name: string, folderPath: string, aemSdkPath: string, licensePath: string) => Promise<Project>;
      loadProject: (id: string) => Promise<Project | undefined>;
      deleteProject: (id: string) => Promise<boolean>;
      setLastProjectId: (id: string | null) => Promise<boolean>;
      getLastProjectId: () => Promise<string | undefined>;
      showOpenDialog: (options: any) => Promise<Electron.OpenDialogReturnValue>;
      
      // File system operations
      readDirectory: (dirPath: string, showHidden?: boolean) => Promise<Array<{
        name: string;
        path: string;
        isDirectory: boolean;
        isFile: boolean;
        isSymlink: boolean;
      }>>;
      checkFileExists: (filePath: string) => Promise<boolean>;
      readFile: (filePath: string) => Promise<{ content?: string; error?: string }>;
      createDirectory: (dirPath: string) => Promise<void>;
      copyFile: (sourcePath: string, targetPath: string) => Promise<void>;
      unzipFile: (zipPath: string, targetPath: string) => Promise<void>;
    };
  }
} 