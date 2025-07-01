import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import os from 'os';
import fs from 'fs';
import path from 'path';

export interface TerminalOptions {
  cwd?: string;
  shell?: string;
  env?: NodeJS.ProcessEnv;
}

export interface TerminalSession {
  id: string;
  ptyProcess: pty.IPty;
  cwd: string;
  shell: string;
}

export class TerminalService {
  private terminals = new Map<string, TerminalSession>();
  private mainWindow: BrowserWindow | null = null;

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow || null;
  }

  setMainWindow(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  async createTerminal(options: TerminalOptions = {}): Promise<{ terminalId: string; success: boolean }> {
    const terminalId = this.generateTerminalId();
    
    try {
      const shell = options.shell || this.getDefaultShell();
      const cwd = options.cwd || process.env.HOME || process.cwd();
      
      // Platform-specific environment setup
      const env = this.getPlatformEnvironment(options.env);
            
      // Create PTY process with proper terminal emulation and enhanced PATH
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: cwd,
        env: env,
        // Windows-specific options
        ...(process.platform === 'win32' && {
          handleFlowControl: true,
          flowControlPause: '\x13', // XOFF
          flowControlResume: '\x11', // XON
        })
      });

      const session: TerminalSession = {
        id: terminalId,
        ptyProcess,
        cwd,
        shell
      };

      this.terminals.set(terminalId, session);

      // Handle PTY data output with error handling
      ptyProcess.onData((data) => {
        try {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('terminal-data', terminalId, data);
          }
        } catch (error) {
          console.error(`Error sending terminal data for ${terminalId}:`, error);
        }
      });

      // Handle PTY exit with error handling
      ptyProcess.onExit(({ exitCode, signal }) => {
        try {
          console.log(`Terminal ${terminalId} exited with code ${exitCode}, signal ${signal}`);
          this.terminals.delete(terminalId);
          
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('terminal-exit', terminalId, exitCode, signal);
          }
        } catch (error) {
          console.error(`Error handling terminal exit for ${terminalId}:`, error);
        }
      });

      return { terminalId, success: true };
    } catch (error) {
      console.error('Error creating PTY terminal:', error);
      
      // Send error to renderer if possible
      try {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('terminal-error', terminalId, `Failed to create terminal: ${error instanceof Error ? error.message : String(error)}`);
        }
      } catch (sendError) {
        console.error('Error sending terminal creation error:', sendError);
      }
      
      throw error;
    }
  }

  async writeToTerminal(terminalId: string, data: string): Promise<boolean> {
    const session = this.terminals.get(terminalId);
    
    if (session && session.ptyProcess) {
      try {
        session.ptyProcess.write(data);
        return true;
      } catch (error) {
        console.error(`Error writing to PTY terminal ${terminalId}:`, error);
        
        // Clean up broken terminal
        try {
          this.terminals.delete(terminalId);
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('terminal-error', terminalId, `Terminal write error: ${error instanceof Error ? error.message : String(error)}`);
          }
        } catch (cleanupError) {
          console.error('Error during terminal cleanup:', cleanupError);
        }
        
        return false;
      }
    } else {
      console.log(`Cannot write to terminal ${terminalId}: session=${!!session}`);
    }
    return false;
  }

  async resizeTerminal(terminalId: string, cols: number, rows: number): Promise<boolean> {
    const session = this.terminals.get(terminalId);
    if (session && session.ptyProcess) {
      try {
        session.ptyProcess.resize(cols, rows);
        console.log(`Resized terminal ${terminalId} to ${cols}x${rows}`);
        return true;
      } catch (error) {
        console.error(`Error resizing PTY terminal ${terminalId}:`, error);
        return false;
      }
    }
    return false;
  }

  async killTerminal(terminalId: string): Promise<boolean> {
    const session = this.terminals.get(terminalId);
    if (session) {
      try {
        session.ptyProcess.kill();
        this.terminals.delete(terminalId);
        console.log(`Killed terminal ${terminalId}`);
        return true;
      } catch (error) {
        console.error(`Error killing PTY terminal ${terminalId}:`, error);
        // Still remove from map even if kill failed
        this.terminals.delete(terminalId);
        return false;
      }
    }
    return false;
  }

  getTerminalSession(terminalId: string): TerminalSession | undefined {
    return this.terminals.get(terminalId);
  }

  getAllSessions(): TerminalSession[] {
    return Array.from(this.terminals.values());
  }

  cleanup(): void {
    // Kill all active terminal sessions
    for (const [terminalId, session] of this.terminals) {
      try {
        session.ptyProcess.kill();
      } catch (error) {
        console.error(`Error cleaning up terminal ${terminalId}:`, error);
      }
    }
    this.terminals.clear();
  }

  // Clear all terminals (used when switching projects)
  clearAllTerminals(): void {
    console.log('Clearing all terminals for project switch');
    // Kill all active terminal sessions
    for (const [terminalId, session] of this.terminals) {
      try {
        session.ptyProcess.kill();
        console.log(`Cleared terminal ${terminalId}`);
      } catch (error) {
        console.error(`Error clearing terminal ${terminalId}:`, error);
      }
    }
    this.terminals.clear();
    
    // Notify renderer that all terminals have been cleared
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('terminals-cleared');
    }
  }

  private generateTerminalId(): string {
    return `term_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private getPlatformEnvironment(customEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const baseEnv = {
      ...process.env,
      ...customEnv,
    };

    if (process.platform === 'win32') {
      // Windows-specific environment setup
      return {
        ...baseEnv,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        // Ensure proper Windows console environment
        CONEMUANSI: 'ON',
        // Add common Windows development tools to PATH
        PATH: this.getWindowsPath(baseEnv.PATH),
      };
    } else {
      // Unix-like systems (macOS, Linux)
      return {
        ...baseEnv,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        PATH: this.getUnixPath(baseEnv.PATH),
      };
    }
  }

  private getWindowsPath(existingPath?: string): string {
    const paths = [
      existingPath || '',
      // Common Windows development tools
      'C:\\Program Files\\Git\\bin',
      'C:\\Program Files\\Git\\cmd',
      'C:\\Program Files\\Git\\usr\\bin',
      'C:\\Program Files\\nodejs',
      'C:\\Program Files\\Java\\jdk-17\\bin',
      'C:\\Program Files\\Java\\jdk-11\\bin',
      'C:\\Program Files\\Java\\jdk-8\\bin',
      'C:\\Program Files\\Java\\jre1.8.0_291\\bin',
      // WSL paths if available
      'C:\\Windows\\System32\\wsl.exe',
      // Common user paths
      process.env.USERPROFILE + '\\AppData\\Local\\Programs\\Microsoft VS Code\\bin',
      process.env.USERPROFILE + '\\AppData\\Roaming\\npm',
      process.env.USERPROFILE + '\\AppData\\Local\\Microsoft\\WindowsApps',
    ].filter(Boolean);

    return paths.join(';');
  }

  private getUnixPath(existingPath?: string): string {
    const paths = [
      existingPath || '',
      '/usr/local/bin',      // Docker Desktop, Homebrew
      '/opt/homebrew/bin',   // Apple Silicon Homebrew  
      '/usr/bin',
      '/bin'
    ].filter(Boolean);

    return paths.join(':');
  }

  private getDefaultShell(): string {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // Enhanced Windows shell detection
      const shells = [
        process.env.COMSPEC, // cmd.exe
        'powershell.exe',
        'pwsh.exe', // PowerShell Core
        'C:\\Windows\\System32\\cmd.exe',
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      ].filter(Boolean);

      for (const shell of shells) {
        if (shell && fs.existsSync(shell)) {
          console.log(`[TerminalService] Using Windows shell: ${shell}`);
          return shell;
        }
      }

      // Fallback to cmd.exe
      console.log('[TerminalService] Using fallback Windows shell: cmd.exe');
      return 'cmd.exe';
    } else if (platform === 'darwin') {
      // Enhanced macOS shell detection
      const shells = [
        process.env.SHELL,
        '/bin/zsh',
        '/bin/bash',
        '/bin/sh'
      ].filter(Boolean);

      for (const shell of shells) {
        if (shell && fs.existsSync(shell)) {
          console.log(`[TerminalService] Using macOS shell: ${shell}`);
          return shell;
        }
      }

      console.log('[TerminalService] Using fallback macOS shell: /bin/zsh');
      return '/bin/zsh';
    } else {
      // Linux and other Unix-like systems
      const shells = [
        process.env.SHELL,
        '/bin/bash',
        '/bin/sh'
      ].filter(Boolean);

      for (const shell of shells) {
        if (shell && fs.existsSync(shell)) {
          console.log(`[TerminalService] Using Unix shell: ${shell}`);
          return shell;
        }
      }

      console.log('[TerminalService] Using fallback Unix shell: /bin/bash');
      return '/bin/bash';
    }
  }
} 