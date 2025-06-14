import { ChildProcess, spawn } from 'child_process';
import { Project } from '../../types/Project';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { BrowserWindow } from 'electron';
import { ProjectSettingsService } from './ProjectSettingsService';
import { AemHealthChecker, HealthStatus } from './AemHealthChecker';
import { BackupService } from './BackupService';

interface AemInstance {
  process: ChildProcess | null;
  pid: number | null;
  port: number;
  runmode: string;
  jvmOpts: string;
  isDebugMode: boolean; // Add debug mode tracking
  tailProcesses: Map<string, ChildProcess>; // Map of log file name to tail process
  selectedLogFiles: string[]; // Currently selected log files for tailing
}

export class AemInstanceManager {
  private instances: Map<string, AemInstance> = new Map();
  private project: Project;
  private logBuffers: Map<string, string> = new Map(); // Store incomplete lines
  private healthChecker: AemHealthChecker;

  constructor(project: Project) {
    this.project = project;
    this.healthChecker = new AemHealthChecker(project);
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
    
    // Send complete lines - don't filter out lines that might just be whitespace
    // as they could be meaningful in log context
    const completeLines = lines.filter(line => line.length > 0);
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
        // For Unix-like systems: use lsof to find the LISTENING process on the port
        // This ensures we get the server process, not client connections
        cmd = `lsof -i :${port} -sTCP:LISTEN -t 2>/dev/null | head -1`;
      }

