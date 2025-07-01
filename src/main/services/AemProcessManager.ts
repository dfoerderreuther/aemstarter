import * as pty from 'node-pty';
import { ChildProcess, spawn } from 'child_process';
import { Project } from '../../types/Project';
import path from 'path';
import fs from 'fs';
import { BrowserWindow } from 'electron';

export interface AemProcessOptions {
  port: number;
  runmode: string;
  jvmOpts: string;
  isDebugMode: boolean;
  instanceType: 'author' | 'publisher';
}

export interface AemProcessSession {
  id: string;
  ptyProcess: pty.IPty | null;
  spawnProcess: ChildProcess | null;
  pid: number | null;
  port: number;
  runmode: string;
  jvmOpts: string;
  isDebugMode: boolean;
  instanceType: 'author' | 'publisher';
  cwd: string;
  isRunning: boolean;
}

export class AemProcessManager {
  private processes = new Map<string, AemProcessSession>();
  private mainWindow: BrowserWindow | null = null;

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow || null;
  }

  setMainWindow(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  async startAemProcess(project: Project, options: AemProcessOptions): Promise<{ processId: string; success: boolean }> {
    const processId = this.generateProcessId(options.instanceType);
    
    try {
      const instanceDir = path.join(project.folderPath, options.instanceType);
      const crxQuickstartDir = path.join(instanceDir, 'crx-quickstart');
      const hasCrxQuickstart = fs.existsSync(crxQuickstartDir);

      if (!hasCrxQuickstart) {
        throw new Error(`AEM instance not found at ${instanceDir}`);
      }

      const session: AemProcessSession = {
        id: processId,
        ptyProcess: null,
        spawnProcess: null,
        pid: null,
        port: options.port,
        runmode: options.runmode,
        jvmOpts: options.jvmOpts,
        isDebugMode: options.isDebugMode,
        instanceType: options.instanceType,
        cwd: instanceDir,
        isRunning: false
      };

      this.processes.set(processId, session);

      if (process.platform === 'win32') {
        // Use node-pty for Windows to ensure proper terminal environment
        await this.startAemWithPty(session, project);
      } else {
        // Use traditional spawn for Unix-like systems (maintains existing behavior)
        await this.startAemWithSpawn(session, project);
      }

      return { processId, success: true };
    } catch (error) {
      console.error('Error starting AEM process:', error);
      throw error;
    }
  }

  private async startAemWithPty(session: AemProcessSession, project: Project): Promise<void> {
    const startScript = 'start.bat';
    const startScriptPath = path.join(session.cwd, 'crx-quickstart', 'bin', startScript);

    if (!fs.existsSync(startScriptPath)) {
      throw new Error(`Start script not found at ${startScriptPath}`);
    }

    const env = this.getAemEnvironment(session);

    console.log('[AemProcessManager] Starting AEM with PTY on Windows:', startScriptPath);
    console.log('[AemProcessManager] Environment variables:', env);

    // Create PTY process for AEM
    const ptyProcess = pty.spawn(startScript, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: session.cwd,
      env: env,
      handleFlowControl: true,
      flowControlPause: '\x13',
      flowControlResume: '\x11',
    });

    session.ptyProcess = ptyProcess;

    // Handle PTY data for logging
    ptyProcess.onData((data) => {
      this.sendAemLogData(session.instanceType, data);
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[AemProcessManager] AEM ${session.instanceType} PTY process exited with code ${exitCode}, signal ${signal}`);
      session.isRunning = false;
      this.sendPidStatusUpdate(session.instanceType, null, false);
    });

    session.isRunning = true;
    this.sendPidStatusUpdate(session.instanceType, ptyProcess.pid || null, true);
  }

  private async startAemWithSpawn(session: AemProcessSession, project: Project): Promise<void> {
    const startScript = 'start';
    const startScriptPath = path.join(session.cwd, 'crx-quickstart', 'bin', startScript);

    if (!fs.existsSync(startScriptPath)) {
      throw new Error(`Start script not found at ${startScriptPath}`);
    }

    const env = this.getAemEnvironment(session);

    console.log('[AemProcessManager] Starting AEM with spawn on Unix:', startScriptPath);
    console.log('[AemProcessManager] Environment variables:', env);

    // Use traditional spawn for Unix-like systems
    const spawnProcess = spawn(startScriptPath, [], {
      cwd: session.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });

    session.spawnProcess = spawnProcess;

    // Handle spawn process output
    spawnProcess.stdout?.on('data', (data) => {
      this.sendAemLogData(session.instanceType, data.toString());
    });

    spawnProcess.stderr?.on('data', (data) => {
      this.sendAemLogData(session.instanceType, data.toString());
    });

    spawnProcess.on('exit', (code, signal) => {
      console.log(`[AemProcessManager] AEM ${session.instanceType} spawn process exited with code ${code}, signal ${signal}`);
      session.isRunning = false;
      this.sendPidStatusUpdate(session.instanceType, null, false);
    });

    session.isRunning = true;
    this.sendPidStatusUpdate(session.instanceType, spawnProcess.pid || null, true);
  }

  private getAemEnvironment(session: AemProcessSession): NodeJS.ProcessEnv {
    const baseEnv = {
      ...process.env,
      CQ_PORT: session.port.toString(),
      CQ_RUNMODE: session.runmode,
      CQ_JVM_OPTS: session.jvmOpts,
    };

    if (process.platform === 'win32') {
      return {
        ...baseEnv,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        CONEMUANSI: 'ON',
        // Ensure AEM runs in console mode, not GUI mode
        JAVA_OPTS: session.jvmOpts,
        // Add common Windows development tools to PATH
        PATH: this.getWindowsPath(process.env.PATH),
      };
    } else {
      return {
        ...baseEnv,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        JAVA_OPTS: session.jvmOpts,
        PATH: this.getUnixPath(process.env.PATH),
      };
    }
  }

  private getWindowsPath(existingPath?: string): string {
    const paths = [
      existingPath || '',
      'C:\\Program Files\\Java\\jdk-17\\bin',
      'C:\\Program Files\\Java\\jdk-11\\bin',
      'C:\\Program Files\\Java\\jdk-8\\bin',
      'C:\\Program Files\\Java\\jre1.8.0_291\\bin',
      'C:\\Program Files\\Git\\bin',
      'C:\\Program Files\\Git\\cmd',
      process.env.USERPROFILE + '\\AppData\\Local\\Microsoft\\WindowsApps',
    ].filter(Boolean);

    return paths.join(';');
  }

  private getUnixPath(existingPath?: string): string {
    const paths = [
      existingPath || '',
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin'
    ].filter(Boolean);

    return paths.join(':');
  }

  async stopAemProcess(processId: string): Promise<boolean> {
    const session = this.processes.get(processId);
    if (!session) {
      return false;
    }

    try {
      if (session.ptyProcess) {
        session.ptyProcess.kill();
      }
      if (session.spawnProcess && !session.spawnProcess.killed) {
        session.spawnProcess.kill('SIGTERM');
      }

      session.isRunning = false;
      this.sendPidStatusUpdate(session.instanceType, null, false);
      this.processes.delete(processId);
      
      console.log(`[AemProcessManager] Stopped AEM process ${processId}`);
      return true;
    } catch (error) {
      console.error(`[AemProcessManager] Error stopping AEM process ${processId}:`, error);
      return false;
    }
  }

  getProcessSession(processId: string): AemProcessSession | undefined {
    return this.processes.get(processId);
  }

  getAllSessions(): AemProcessSession[] {
    return Array.from(this.processes.values());
  }

  cleanup(): void {
    for (const [processId, session] of this.processes) {
      try {
        if (session.ptyProcess) {
          session.ptyProcess.kill();
        }
        if (session.spawnProcess && !session.spawnProcess.killed) {
          session.spawnProcess.kill();
        }
      } catch (error) {
        console.error(`Error cleaning up AEM process ${processId}:`, error);
      }
    }
    this.processes.clear();
  }

  private generateProcessId(instanceType: string): string {
    return `aem_${instanceType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private sendAemLogData(instanceType: string, data: string) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('aem-log-data', {
        instanceType,
        data
      });
    }
  }

  private sendPidStatusUpdate(instanceType: string, pid: number | null, isRunning: boolean) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('aem-pid-status', {
        instanceType,
        pid,
        isRunning
      });
    }
  }
} 