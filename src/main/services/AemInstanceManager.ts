import { ChildProcess, spawn } from 'child_process';
import { Project } from '../../types/Project';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { BrowserWindow } from 'electron';
import { ProjectSettings } from './ProjectSettings';

interface AemInstance {
  process: ChildProcess | null;
  pid: number | null;
  port: number;
  runmode: string;
  jvmOpts: string;
  tailProcess: ChildProcess | null;
}

export class AemInstanceManager {
  private instances: Map<string, AemInstance> = new Map();
  private project: Project;
  private logBuffers: Map<string, string> = new Map(); // Store incomplete lines

  constructor(project: Project) {
    this.project = project;
  }

  private sendLogData(instanceType: string, data: string) {
    // Send log data immediately to all windows
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('aem-log-data', {
        projectId: this.project.id,
        instanceType,
        data
      });
    });
  }

  private sendBatchedLogData(instanceType: string, lines: string[]) {
    // Send multiple lines at once to reduce IPC overhead
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('aem-log-data-batch', {
        projectId: this.project.id,
        instanceType,
        lines
      });
    });
  }

  private sendPidStatusUpdate(instanceType: string, pid: number | null, isRunning: boolean) {
    // Send PID status update to all windows
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('aem-pid-status', {
        projectId: this.project.id,
        instanceType,
        pid,
        isRunning
      });
    });
  }

  private processLogData(instanceType: string, data: Buffer | string) {
    const text = data.toString();
    const bufferKey = `${instanceType}-${this.project.id}`;
    
    
    // Get any existing buffer for this stream
    const existingBuffer = this.logBuffers.get(bufferKey) || '';
    const fullText = existingBuffer + text;
    
    // Split by newlines
    const lines = fullText.split('\n');
    
    // Keep the last line as buffer (might be incomplete)
    const incompleteLastLine = lines.pop() || '';
    this.logBuffers.set(bufferKey, incompleteLastLine);
    
    
    // Send complete lines in batch
    const completeLines = lines.filter(line => line.trim());
    if (completeLines.length > 0) {
      if (completeLines.length === 1) {
        this.sendLogData(instanceType, completeLines[0]);
      } else {
        this.sendBatchedLogData(instanceType, completeLines);
      }
    }
  }

  private async findJavaProcess(port: number): Promise<number | null> {
    return new Promise((resolve) => {
      let cmd: string;
      
      if (process.platform === 'win32') {
        // For Windows: find process using the port, then extract PID
        cmd = `netstat -ano | findstr :${port}`;
      } else {
        // For Unix-like systems: use lsof to find processes using the port
        // Filter for Java processes specifically
        cmd = `lsof -i :${port} -t 2>/dev/null | head -1`;
      }

      exec(cmd, (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
          console.log(`[AemInstanceManager] No process found on port ${port}: ${error?.message || 'No output'}`);
          resolve(null);
          return;
        }

        try {
          if (process.platform === 'win32') {
            // Parse Windows netstat output
            // Format: TCP    0.0.0.0:4502    0.0.0.0:0    LISTENING    1234
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5 && parts[3] === 'LISTENING') {
                const pid = parseInt(parts[4], 10);
                if (pid && !isNaN(pid)) {
                  console.log(`[AemInstanceManager] Found process PID ${pid} on port ${port}`);
                  resolve(pid);
                  return;
                }
              }
            }
            resolve(null);
          } else {
            // Parse Unix lsof output (just the PID)
            const pid = parseInt(stdout.trim(), 10);
            if (pid && !isNaN(pid)) {
              console.log(`[AemInstanceManager] Found process PID ${pid} on port ${port}`);
              resolve(pid);
            } else {
              resolve(null);
            }
          }
        } catch (parseError) {
          console.error(`[AemInstanceManager] Error parsing process output for port ${port}:`, parseError);
          resolve(null);
        }
      });
    });
  }

  private async findJavaProcessWithRetry(port: number, maxRetries: number = 10, delayMs: number = 2000): Promise<number | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[AemInstanceManager] Attempting to find Java process on port ${port} (attempt ${attempt}/${maxRetries})`);
      
      const pid = await this.findJavaProcess(port);
      if (pid) {
        return pid;
      }
      
      if (attempt < maxRetries) {
        console.log(`[AemInstanceManager] Process not found on port ${port}, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.warn(`[AemInstanceManager] Failed to find Java process on port ${port} after ${maxRetries} attempts`);
    return null;
  }

  private async waitForLogFile(logPath: string, maxWaitSeconds: number = 60): Promise<boolean> {
    const startTime = Date.now();
    while (!fs.existsSync(logPath)) {
      if (Date.now() - startTime > maxWaitSeconds * 1000) {
        console.warn(`Timeout waiting for log file after ${maxWaitSeconds} seconds: ${logPath}`);
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return true;
  }

  private async startTailing(instanceType: string, instance: AemInstance) {
    // Use consistent directory mapping
    const instanceDir = instanceType === 'author' ? 'author' : 'publish';
    const logPath = path.join(
      this.project.folderPath,
      instanceDir,
      'crx-quickstart',
      'logs',
      'error.log'
    );

    // Wait for log file to exist
    const exists = await this.waitForLogFile(logPath);
    if (!exists) {
      console.warn(`Log file not found: ${logPath}`);
      return;
    }

    // Use different tail command based on platform
    let tailProcess: ChildProcess;
    if (process.platform === 'win32') {
      tailProcess = spawn('powershell.exe', [
        '-Command',
        `Get-Content -Path "${logPath}" -Wait -Tail 100`
      ]);
    } else {
      tailProcess = spawn('tail', ['-f', '-n', '100', logPath]);
    }
    
    instance.tailProcess = tailProcess;

    // Stream log data as it comes in
    tailProcess.stdout?.on('data', (data) => {
      this.processLogData(instanceType, data);
    });

    tailProcess.stderr?.on('data', (data) => {
      this.processLogData(instanceType, data);
    });

    tailProcess.on('error', (error) => {
      console.error(`Error in tail process: ${error}`);
      this.sendLogData(instanceType, `Error tailing log file: ${error.message}`);
    });

    tailProcess.on('exit', (code, signal) => {
      if (code !== 0 && !instance.tailProcess?.killed) {
        console.warn(`Tail process exited unexpectedly, restarting...`);
        setTimeout(() => this.startTailing(instanceType, instance), 1000);
      }
    });

    if (!tailProcess.pid) {
      console.error('Failed to start tail process');
      return;
    }
  }

  async startInstance(
    instanceType: 'author' | 'publisher',
    startType: 'start' | 'debug'
  ): Promise<void> {
    // Load settings from ProjectSettings
    const settings = ProjectSettings.getSettings(this.project);
    const instanceSettings = settings[instanceType];
    
    if (!instanceSettings) {
      throw new Error(`No settings found for ${instanceType} instance`);
    }

    const instanceDir = path.join(this.project.folderPath, instanceType === 'author' ? 'author' : 'publish');
    const crxQuickstartDir = path.join(instanceDir, 'crx-quickstart');
    const hasCrxQuickstart = fs.existsSync(crxQuickstartDir);

    const port = instanceSettings.port;
    const runmode = instanceSettings.runmode;
    let jvmOpts = instanceSettings.jvmOpts;

    // Handle debug mode
    if (startType === 'debug') {
      jvmOpts += instanceSettings.debugJvmOpts;
    }

    let aemProcess: ChildProcess;

    if (hasCrxQuickstart) {
      console.log('[AemInstanceManager] ### Starting AEM instance with crx-quickstart ###');
      // Use crx-quickstart/bin/start script
      const startScript = process.platform === 'win32' ? 'start.bat' : 'start';
      const startScriptPath = path.join(crxQuickstartDir, 'bin', startScript);

      if (!fs.existsSync(startScriptPath)) {
        throw new Error(`Start script not found at ${startScriptPath}`);
      }

      const env = {
        ...process.env,
        CQ_PORT: port.toString(),
        CQ_RUNMODE: runmode,
        CQ_JVM_OPTS: jvmOpts,
      };

      aemProcess = spawn(startScriptPath, [], {
        cwd: instanceDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
        shell: process.platform === 'win32'
      });
    } else {
      console.log('[AemInstanceManager] ### Starting AEM instance with quickstart.jar ###');
      // Use quickstart.jar
      const jarPath = path.join(instanceDir, 'aem-sdk-quickstart.jar');

      if (!fs.existsSync(jarPath)) {
        throw new Error(`AEM jar not found at ${jarPath}`);
      }

      const env = {
        ...process.env,
        CQ_PORT: port.toString(),
        CQ_RUNMODE: runmode,
        CQ_JVM_OPTS: jvmOpts,
      };

      const javaArgs = [
        '-jar',
        jarPath,
        '-port',
        port.toString(),
        '-r',
        runmode,
        'start',
      ];

      aemProcess = spawn('java', javaArgs, {
        cwd: instanceDir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true
      });
    }

    const instance: AemInstance = {
      process: aemProcess,
      pid: null,
      port,
      runmode,
      jvmOpts,
      tailProcess: null
    };

    this.instances.set(instanceType, instance);

    // Start tailing after a short delay to allow AEM to create initial folders
    setTimeout(() => {
      this.startTailing(instanceType, instance);
    }, 5000);

    // Periodically check for the real AEM process PID
    const pidCheckInterval = setInterval(async () => {
      if (!instance.pid) {
        const realPid = await this.findJavaProcess(port);
        if (realPid) {
          instance.pid = realPid;
          console.log(`[AemInstanceManager] Found AEM ${instanceType} process with PID ${realPid}`);
          this.sendPidStatusUpdate(instanceType, realPid, true);
          clearInterval(pidCheckInterval);
        }
      } else {
        this.sendPidStatusUpdate(instanceType, instance.pid, this.isInstanceRunning(instanceType));
        clearInterval(pidCheckInterval);
      }
    }, 3000);

    // Clear the interval after 5 minutes to avoid infinite checking
    setTimeout(() => {
      clearInterval(pidCheckInterval);
    }, 300000);

    // Stream initial startup messages directly
    aemProcess.stdout?.on('data', (data) => {
      this.processLogData(instanceType, data);
    });

    aemProcess.stderr?.on('data', (data) => {
      this.processLogData(instanceType, data);
    });

    aemProcess.on('error', (error) => {
      console.error(`Error starting ${instanceType} instance:`, error);
      this.sendLogData(instanceType, `Process error: ${error.message}`);
    });

    aemProcess.on('exit', async (code, signal) => {
      if (!instance.pid) {
        console.log(`[AemInstanceManager] Initial ${instanceType} process exited with code ${code} and signal ${signal}`);
      }
      
      const realPid = await this.findJavaProcessWithRetry(port);
      if (realPid) {
        instance.pid = realPid;
        console.log(`[AemInstanceManager] Found AEM ${instanceType} process with PID ${realPid}`);
        this.sendPidStatusUpdate(instanceType, realPid, true);
      } else {
        this.sendPidStatusUpdate(instanceType, null, false);
      }
    });

    return new Promise((resolve, reject) => {
      let startupOutput = '';
      
      const handleStartupOutput = (data: Buffer) => {
        const text = data.toString();
        startupOutput += text;
        
        // Process the raw data through our buffering system
        this.processLogData(instanceType, data);
        
        if (startupOutput.includes('Ready to handle requests')) {
          cleanup();
          resolve();
        }
        
        if (startupOutput.includes('Server startup failed')) {
          cleanup();
          reject(new Error('Server startup failed'));
        }
      };

      const handleStartupError = (data: Buffer) => {
        const text = data.toString();
        startupOutput += text;
        
        // Process the raw data through our buffering system
        this.processLogData(instanceType, data);
      };

      const cleanup = () => {
        aemProcess.stdout?.removeListener('data', handleStartupOutput);
        aemProcess.stderr?.removeListener('data', handleStartupError);
      };

      aemProcess.stdout?.on('data', handleStartupOutput);
      aemProcess.stderr?.on('data', handleStartupError);

      setTimeout(() => {
        cleanup();
        reject(new Error('Startup timeout'));
      }, 300000);
    });
  }

  async stopInstance(instanceType: 'author' | 'publisher'): Promise<void> {
    console.log(`[AemInstanceManager] ###  Stopping ${instanceType} instance ###`);
    const instance = this.instances.get(instanceType);
    if (!instance) {
      return;
    }

    // Clean up log buffer
    const bufferKey = `${instanceType}-${this.project.id}`;
    this.logBuffers.delete(bufferKey);

    // Stop log tailing
    if (instance.tailProcess) {
      instance.tailProcess.kill();
      instance.tailProcess = null;
    }

    if (instance.pid) {
      try {
        process.kill(instance.pid);
      } catch (error) {
        console.error(`Error killing AEM process with PID ${instance.pid}:`, error);
      }
    }

    // Send PID status update
    this.sendPidStatusUpdate(instanceType, null, false);

    if (instance.process) {
      return new Promise((resolve) => {
        instance.process!.kill();
        
        const timeout = setTimeout(() => {
          try {
            if (instance.process?.pid) {
              process.kill(instance.process.pid);
            }
          } catch (error) {
            console.error(`Error force killing ${instanceType} instance:`, error);
          }
          resolve();
        }, 30000);

        instance.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }

  async killAllInstances() {
    // Kill all processes using pkill
    const cmd = process.platform === 'win32'
      ? `pkill -9 -f quickstart`
      : `pkill -9 -f quickstart`;

    exec(cmd, (error) => {
      if (error) {
        console.error(`Error killing all instances:`, error);
      }
    });

    // Clean up all log buffers
    this.logBuffers.clear();

    // Reset all instance tracking and send PID status updates
    for (const [instanceType, instance] of this.instances.entries()) {
      if (instance.tailProcess) {
        instance.tailProcess.kill();
        instance.tailProcess = null;
      }
      instance.process = null;
      instance.pid = null;
      // Send PID status update for each instance
      this.sendPidStatusUpdate(instanceType, null, false);
    }
    this.instances.clear();
  }

  isInstanceRunning(instanceType: 'author' | 'publisher'): boolean {
    const instance = this.instances.get(instanceType);
    if (!instance) {
      this.sendPidStatusUpdate(instanceType, null, false);
      return false;
    }

    if (instance.pid) {
      try {
        process.kill(instance.pid, 0);
        this.sendPidStatusUpdate(instanceType, instance.pid, true);
        return true;
      } catch {
        this.sendPidStatusUpdate(instanceType, null, false);
        return false;
      }
    }

    const isRunning = !!(instance.process && !instance.process.killed);
    this.sendPidStatusUpdate(instanceType, instance.pid, isRunning);
    return isRunning;
  }

  getInstancePid(instanceType: 'author' | 'publisher'): number | null {
    const instance = this.instances.get(instanceType);
    return instance?.pid || null;
  }
} 