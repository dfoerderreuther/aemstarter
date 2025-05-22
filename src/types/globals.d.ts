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

      installAEM: (project: Project) => Promise<boolean>;
      deleteAEM: (project: Project) => Promise<boolean>;
    };
  }
} 