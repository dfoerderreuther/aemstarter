import { Project, ProjectSettings } from './Project';
import { BackupInfo } from './BackupInfo';
import { SystemCheckResults } from './SystemCheckResults';
import { EditorAvailableResults } from './EditorAvailableResults';
import { InstanceStartData } from './InstanceStartData';

declare global {
  // App version injected by Vite
  const __APP_VERSION__: string;
  
  interface Window {
    electronAPI: {
      checkRunningInstances: (project: Project) => Promise<{
        hasRunning: boolean;
        runningInstances: Array<{
          instanceType: 'author' | 'publisher' | 'dispatcher';
          port: number;
        }>;
      }>;
      getAllProjects: () => Promise<Project[]>;
      createProject: (name: string, folderPath: string, aemSdkPath: string, licensePath: string, classic?: boolean, classicQuickstartPath?: string) => Promise<Project>;
      importProject: (name: string, folderPath: string) => Promise<Project>;
      loadProject: (id: string) => Promise<Project | undefined>;
      deleteProject: (id: string) => Promise<boolean>;
      setLastProjectId: (id: string | null) => Promise<boolean>;
      getLastProjectId: () => Promise<string | undefined>;
      showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
      openUrl: (url: string) => Promise<boolean>;
      openInFinder: (folderPath: string) => Promise<boolean>;
      openInEditor: (folderPath: string, project?: Project) => Promise<boolean>;
      
      
      // Global settings
      getGlobalSettings: () => Promise<{ aemSdkPath?: string; licensePath?: string }>;
      setGlobalSettings: (settings: { aemSdkPath?: string; licensePath?: string }) => Promise<boolean>;
      
      // Menu
      refreshMenu: () => Promise<boolean>;

      // System Check
      runSystemCheck: (settings: ProjectSettings) => Promise<SystemCheckResults>;
      
      // Platform detection
      getPlatform: () => Promise<string>;
      
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

      // File Tree operations
      fileTreeRead: (project: Project, dirPath: string, showHidden?: boolean) => Promise<{
        [key: string]: {
          index: string;
          isFolder: boolean;
          children?: string[];
          data: {
            name: string;
            path: string;
            isDirectory: boolean;
            isFile: boolean;
            size?: number;
            updatedAt?: string;
          };
        };
      } | { error: string }>;
      fileTreeCreateFile: (project: Project, filePath: string, content?: string) => Promise<{ success: boolean } | { error: string }>;
      fileTreeCreateDirectory: (project: Project, dirPath: string) => Promise<{ success: boolean } | { error: string }>;
      fileTreeRename: (project: Project, oldPath: string, newPath: string) => Promise<{ success: boolean } | { error: string }>;
      fileTreeMove: (project: Project, sourcePath: string, destinationPath: string) => Promise<{ success: boolean } | { error: string }>;
      fileTreeDelete: (project: Project, targetPath: string) => Promise<{ success: boolean } | { error: string }>;
      fileTreeGetInfo: (project: Project, targetPath: string) => Promise<{
        info: {
          name: string;
          path: string;
          isDirectory: boolean;
          isFile: boolean;
          size?: number;
          updatedAt?: string;
        };
      } | { error: string }>;

      // AEM Installation
      installAEM: (project: Project) => Promise<boolean>;

      // AEM Instance Management
      startAemInstance: (
        project: Project,
        instanceType: 'author' | 'publisher',
        debug?: boolean
      ) => Promise<boolean>;
      
      stopAemInstance: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      
      isAemInstanceRunning: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      
      getAemInstancePid: (project: Project, instanceType: 'author' | 'publisher') => Promise<number | null>;
      getAemInstanceDebugStatus: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      getAemInstanceStartData: (project: Project, instanceType: 'author' | 'publisher') => Promise<InstanceStartData | null>;
      
      getAvailableLogFiles: (project: Project, instanceType: 'author' | 'publisher') => Promise<string[]>;
      
      getSelectedLogFiles: (project: Project, instanceType: 'author' | 'publisher') => Promise<string[]>;
      
      updateLogFiles: (project: Project, instanceType: 'author' | 'publisher', logFiles: string[]) => Promise<boolean>;
      
      killAllAemInstances: (project: Project) => Promise<boolean>;
      
      // Package Installation
      installPackage: (project: Project, instance: 'author' | 'publisher', packageUrl: string) => Promise<boolean>;
      
      // Package Management
      listPackages: (project: Project) => Promise<Array<{
        name: string;
        createdDate: Date;
        paths: string[];
        hasAuthor: boolean;
        hasPublisher: boolean;
        authorSize?: number;
        publisherSize?: number;
        authorAemPath?: string;
        publisherAemPath?: string;
      }>>;
      createPackage: (project: Project, name: string, instance: string, paths: string[]) => Promise<boolean>;
      deletePackage: (project: Project, packageName: string) => Promise<boolean>;
      downloadWebPackage: (project: Project, packageUrl: string) => Promise<string>;
      importPackage: (project: Project, sourceFilePath: string) => Promise<string>;

      // Replication Settings
      setupReplication: (project: Project, instance: 'author' | 'publisher' | 'dispatcher') => Promise<{ success: boolean; output?: string; error?: unknown }>;
      
      
      // Screenshot and Health Check functionality
      takeAemScreenshot: (project: Project, instanceType: 'author' | 'publisher' | 'dispatcher') => Promise<string>;
      getLatestScreenshot: (project: Project, instanceType: 'author' | 'publisher' | 'dispatcher') => Promise<string | null>;
      getHealthStatus: (project: Project, instanceType: 'author' | 'publisher' | 'dispatcher') => Promise<unknown>;
      
      // Read screenshot as base64 data URL
      readScreenshot: (screenshotPath: string) => Promise<string | null>;
      
      // Terminal functionality
      createTerminal: (options?: { cwd?: string; shell?: string }) => Promise<{ terminalId: string; success: boolean }>;
      writeTerminal: (terminalId: string, data: string) => Promise<boolean>;
      resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<boolean>;
      killTerminal: (terminalId: string) => Promise<boolean>;
      
      // Clear all terminals (used when switching projects)
      clearAllTerminals: () => Promise<boolean>;
      
      // Terminal event listeners
      onTerminalData: (callback: (terminalId: string, data: string) => void) => () => void;
      onTerminalExit: (callback: (terminalId: string, exitCode: number | null, signal: string | null) => void) => () => void;
      onTerminalError: (callback: (terminalId: string, error: string) => void) => () => void;
      
      // Listen for terminals cleared event
      onTerminalsCleared: (callback: () => void) => () => void;
      
      // Log streaming
      onAemLogData: (callback: (data: { projectId: string; instanceType: string; data: string }) => void) => () => void;
      
      // PID status streaming
      onAemPidStatus: (callback: (data: { projectId: string; instanceType: string; pid: number | null; isRunning: boolean }) => void) => () => void;
      
      // Health status streaming
      onAemHealthStatus: (callback: (data: { projectId: string; instanceType: string; status: unknown }) => void) => () => void;
      
      removeAemLogDataListener: (cleanup?: () => void) => void;

            // Menu event listeners
      onOpenNewProjectDialog: (callback: () => void) => () => void;
      onOpenProjectFolder: (callback: (folderPath: string) => void) => () => void;
      onOpenRecentProject: (callback: (projectId: string) => void) => () => void;
      onOpenAboutDialog: (callback: () => void) => () => void;
      onShowShutdownModal: (callback: () => void) => () => void;
      
      // App control
      forceQuit: () => Promise<void>;

      // Dispatcher Management
      startDispatcher: (project: Project) => Promise<boolean>;
      stopDispatcher: (project: Project) => Promise<boolean>;
      killDispatcher: (project: Project) => Promise<boolean>;
      getDispatcherStatus: (project: Project) => Promise<{ isRunning: boolean; pid: number | null; port: number; config: string }>;
      flushDispatcher: (project: Project) => Promise<boolean>;
      clearDispatcherCache: (project: Project) => Promise<boolean>;

      // Dispatcher Health Checking
      takeDispatcherScreenshot: (project: Project) => Promise<string>;
      getDispatcherHealthStatus: (project: Project) => Promise<unknown>;
      checkDispatcherHealth: (project: Project) => Promise<unknown>;
      
      // Dispatcher Container ID
      getDispatcherContainerId: (project: Project) => Promise<string | null>;

      // Dispatcher log streaming
      onDispatcherLogData: (callback: (data: { projectId: string; data: string }) => void) => () => void;

      // Dispatcher status streaming
      onDispatcherStatus: (callback: (data: { projectId: string; isRunning: boolean; pid: number | null; port: number }) => void) => () => void;

      // HTTPS Service
      startSslProxy: (project: Project) => Promise<boolean>;
      stopSslProxy: (project: Project) => Promise<boolean>;
      isSslProxyRunning: (project: Project) => Promise<boolean>;

      // SSL Proxy status streaming
      onSslProxyStatus: (callback: (data: { 
        projectId: string; 
        isRunning: boolean; 
        port: number;
        runningProxies?: { type: 'author' | 'publisher' | 'dispatcher'; port: number; targetPort: number }[];
      }) => void) => () => void;

      // Oak-run.jar functionality
      isOakJarAvailable: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      loadOakJar: (project: Project) => Promise<boolean>;
      runOakCompaction: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;

      // Backup Management
      listBackupsAll: (project: Project) => Promise<BackupInfo[]>;
      restoreBackupAll: (project: Project, name: string) => Promise<boolean>;
      createBackupAll: (project: Project, name: string) => Promise<boolean>;
      runBackupAll: (project: Project, tarName: string, compress?: boolean, description?: string, selectedInstances?: { author: boolean; publisher: boolean; dispatcher: boolean }) => Promise<boolean>;
      runRestoreAll: (project: Project, tarName: string) => Promise<boolean>;
      deleteBackupAll: (project: Project, tarName: string) => Promise<boolean>;
      
      // Project Settings
      getProjectSettings: (project: Project) => Promise<ProjectSettings>;
      saveProjectSettings: (project: Project, settings: ProjectSettings) => Promise<Project>;
      
      // Editor Availability Check
      checkEditorAvailability: () => Promise<EditorAvailableResults>;

      // Java Home Paths
      getJavaHomePaths: () => Promise<string[]>;
      
      // Java Home Validation
      validateJavaHome: (javaHomePath: string) => Promise<{
        isValid: boolean;
        version?: string;
        error?: string;
      }>;

      // Dev project utilities
      openDevProject: (project: Project, type: 'files' | 'terminal' | 'editor') => Promise<boolean>;
      
      // Automation Tasks
      runAutomationTask: (project: Project, task: string, parameters?: { [key: string]: string | boolean | number | string[] }) => Promise<boolean>;
      
      // Automation progress streaming
      onAutomationProgress: (callback: (data: { projectId: string; taskType: string; message: string; timestamp: string }) => void) => () => void;
    };
  }
} 