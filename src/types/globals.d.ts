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
      openUrl: (url: string) => Promise<boolean>;
      
      // Global settings
      getGlobalSettings: () => Promise<{ aemSdkPath?: string; licensePath?: string }>;
      setGlobalSettings: (settings: { aemSdkPath?: string; licensePath?: string }) => Promise<boolean>;
      
      // Menu
      refreshMenu: () => Promise<boolean>;
      
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
        options?: {
          debug?: boolean;
        }
      ) => Promise<boolean>;
      
      stopAemInstance: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      
      isAemInstanceRunning: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      
      getAemInstancePid: (project: Project, instanceType: 'author' | 'publisher') => Promise<number | null>;
      
      getAvailableLogFiles: (project: Project, instanceType: 'author' | 'publisher') => Promise<string[]>;
      
      getSelectedLogFiles: (project: Project, instanceType: 'author' | 'publisher') => Promise<string[]>;
      
      updateLogFiles: (project: Project, instanceType: 'author' | 'publisher', logFiles: string[]) => Promise<boolean>;
      
      killAllAemInstances: (project: Project) => Promise<boolean>;
      
      // Package Installation
      installPackage: (project: Project, instance: 'author' | 'publisher', packageUrl: string) => Promise<boolean>;

      // Replication Settings
      setupReplication: (project: Project, instance: 'author' | 'publisher') => Promise<{ success: boolean; output?: string; error?: any }>;
      
      
      // Screenshot and Health Check functionality
      takeAemScreenshot: (project: Project, instanceType: 'author' | 'publisher') => Promise<string>;
      getLatestScreenshot: (project: Project, instanceType: 'author' | 'publisher') => Promise<string | null>;
      getHealthStatus: (project: Project, instanceType: 'author' | 'publisher') => Promise<any>;
      
      // Read screenshot as base64 data URL
      readScreenshot: (screenshotPath: string) => Promise<string | null>;


      
      // Oak-run.jar functionality
      isOakJarAvailable: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      loadOakJar: (project: Project) => Promise<boolean>;
      runOakCompaction: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;

      
      // Project Settings
      getProjectSettings: (project: Project) => Promise<any>;
      saveProjectSettings: (project: Project, settings: any) => Promise<boolean>;
      
      // Log streaming
      onAemLogData: (callback: (data: { projectId: string; instanceType: string; data: string }) => void) => () => void;
      
      // PID status streaming
      onAemPidStatus: (callback: (data: { projectId: string; instanceType: string; pid: number | null; isRunning: boolean }) => void) => () => void;
      
      // Health status streaming
      onAemHealthStatus: (callback: (data: { projectId: string; instanceType: string; status: any }) => void) => () => void;
      
      removeAemLogDataListener: (cleanup?: () => void) => void;

      // Menu event listeners
      onOpenNewProjectDialog: (callback: () => void) => () => void;
      onOpenProjectFolder: (callback: (folderPath: string) => void) => () => void;
      onOpenRecentProject: (callback: (projectId: string) => void) => () => void;

      // Dispatcher Management
      startDispatcher: (project: Project) => Promise<boolean>;
      stopDispatcher: (project: Project) => Promise<boolean>;
      getDispatcherStatus: (project: Project) => Promise<{ isRunning: boolean; pid: number | null; port: number; config: string }>;
      flushDispatcher: (project: Project) => Promise<boolean>;

      // Dispatcher Health Checking
      takeDispatcherScreenshot: (project: Project) => Promise<string>;
      getDispatcherHealthStatus: (project: Project) => Promise<any>;
      checkDispatcherHealth: (project: Project) => Promise<any>;

      // Dispatcher log streaming
      onDispatcherLogData: (callback: (data: { projectId: string; data: string }) => void) => () => void;

      // Dispatcher status streaming
      onDispatcherStatus: (callback: (data: { projectId: string; isRunning: boolean; pid: number | null; port: number }) => void) => () => void;
    };
  }
} 