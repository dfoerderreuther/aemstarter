import { spawn, ChildProcess } from 'child_process';
import { BrowserWindow } from 'electron';
import os from 'os';

export interface TerminalOptions {
  cwd?: string;
  shell?: string;
}

export interface TerminalSession {
  id: string;
  process: ChildProcess;
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
      
      // Create shell process with proper terminal environment
      const args = this.getShellArgs(shell);
      const ptyProcess = spawn(shell, args, {
        cwd: cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          // Ensure proper terminal behavior
          PS1: '\\u@\\h:\\w$ ',
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const session: TerminalSession = {
        id: terminalId,
        process: ptyProcess,
        cwd,
        shell
      };

      this.terminals.set(terminalId, session);

      // Handle process events
      this.setupProcessHandlers(session);

      // Send initial prompt for interactive shells
      if (ptyProcess.stdin) {
        // For bash/zsh, send a command to ensure we're in interactive mode
        setTimeout(() => {
          if (ptyProcess.stdin && !ptyProcess.killed) {
            ptyProcess.stdin.write('echo "Terminal ready"\n');
          }
        }, 100);
      }

      return { terminalId, success: true };
    } catch (error) {
      console.error('Error creating terminal:', error);
      throw error;
    }
  }

  async writeToTerminal(terminalId: string, data: string): Promise<boolean> {
    const session = this.terminals.get(terminalId);
    if (session && session.process.stdin && !session.process.killed) {
      try {
        session.process.stdin.write(data);
        return true;
      } catch (error) {
        console.error('Error writing to terminal:', error);
        return false;
      }
    }
    return false;
  }

  async resizeTerminal(terminalId: string, cols: number, rows: number): Promise<boolean> {
    const session = this.terminals.get(terminalId);
    if (session && session.process) {
      // For basic child processes, we can't directly resize the pty
      // But we can send the resize info if the process supports it
      return true;
    }
    return false;
  }

  async killTerminal(terminalId: string): Promise<boolean> {
    const session = this.terminals.get(terminalId);
    if (session) {
      try {
        session.process.kill('SIGTERM');
        this.terminals.delete(terminalId);
        return true;
      } catch (error) {
        console.error('Error killing terminal:', error);
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
        if (!session.process.killed) {
          session.process.kill('SIGTERM');
        }
      } catch (error) {
        console.error(`Error cleaning up terminal ${terminalId}:`, error);
      }
    }
    this.terminals.clear();
  }

  private generateTerminalId(): string {
    return `term_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private getDefaultShell(): string {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    } else {
      return process.env.SHELL || '/bin/bash';
    }
  }

  private getShellArgs(shell: string): string[] {
    // Return appropriate args for interactive shell
    if (shell.includes('bash')) {
      return ['-i']; // Interactive mode
    } else if (shell.includes('zsh')) {
      return ['-i']; // Interactive mode
    } else if (shell.includes('fish')) {
      return ['-i']; // Interactive mode
    } else if (shell.includes('cmd')) {
      return []; // cmd.exe doesn't need special args
    }
    return [];
  }

  private setupProcessHandlers(session: TerminalSession): void {
    const { id, process: ptyProcess } = session;

    // Handle process exit
    ptyProcess.on('exit', (code, signal) => {
      console.log(`Terminal ${id} exited with code ${code}, signal ${signal}`);
      this.terminals.delete(id);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('terminal-exit', id, code, signal);
      }
    });

    // Handle process errors
    ptyProcess.on('error', (error) => {
      console.error(`Terminal ${id} error:`, error);
      
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('terminal-error', id, error.message);
      }
    });

    // Forward stdout to renderer with buffering for better performance
    let outputBuffer = '';
    const flushBuffer = () => {
      if (outputBuffer && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('terminal-data', id, outputBuffer);
        outputBuffer = '';
      }
    };

    ptyProcess.stdout?.on('data', (data) => {
      outputBuffer += data.toString();
      // Flush buffer periodically or when it gets large
      if (outputBuffer.length > 1024) {
        flushBuffer();
      }
    });

    // Flush any remaining buffer periodically
    setInterval(flushBuffer, 50);

    // Forward stderr to renderer  
    ptyProcess.stderr?.on('data', (data) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('terminal-data', id, data.toString());
      }
    });
  }
} 