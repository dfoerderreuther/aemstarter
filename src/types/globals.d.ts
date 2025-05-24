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
      
      // Global settings
      getGlobalSettings: () => Promise<{ aemSdkPath?: string; licensePath?: string }>;
      setGlobalSettings: (settings: { aemSdkPath?: string; licensePath?: string }) => Promise<boolean>;
      
      // File system operations
      readFile: (filePath: string) => Promise<{ content?: string; error?: string }>;
      writeFile: (filePath: string, content: string) => Promise<{ error?: string }>;
      readDirectory: (dirPath: string, showHidden?: boolean) => Promise<Array<{
        name: string;
        path: string;
        isDirectory: boolean;
        isFile: boolean;
        isSymlink: boolean;
      }>>;

      // AEM Installation
      installAEM: (project: Project) => Promise<boolean>;
      deleteAEM: (project: Project) => Promise<boolean>;

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
      ) => Promise<boolean>;
      
      stopAemInstance: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      
      isAemInstanceRunning: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      
      killAllAemInstances: (project: Project) => Promise<boolean>;
      
      // Log streaming
      onAemLogData: (callback: (data: { projectId: string; instanceType: string; data: string }) => void) => void;
      removeAemLogDataListener: () => void;
    };
  }
} 