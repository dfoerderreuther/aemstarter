import { Project, ProjectSettings } from './Project';
import { BackupInfo } from './BackupInfo';
import { SystemCheckResults } from './SystemCheckResults';
import { EditorAvailableResults } from './EditorAvailableResults';

declare global {
  interface Window {
    electronAPI: {
      getAllProjects: () => Promise<Project[]>;
      createProject: (name: string, folderPath: string, aemSdkPath: string, licensePath: string) => Promise<Project>;
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
        debug?: boolean
      ) => Promise<boolean>;
      
      stopAemInstance: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      
      isAemInstanceRunning: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      
      getAemInstancePid: (project: Project, instanceType: 'author' | 'publisher') => Promise<number | null>;
      getAemInstanceDebugStatus: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      
      getAvailableLogFiles: (project: Project, instanceType: 'author' | 'publisher') => Promise<string[]>;
      
      getSelectedLogFiles: (project: Project, instanceType: 'author' | 'publisher') => Promise<string[]>;
      
      updateLogFiles: (project: Project, instanceType: 'author' | 'publisher', logFiles: string[]) => Promise<boolean>;
      
      killAllAemInstances: (project: Project) => Promise<boolean>;
      
      // Package Installation
      installPackage: (project: Project, instance: 'author' | 'publisher', packageUrl: string) => Promise<boolean>;

      // Replication Settings
      setupReplication: (project: Project, instance: 'author' | 'publisher' | 'dispatcher') => Promise<{ success: boolean; output?: string; error?: unknown }>;
      
      
      // Screenshot and Health Check functionality
      takeAemScreenshot: (project: Project, instanceType: 'author' | 'publisher' | 'dispatcher') => Promise<string>;
      getLatestScreenshot: (project: Project, instanceType: 'author' | 'publisher' | 'dispatcher') => Promise<string | null>;
      getHealthStatus: (project: Project, instanceType: 'author' | 'publisher' | 'dispatcher') => Promise<unknown>;
      
      // Read screenshot as base64 data URL
      readScreenshot: (screenshotPath: string) => Promise<string | null>;


      
      // Oak-run.jar functionality
      isOakJarAvailable: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;
      loadOakJar: (project: Project) => Promise<boolean>;
      runOakCompaction: (project: Project, instanceType: 'author' | 'publisher') => Promise<boolean>;

      
      // Project Settings
      getProjectSettings: (project: Project) => Promise<ProjectSettings>;
      saveProjectSettings: (project: Project, settings: ProjectSettings) => Promise<Project>;
      
      // Editor Availability Check
      checkEditorAvailability: () => Promise<EditorAvailableResults>;
      
      // Dev project utilities
      openDevProject: (project: Project, type: 'files' | 'terminal' | 'editor') => Promise<boolean>;
      
      // Terminal functionality
      createTerminal: (options?: { cwd?: string; shell?: string }) => Promise<{ terminalId: string; success: boolean }>;
      writeTerminal: (terminalId: string, data: string) => Promise<boolean>;
      resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<boolean>;
      killTerminal: (terminalId: string) => Promise<boolean>;
      
      // Terminal event listeners
      onTerminalData: (callback: (terminalId: string, data: string) => void) => () => void;
      onTerminalExit: (callback: (terminalId: string, code: number | null, signal: string | null) => void) => () => void;
      onTerminalError: (callback: (terminalId: string, error: string) => void) => () => void;
      
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

      // Dispatcher log streaming
      onDispatcherLogData: (callback: (data: { projectId: string; data: string }) => void) => () => void;

      // Dispatcher status streaming
      onDispatcherStatus: (callback: (data: { projectId: string; isRunning: boolean; pid: number | null; port: number }) => void) => () => void;

      // Backup Management
      listBackupsAll: (project: Project) => Promise<BackupInfo[]>;
      restoreBackupAll: (project: Project, name: string) => Promise<boolean>;
      createBackupAll: (project: Project, name: string) => Promise<boolean>;
      runBackupAll: (project: Project, tarName: string, compress?: boolean) => Promise<boolean>;
      runRestoreAll: (project: Project, tarName: string) => Promise<boolean>;
      deleteBackupAll: (project: Project, tarName: string) => Promise<boolean>;
      
      // Automation Tasks
      runAutomationTask: (project: Project, task: string) => Promise<boolean>;
      
      // Automation progress streaming
      onAutomationProgress: (callback: (data: { projectId: string; taskType: string; message: string; timestamp: string }) => void) => () => void;
    };
  }
} 