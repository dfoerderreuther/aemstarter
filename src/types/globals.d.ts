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
    };
  }
} 