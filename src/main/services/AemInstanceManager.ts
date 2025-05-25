import { ChildProcess, spawn } from 'child_process';
import { Project } from '../../types/Project';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { BrowserWindow } from 'electron';

interface AemInstance {
  process: ChildProcess | null;
  pid: number | null;
  port: number;
  runmode: string;
  jvmOpts: string;
  debugPort?: number;
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
    console.log(`[AemInstanceManager] Sending log data for ${instanceType}:`, data.substring(0, 100) + (data.length > 100 ? '...' : ''));
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
    console.log(`[AemInstanceManager] Sending batched log data for ${instanceType}, ${lines.length} lines`);
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

  private processLogData(instanceType: string, data: Buffer | string) {
    const text = data.toString();
    const bufferKey = `${instanceType}-${this.project.id}`;
    
    console.log(`[AemInstanceManager] Processing log data for ${bufferKey}, length: ${text.length}`);
    
    // Get any existing buffer for this stream
    const existingBuffer = this.logBuffers.get(bufferKey) || '';
    const fullText = existingBuffer + text;
    
    // Split by newlines
    const lines = fullText.split('\n');
    
    // Keep the last line as buffer (might be incomplete)
    const incompleteLastLine = lines.pop() || '';
    this.logBuffers.set(bufferKey, incompleteLastLine);
    
    console.log(`[AemInstanceManager] Found ${lines.length} complete lines, buffer contains: "${incompleteLastLine.substring(0, 50)}${incompleteLastLine.length > 50 ? '...' : ''}"`);
    
    // Send complete lines in batch
    const completeLines = lines.filter(line => line.trim());
    if (completeLines.length > 0) {
      console.log(`[AemInstanceManager] Sending ${completeLines.length} complete lines`);
      if (completeLines.length === 1) {
        this.sendLogData(instanceType, completeLines[0]);
      } else {
        this.sendBatchedLogData(instanceType, completeLines);
      }
    }
  }

  private async findJavaProcess(port: number): Promise<number | null> {
    return new Promise((resolve) => {
      // Use different commands based on platform
      const cmd = process.platform === 'win32'
        ? `netstat -ano | findstr :${port}`
        : `lsof -i :${port} -t`;

      exec(cmd, (error, stdout) => {
        if (error || !stdout) {
          resolve(null);
          return;
        }

        try {
          // Parse PID from command output
          const pid = parseInt(stdout.trim().split('\n')[0], 10);
          resolve(pid || null);
        } catch {
          resolve(null);
        }
      });
    });
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
    const logPath = path.join(
      this.project.folderPath,
      instanceType,
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
    port: number,
    runmode: string,
    jvmOpts: string,
    debugPort?: number
  ): Promise<void> {
    const instanceDir = path.join(this.project.folderPath, instanceType === 'author' ? 'author' : 'publish');
    const jarPath = path.join(instanceDir, 'aem-sdk-quickstart.jar');

    if (!fs.existsSync(jarPath)) {
      throw new Error(`AEM jar not found at ${jarPath}`);
    }

    const env = {
      ...process.env,
      CQ_PORT: port.toString(),
      CQ_RUNMODE: runmode,
      CQ_JVM_OPTS: jvmOpts,
      ...(debugPort && {
        CQ_JVM_DEBUG: 'true',
        CQ_JVM_DEBUG_PORT: debugPort.toString(),
      }),
    };

    const javaArgs = [
      ...(debugPort ? [`-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=${debugPort}`] : []),
      '-jar',
      jarPath,
      '-port',
      port.toString(),
      '-r',
      runmode,
      'start',
    ];

    const aemProcess = spawn('java', javaArgs, {
      cwd: instanceDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true
    });

    const instance: AemInstance = {
      process: aemProcess,
      pid: null,
      port,
      runmode,
      jvmOpts,
      debugPort,
      tailProcess: null
    };

    this.instances.set(instanceType, instance);

    // Start tailing after a short delay to allow AEM to create initial folders
    setTimeout(() => {
      this.startTailing(instanceType, instance);
    }, 5000);

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
        console.log(`Initial ${instanceType} process exited with code ${code} and signal ${signal}`);
      }
      
      const realPid = await this.findJavaProcess(port);
      if (realPid) {
        instance.pid = realPid;
        console.log(`Found AEM ${instanceType} process with PID ${realPid}`);
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

    // Reset all instance tracking
    for (const [instanceType, instance] of this.instances.entries()) {
      if (instance.tailProcess) {
        instance.tailProcess.kill();
        instance.tailProcess = null;
      }
      instance.process = null;
      instance.pid = null;
    }
    this.instances.clear();
  }

  isInstanceRunning(instanceType: 'author' | 'publisher'): boolean {
    const instance = this.instances.get(instanceType);
    if (!instance) return false;

    if (instance.pid) {
      try {
        process.kill(instance.pid, 0);
        return true;
      } catch {
        return false;
      }
    }

    return !!(instance.process && !instance.process.killed);
  }
} 