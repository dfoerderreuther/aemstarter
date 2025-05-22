import { ChildProcess, spawn } from 'child_process';
import { Project } from '../../types/Project';
import path from 'path';
import fs from 'fs';

interface AemInstance {
  process: ChildProcess | null;
  port: number;
  runmode: string;
  jvmOpts: string;
  debugPort?: number;
}

export class AemInstanceManager {
  private instances: Map<string, AemInstance> = new Map();
  private project: Project;

  constructor(project: Project) {
    this.project = project;
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
    });

    this.instances.set(instanceType, {
      process: aemProcess,
      port,
      runmode,
      jvmOpts,
      debugPort,
    });

    // Handle process events
    aemProcess.on('error', (error) => {
      console.error(`Error starting ${instanceType} instance:`, error);
    });

    aemProcess.on('exit', (code, signal) => {
      console.log(`${instanceType} instance exited with code ${code} and signal ${signal}`);
      this.instances.set(instanceType, {
        ...this.instances.get(instanceType)!,
        process: null,
      });
    });

    return new Promise((resolve, reject) => {
      let output = '';
      
      const handleOutput = (data: Buffer) => {
        const text = data.toString();
        output += text;
        
        // Check for startup completion
        if (output.includes('Ready to handle requests')) {
          cleanup();
          resolve();
        }
        
        // Check for startup failure
        if (output.includes('Server startup failed')) {
          cleanup();
          reject(new Error('Server startup failed'));
        }
      };

      const cleanup = () => {
        aemProcess.stdout?.removeListener('data', handleOutput);
        aemProcess.stderr?.removeListener('data', handleOutput);
      };

      aemProcess.stdout?.on('data', handleOutput);
      aemProcess.stderr?.on('data', handleOutput);

      // Set a timeout
      setTimeout(() => {
        cleanup();
        reject(new Error('Startup timeout'));
      }, 300000); // 5 minutes timeout
    });
  }

  async stopInstance(instanceType: 'author' | 'publisher'): Promise<void> {
    const instance = this.instances.get(instanceType);
    if (!instance || !instance.process) {
      return;
    }

    return new Promise((resolve, reject) => {
      instance.process!.kill();
      
      const timeout = setTimeout(() => {
        // Force kill if normal kill doesn't work
        try {
          process.kill(instance.process!.pid!);
        } catch (error) {
          console.error(`Error force killing ${instanceType} instance:`, error);
        }
        resolve();
      }, 30000);

      instance.process!.on('exit', () => {
        clearTimeout(timeout);
        this.instances.set(instanceType, {
          ...instance,
          process: null,
        });
        resolve();
      });
    });
  }

  isInstanceRunning(instanceType: 'author' | 'publisher'): boolean {
    const instance = this.instances.get(instanceType);
    return !!(instance?.process && !instance.process.killed);
  }

  getInstanceOutput(instanceType: 'author' | 'publisher'): { stdout: string[]; stderr: string[] } {
    const instance = this.instances.get(instanceType);
    if (!instance || !instance.process) {
      return { stdout: [], stderr: [] };
    }

    const stdout: string[] = [];
    const stderr: string[] = [];

    instance.process.stdout?.on('data', (data) => {
      stdout.push(data.toString());
    });

    instance.process.stderr?.on('data', (data) => {
      stderr.push(data.toString());
    });

    return { stdout, stderr };
  }
} 