      exec(cmd, (error, stdout, _stderr) => {
        if (error || !stdout.trim()) {
          console.log(`[AemInstanceManager] No LISTENING process found on port ${port}: ${error?.message || 'No output'}`);
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
                  console.log(`[AemInstanceManager] Found LISTENING process PID ${pid} on port ${port}`);
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
              console.log(`[AemInstanceManager] Found LISTENING process PID ${pid} on port ${port}`);
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

  private async findJavaProcessWithRetry(port: number, maxRetries = 10, delayMs = 2000): Promise<number | null> {
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

  private async waitForLogFile(logPath: string, maxWaitSeconds = 60): Promise<boolean> {
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

  getAvailableLogFiles(instanceType: string): string[] {
    const instanceDir = instanceType;
    const logPath = path.join(
      this.project.folderPath,
      instanceDir,
      'crx-quickstart',
      'logs'
    );

    if (!fs.existsSync(logPath)) {
      console.log(`[AemInstanceManager] No logs directory found at ${logPath}`);
      return ['error.log']; // Return default if logs directory doesn't exist yet
    }

    try {
      const files = fs.readdirSync(logPath);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      // Ensure error.log is always first if it exists, otherwise add it as default
      const errorLogIndex = logFiles.indexOf('error.log');
      if (errorLogIndex > 0) {
        logFiles.splice(errorLogIndex, 1);
        logFiles.unshift('error.log');
      } else if (errorLogIndex === -1) {
        logFiles.unshift('error.log');
      }
      
      return logFiles;
    } catch (error) {
      console.error(`Error reading log directory: ${error}`);
      return ['error.log']; // Return default on error
    }
  }

  private async startTailing(instanceType: string, instance: AemInstance, logFiles: string[] = ['error.log', 'stdout.log']) {
    console.log(`[AemInstanceManager] Starting tailing for ${instanceType} with log files: ${logFiles}`);

    // Stop any existing tail processes
    this.stopTailing(instanceType);
    
    // Use consistent directory mapping
    const instanceDir = instanceType === 'author' ? 'author' : 'publisher';
    const logsDir = path.join(
      this.project.folderPath,
      instanceDir,
      'crx-quickstart',
      'logs'
    );

    // Update selected log files
    instance.selectedLogFiles = logFiles;

    for (const logFile of logFiles) {
      const logPath = path.join(logsDir, logFile);

      // For oak-run logs, create the file if it doesn't exist to enable tailing
      if (logFile.includes('oak-run') && !fs.existsSync(logPath)) {
        try {
          // Ensure the logs directory exists
          const logDir = path.dirname(logPath);
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          // Create empty log file
          fs.writeFileSync(logPath, '');
        } catch (error) {
          console.error(`[AemInstanceManager] Failed to create oak-run log file: ${logPath}`, error);
          continue;
        }
      } else {
        // Wait for log file to exist (for regular AEM logs)
        const exists = await this.waitForLogFile(logPath);
        if (!exists) {
          console.warn(`Log file not found: ${logPath}`);
          continue;
        }
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
      
      instance.tailProcesses.set(logFile, tailProcess);

      // Stream log data as it comes in
      tailProcess.stdout?.on('data', (data) => {
        const dataStr = data.toString();
        
        // Process each line individually to ensure proper prefixing
        const lines = dataStr.split('\n');
        const processedLines: string[] = [];
        
        for (const line of lines) {
          if (line.length > 0) {
            processedLines.push(`[${logFile}] ${line}`);
          }
        }
        
        if (processedLines.length > 0) {
          // Join back with newlines and add a final newline to maintain the original format
          const prefixedData = processedLines.join('\n') + '\n';
          this.processLogData(instanceType, prefixedData);
        }
      });

      tailProcess.stderr?.on('data', (data) => {
        const prefixedData = `[${logFile}] ${data.toString()}`;
        this.processLogData(instanceType, prefixedData);
      });

      tailProcess.on('error', (error) => {
        console.error(`Error in tail process for ${logFile}: ${error}`);
        this.sendLogData(instanceType, `Error tailing log file ${logFile}: ${error.message}`);
      });

      tailProcess.on('exit', (code, _signal) => {
        if (code !== 0 && !tailProcess.killed) {
          console.warn(`Tail process for ${logFile} exited unexpectedly, restarting...`);
          setTimeout(() => {
            if (instance.selectedLogFiles.includes(logFile)) {
              this.startTailing(instanceType, instance, [logFile]);
            }
          }, 1000);
        }
      });

      if (!tailProcess.pid) {
        console.error(`Failed to start tail process for ${logFile}`);
        continue;
      }
    }
  }

  private stopTailing(instanceType: string) {
    const instance = this.instances.get(instanceType);
    if (!instance) return;

    // Stop all tail processes
    for (const [_logFile, tailProcess] of instance.tailProcesses) {
      if (tailProcess && !tailProcess.killed) {
        tailProcess.kill();
      }
    }
    instance.tailProcesses.clear();
    instance.selectedLogFiles = [];
  }

  async updateLogFiles(instanceType: 'author' | 'publisher', logFiles: string[]): Promise<void> {
    const instance = this.instances.get(instanceType);
    if (!instance) {
      // If instance doesn't exist yet, create a placeholder to store the selection
      const placeholderInstance: AemInstance = {
        process: null,
        pid: null,
        port: 0,
        runmode: '',
        jvmOpts: '',
        isDebugMode: false,
        tailProcesses: new Map(),
        selectedLogFiles: logFiles
      };
      this.instances.set(instanceType, placeholderInstance);
      // Start tailing even if AEM instance is not running (for oak-run logs)
      await this.startTailing(instanceType, placeholderInstance, logFiles);
      return;
    }

    // Restart tailing with new log files
    await this.startTailing(instanceType, instance, logFiles);
  }

  getSelectedLogFiles(instanceType: 'author' | 'publisher'): string[] {
    const instance = this.instances.get(instanceType);
    return instance?.selectedLogFiles || ['error.log', 'stdout.log'];
  }

  async startInstance(
    instanceType: 'author' | 'publisher',
    startType: 'start' | 'debug'
  ): Promise<void> {
    // Load settings from ProjectSettings
    const settings = ProjectSettingsService.getSettings(this.project);
    const instanceSettings = settings[instanceType];
    
    if (!instanceSettings) {
      throw new Error(`No settings found for ${instanceType} instance`);
    }

    const instanceDir = path.join(this.project.folderPath, instanceType);
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

      if (fs.existsSync(startScriptPath)) {
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
        console.log(`[AemInstanceManager] Start script not found at ${startScriptPath}, falling back to quickstart.jar`);
        // Fall back to quickstart.jar method
        const jarPath = path.join(instanceDir, 'aem-sdk-quickstart.jar');

        if (!fs.existsSync(jarPath)) {
          throw new Error(`Neither start script nor AEM jar found. Start script: ${startScriptPath}, Jar: ${jarPath}`);
        }

        const env = {
          ...process.env,
          CQ_PORT: port.toString(),
          CQ_RUNMODE: runmode,
          CQ_JVM_OPTS: jvmOpts,
        };

        const javaArgs = [
          '-jar',
          'aem-sdk-quickstart.jar',
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
    } else {
      throw new Error(`AEM instance not found at ${instanceDir}`);
    }

    const instance: AemInstance = {
      process: aemProcess,
      pid: null,
      port,
      runmode,
      jvmOpts,
      isDebugMode: startType === 'debug', // Set debug mode based on start type
      tailProcesses: new Map(),
      selectedLogFiles: this.getSelectedLogFiles(instanceType) // Use previously selected files or default
    };

    this.instances.set(instanceType, instance);

    // Start tailing after a short delay to allow AEM to create initial folders
    // Use the selected log files from the instance
    setTimeout(() => {
      this.startTailing(instanceType, instance, instance.selectedLogFiles);
    }, hasCrxQuickstart ? 0 : 5000);

    // Periodically check for the real AEM process PID
    const pidCheckInterval = setInterval(async () => {
      if (!instance.pid) {
        const realPid = await this.findJavaProcess(port);
        if (realPid) {
          instance.pid = realPid;
          this.sendPidStatusUpdate(instanceType, realPid, true);
          clearInterval(pidCheckInterval);
        }
      } else {
        this.sendPidStatusUpdate(instanceType, instance.pid, this.isInstanceRunning(instanceType));
        clearInterval(pidCheckInterval);
      }
    }, 1000);

    // Clear the interval after 5 minutes to avoid infinite checking
    setTimeout(() => {
      clearInterval(pidCheckInterval);
    }, 300000);

    aemProcess.on('error', (error) => {
      console.error(`Error starting ${instanceType} instance:`, error);
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

    // Wait for AEM to start (simplified - just wait for process to be found)
    return new Promise((resolve, reject) => {
      const startupTimeout = setTimeout(() => {
        reject(new Error('Startup timeout - AEM process not found'));
      }, 300000); // 5 minutes timeout

      const checkStartup = setInterval(async () => {
        const realPid = await this.findJavaProcess(port);
        if (realPid) {
          instance.pid = realPid;
          console.log(`[AemInstanceManager] AEM ${instanceType} started with PID ${realPid}`);
          this.sendPidStatusUpdate(instanceType, realPid, true);
          
          // Always start health checking (will check config on each run)
          console.log(`[AemInstanceManager] Starting health checks for ${instanceType}`);
          // Wait a bit for AEM to fully start before beginning health checks
          setTimeout(() => {
            this.healthChecker.startHealthChecking(instanceType, port, 30000); // Check every 30 seconds
          }, 10000); // Wait 10 seconds after startup
          
          clearTimeout(startupTimeout);
          clearInterval(checkStartup);
          resolve();
        }
      }, 5000);
    });
  }

  async stopInstance(instanceType: 'author' | 'publisher'): Promise<void> {
    console.log(`[AemInstanceManager] ###  Stopping ${instanceType} instance ###`);
    const instance = this.instances.get(instanceType);
    if (!instance) {
      console.log(`[AemInstanceManager] No instance found for ${instanceType}`);
      return;
    }

    // Stop health checking
    this.healthChecker.stopHealthChecking(instanceType);

    // Don't stop tailing!

    // Find the current LISTENING process on the port (this is the real AEM process)
    const currentPid = await this.findJavaProcess(instance.port);
    console.log(`[AemInstanceManager] Current AEM LISTENING process PID for ${instanceType}: ${currentPid}`);
    console.log(`[AemInstanceManager] Stored instance PID for ${instanceType}: ${instance.pid}`);

    // Kill the actual AEM process if found
    if (currentPid) {
      try {
        console.log(`[AemInstanceManager] Attempting to kill AEM LISTENING process ${currentPid} for ${instanceType}`);
        process.kill(currentPid, 'SIGTERM'); // Try graceful shutdown first
        
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if process is still running
        const stillRunning = await this.findJavaProcess(instance.port);
        if (stillRunning) {
          console.log(`[AemInstanceManager] Process ${currentPid} still running, forcing kill`);
          process.kill(currentPid, 'SIGKILL'); // Force kill if still running
        } else {
          console.log(`[AemInstanceManager] Process ${currentPid} terminated gracefully`);
        }
      } catch (error) {
        console.error(`[AemInstanceManager] Error killing AEM process ${currentPid}:`, error);
      }
    } else if (instance.pid) {
      // Fallback to stored PID if we can't find the current one
      try {
        console.log(`[AemInstanceManager] No current process found, trying stored PID ${instance.pid}`);
        process.kill(instance.pid, 'SIGTERM');
      } catch (error) {
        console.error(`[AemInstanceManager] Error killing stored PID ${instance.pid}:`, error);
      }
    }

    // Kill the original spawn process if it exists
    if (instance.process && !instance.process.killed) {
      try {
        console.log(`[AemInstanceManager] Killing original spawn process for ${instanceType}`);
        instance.process.kill('SIGTERM');
        
        // Wait for process to exit or force kill after timeout
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            try {
              if (instance.process && !instance.process.killed) {
                console.log(`[AemInstanceManager] Force killing original spawn process for ${instanceType}`);
                instance.process.kill('SIGKILL');
              }
            } catch (error) {
              console.error(`[AemInstanceManager] Error force killing spawn process:`, error);
            }
            resolve(undefined);
          }, 10000); // 10 second timeout

          instance.process!.on('exit', () => {
            console.log(`[AemInstanceManager] Original spawn process exited for ${instanceType}`);
            clearTimeout(timeout);
            resolve(undefined);
          });
        });
      } catch (error) {
        console.error(`[AemInstanceManager] Error killing original spawn process:`, error);
      }
    }

    // Clean up instance data
    instance.process = null;
    instance.pid = null;
    instance.isDebugMode = false; // Reset debug mode when stopping

    // Send final PID status update
    this.sendPidStatusUpdate(instanceType, null, false);

    // Verify the process is actually stopped
    const finalCheck = await this.findJavaProcess(instance.port);
    if (finalCheck) {
      console.warn(`[AemInstanceManager] Warning: AEM process ${finalCheck} still running on port ${instance.port} after stop attempt`);
    } else {
      console.log(`[AemInstanceManager] Successfully stopped ${instanceType} instance`);
    }
  }

  async killAllInstances() {
    // Stop all health checking
    this.healthChecker.cleanup();

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
      this.stopTailing(instanceType);
      instance.process = null;
      instance.pid = null;
      instance.isDebugMode = false; // Reset debug mode when killing
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

  // Screenshot and Health Check functionality
  async takeScreenshot(instanceType: 'author' | 'publisher'): Promise<string> {
    const instance = this.instances.get(instanceType);
    if (!instance || !instance.pid) {
      throw new Error(`${instanceType} instance is not running`);
    }

    return this.healthChecker.takeScreenshot(instanceType, instance.port);
  }

  getLatestScreenshot(instanceType: 'author' | 'publisher'): string | null {
    const healthStatus = this.healthChecker.getLastHealthStatus(instanceType);
    return healthStatus?.screenshotPath || null;
  }

  getHealthStatus(instanceType: 'author' | 'publisher'): HealthStatus | null {
    return this.healthChecker.getLastHealthStatus(instanceType);
  }

  async checkHealth(instanceType: 'author' | 'publisher'): Promise<HealthStatus> {
    const instance = this.instances.get(instanceType);
    if (!instance || !instance.pid) {
      throw new Error(`${instanceType} instance is not running`);
    }

    return this.healthChecker.checkHealth(instanceType, instance.port);
  }

  startHealthChecking(instanceType: 'author' | 'publisher', intervalMs = 30000) {
    const instance = this.instances.get(instanceType);
    if (!instance || !instance.pid) {
      console.warn(`Cannot start health checking for ${instanceType}: instance not running`);
      return;
    }

    this.healthChecker.startHealthChecking(instanceType, instance.port, intervalMs);
  }

  stopHealthChecking(instanceType: 'author' | 'publisher') {
    this.healthChecker.stopHealthChecking(instanceType);
  }

  cleanup() {
    this.healthChecker.cleanup();
  }

  isOakJarAvailable(instanceType: 'author' | 'publisher'): boolean {
    const instanceDir = instanceType;
    const instancePath = path.join(this.project.folderPath, instanceDir);
    const oakJarPath = path.join(instancePath, 'oak-run.jar');
    return fs.existsSync(oakJarPath);
  }

  async loadOakJar() {
    // Check if author instance is running
    if (!this.isInstanceRunning('author')) {
      throw new Error('Author instance must be running to load oak-run.jar');
    }

    const instance = this.instances.get('author');
    if (!instance) {
      throw new Error('Author instance not found');
    }

    // Get Oak version from bundles endpoint
    const auth = Buffer.from('admin:admin').toString('base64');
    const response = await fetch(`http://localhost:${instance.port}/system/console/bundles/org.apache.jackrabbit.oak-core.json`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to get Oak version from bundles endpoint: ${response.status} ${response.statusText}`);
    }

    const bundleInfo = await response.json();
    if (!bundleInfo.data || !Array.isArray(bundleInfo.data) || bundleInfo.data.length === 0) {
      throw new Error('Invalid bundle info response structure');
    }
    let oakVersion = bundleInfo.data[0].version;
    if (!oakVersion) {
      throw new Error('Oak version not found in bundle data');
    }
    console.log(`[AemInstanceManager] Found Oak version: ${oakVersion}`);

    // Extract major, minor, patch (ignore any -SNAPSHOT or timestamp suffix)
    // Examples:
    //   1.78.3-SNAPSHOT -> 1.78.3
    //   1.78.3.T20240610123456 -> 1.78.3
    //   1.78.0 -> 1.78.0
    const versionMatch = oakVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!versionMatch) {
      throw new Error(`Could not parse Oak version: ${oakVersion}`);
    }
    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    const patch = parseInt(versionMatch[3], 10);

    // Create install directory if it doesn't exist
    const installDir = path.join(this.project.folderPath, 'install');
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }

    // Try multiple versions with different strategies
    let found = false;
    const triedVersions: string[] = [];
    let jarPath = '';
    let lastError: any = null;
    
    // Strategy 1: Try current and lower patch versions
    const currentMajor = major;
    let currentMinor = minor;
    let currentPatch = patch;
    
    for (let attempt = 0; attempt < 15; attempt++) {
      const tryVersion = `${currentMajor}.${currentMinor}.${currentPatch}`;
      triedVersions.push(tryVersion);
      const oakJarUrl = `https://repo1.maven.org/maven2/org/apache/jackrabbit/oak-run/${tryVersion}/oak-run-${tryVersion}.jar`;
      jarPath = path.join(installDir, `oak-run-${tryVersion}.jar`);
      console.log(`[AemInstanceManager] Attempting to download oak-run.jar from ${oakJarUrl}`);
      
      try {
        const jarResponse = await fetch(oakJarUrl);
        if (jarResponse.ok) {
          const jarBuffer = await jarResponse.arrayBuffer();
          fs.writeFileSync(jarPath, Buffer.from(jarBuffer));
          console.log(`[AemInstanceManager] Downloaded oak-run.jar to ${jarPath}`);
          found = true;
          oakVersion = tryVersion;
          break;
        } else {
          console.warn(`[AemInstanceManager] oak-run.jar not found for version ${tryVersion}: ${jarResponse.statusText}`);
        }
      } catch (err) {
        lastError = err;
        console.warn(`[AemInstanceManager] Error downloading oak-run.jar for version ${tryVersion}: ${err}`);
      }
      
      // Decrement patch version
      currentPatch--;
      
      // If patch goes below 0, try the previous minor version
      if (currentPatch < 0) {
        currentMinor--;
        currentPatch = 10; // Start with patch version 10 for the new minor version
        
        // If minor goes below 70, stop (oak versions usually don't go that low)
        if (currentMinor < 70) {
          break;
        }
      }
    }
    
    // Strategy 2: If still not found, try some known stable versions
    if (!found) {
      const knownVersions = ['1.78.0', '1.76.0', '1.74.0', '1.72.0', '1.70.0', '1.68.0', '1.66.0', '1.64.0', '1.62.0', '1.60.0'];
      console.log(`[AemInstanceManager] Trying known stable versions: ${knownVersions.join(', ')}`);
      
      for (const tryVersion of knownVersions) {
        if (triedVersions.includes(tryVersion)) {
          continue; // Skip if already tried
        }
        
        triedVersions.push(tryVersion);
        const oakJarUrl = `https://repo1.maven.org/maven2/org/apache/jackrabbit/oak-run/${tryVersion}/oak-run-${tryVersion}.jar`;
        jarPath = path.join(installDir, `oak-run-${tryVersion}.jar`);
        console.log(`[AemInstanceManager] Attempting to download oak-run.jar from ${oakJarUrl}`);
        
        try {
          const jarResponse = await fetch(oakJarUrl);
          if (jarResponse.ok) {
            const jarBuffer = await jarResponse.arrayBuffer();
            fs.writeFileSync(jarPath, Buffer.from(jarBuffer));
            console.log(`[AemInstanceManager] Downloaded oak-run.jar to ${jarPath}`);
            found = true;
            oakVersion = tryVersion;
            break;
          } else {
            console.warn(`[AemInstanceManager] oak-run.jar not found for version ${tryVersion}: ${jarResponse.statusText}`);
          }
        } catch (err) {
          lastError = err;
          console.warn(`[AemInstanceManager] Error downloading oak-run.jar for version ${tryVersion}: ${err}`);
        }
      }
    }
    if (!found) {
      throw new Error(`Failed to download oak-run.jar for versions: ${triedVersions.join(', ')}${lastError ? `\nLast error: ${lastError}` : ''}`);
    }

    // Create symlinks in instance folders
    const instanceDirs = ['author', 'publisher'];
    for (const dir of instanceDirs) {
      const instancePath = path.join(this.project.folderPath, dir);
      const symlinkPath = path.join(instancePath, 'oak-run.jar');
      // Remove existing symlink if it exists
      if (fs.existsSync(symlinkPath)) {
        fs.unlinkSync(symlinkPath);
      }
      // Create new symlink
      fs.symlinkSync(jarPath, symlinkPath);
      console.log(`[AemInstanceManager] Created symlink at ${symlinkPath}`);
    }
  }

  async runOakCompaction(instanceType: 'author' | 'publisher'): Promise<void> {
    // Check if instance is stopped (required for compaction)
    if (this.isInstanceRunning(instanceType)) {
      throw new Error(`${instanceType} instance must be stopped before running compaction`);
    }

    // Check if oak-run.jar is available
    if (!this.isOakJarAvailable(instanceType)) {
      throw new Error('oak-run.jar is not available. Please load it first.');
    }

    const oakRun = new BackupService(this.project);
    await oakRun.compact(instanceType);
  }

  // Add method to get debug status
  isInstanceInDebugMode(instanceType: 'author' | 'publisher'): boolean {
    const instance = this.instances.get(instanceType);
    return instance?.isDebugMode || false;
  }
} 