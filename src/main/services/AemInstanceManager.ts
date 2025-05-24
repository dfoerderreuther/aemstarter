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
    console.log(`Waiting for log file to appear at: ${logPath}`);
    const startTime = Date.now();
    while (!fs.existsSync(logPath)) {
      if (Date.now() - startTime > maxWaitSeconds * 1000) {
        console.log(`Timeout waiting for log file after ${maxWaitSeconds} seconds`);
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log(`Log file found at: ${logPath}`);
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

    console.log(`Attempting to tail log file at: ${logPath}`);

    // Wait for log file to exist
    const exists = await this.waitForLogFile(logPath);
    if (!exists) {
      console.warn(`Log file not found after waiting: ${logPath}`);
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
    
    console.log(`Started tail process with PID: ${tailProcess.pid}`);
    instance.tailProcess = tailProcess;

    tailProcess.stdout?.on('data', (data) => {
      console.log(`Received tail stdout data: ${data.length} bytes`);
      
      // Split into lines and send immediately
      const lines = data.toString().split('\n');
      
      lines.forEach((line: string) => {
        if (line.trim()) {
          console.log('Streaming log line:', line.substring(0, 100) + '...');
          this.sendLogData(instanceType, line.trim());
        }
      });
    });

    tailProcess.stderr?.on('data', (data) => {
      console.log(`Received tail stderr data: ${data.length} bytes`);
      const lines = data.toString().split('\n');
      
      lines.forEach((line: string) => {
        if (line.trim()) {
          this.sendLogData(instanceType, `ERROR: ${line.trim()}`);
        }
      });
    });

    tailProcess.on('error', (error) => {
      console.error(`Error in tail process: ${error}`);
      this.sendLogData(instanceType, `Error tailing log file: ${error.message}`);
    });

    tailProcess.on('exit', (code, signal) => {
      console.log(`Tail process exited with code ${code} and signal ${signal}`);
      if (code !== 0 && !instance.tailProcess?.killed) {
        console.log('Attempting to restart tail process...');
        setTimeout(() => this.startTailing(instanceType, instance), 1000);
      } else if (instance.tailProcess?.killed) {
        console.log('Tail process was intentionally killed');
      } else {
        console.log('Tail process exited normally (code 0)');
      }
    });

    // Add periodic health check
    const healthCheck = setInterval(() => {
      if (instance.tailProcess && !instance.tailProcess.killed) {
        console.log(`Tail process health check: PID ${instance.tailProcess.pid}, streaming active`);
      } else {
        console.log('Tail process health check: Process not running');
        clearInterval(healthCheck);
      }
    }, 30000); // Check every 30 seconds

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
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      lines.forEach((line: string) => {
        this.sendLogData(instanceType, line);
      });
    });

    aemProcess.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      lines.forEach((line: string) => {
        this.sendLogData(instanceType, `STARTUP ERROR: ${line}`);
      });
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
        
        const lines = text.split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => {
          this.sendLogData(instanceType, line);
        });
        
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
        
        const lines = text.split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => {
          this.sendLogData(instanceType, `STARTUP ERROR: ${line}`);
        });
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