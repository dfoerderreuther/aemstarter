import { ChildProcess, spawn } from 'child_process';
import { Project } from '../../types/Project';
import { ProjectSettings } from './ProjectSettings';
import path from 'path';
import fs from 'fs';
import { BrowserWindow } from 'electron';

interface DispatcherInstance {
  process: ChildProcess | null;
  pid: number | null;
  port: number;
  config: string;
}

export class DispatcherManager {
    private project: Project;
    private instance: DispatcherInstance;
    private mainWindow: BrowserWindow | null = null;

    constructor(project: Project, mainWindow?: BrowserWindow) {
        this.project = project;
        this.mainWindow = mainWindow || null;
        this.instance = {
            process: null,
            pid: null,
            port: 80,
            config: './dispatcher-sdk/src'
        };
    }

    setMainWindow(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
    }

    async startDispatcher(): Promise<void> {
        if (this.instance.process) {
            throw new Error('Dispatcher is already running');
        }

        // Load settings from ProjectSettings
        const settings = ProjectSettings.getSettings(this.project);
        const dispatcherSettings = settings.dispatcher;
        
        if (!dispatcherSettings) {
            throw new Error('No dispatcher settings found');
        }

        const dispatcherDir = path.join(this.project.folderPath, 'dispatcher');
        const dockerRunScript = path.join(dispatcherDir, 'dispatcher-sdk/bin/docker_run_hot_reload.sh');

        // Check if dispatcher SDK is installed
        if (!fs.existsSync(dockerRunScript)) {
            throw new Error('Dispatcher SDK not found. Please ensure the dispatcher is properly installed.');
        }

        // Prepare environment variables and command
        const env = {
            ...process.env,
            DISP_LOG_LEVEL: 'Debug',
            REWRITE_LOG_LEVEL: 'Debug'
        };

        const args = [
            dockerRunScript,
            dispatcherSettings.config,
            'host.docker.internal:4503',
            dispatcherSettings.port.toString()
        ];

        console.log(`Starting dispatcher with command: ${args.join(' ')}`);
        console.log(`Working directory: ${dispatcherDir}`);

        try {
            // Start the dispatcher process
            const dispatcherProcess = spawn('bash', args, {
                cwd: dispatcherDir,
                env: env,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.instance.process = dispatcherProcess;
            this.instance.pid = dispatcherProcess.pid || null;
            this.instance.port = dispatcherSettings.port;
            this.instance.config = dispatcherSettings.config;

            // Handle process output
            dispatcherProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                console.log(`[Dispatcher stdout]: ${output}`);
                this.sendLogData(output);
            });

            dispatcherProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                console.log(`[Dispatcher stderr]: ${output}`);
                this.sendLogData(output);
            });

            // Handle process exit
            dispatcherProcess.on('exit', (code, signal) => {
                console.log(`Dispatcher process exited with code ${code} and signal ${signal}`);
                this.instance.process = null;
                this.instance.pid = null;
                this.sendStatusUpdate(false);
            });

            dispatcherProcess.on('error', (error) => {
                console.error('Dispatcher process error:', error);
                this.instance.process = null;
                this.instance.pid = null;
                this.sendStatusUpdate(false);
                throw error;
            });

            // Send initial status update
            this.sendStatusUpdate(true);

            console.log(`Dispatcher started with PID: ${dispatcherProcess.pid}`);
        } catch (error) {
            console.error('Error starting dispatcher:', error);
            throw error;
        }
    }

    async stopDispatcher(): Promise<void> {
        if (!this.instance.process) {
            throw new Error('Dispatcher is not running');
        }

        try {
            console.log(`Stopping dispatcher with PID: ${this.instance.pid}`);
            
            // Kill the process
            this.instance.process.kill('SIGTERM');
            
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Force kill if still running
            if (this.instance.process && !this.instance.process.killed) {
                this.instance.process.kill('SIGKILL');
            }

            this.instance.process = null;
            this.instance.pid = null;
            this.sendStatusUpdate(false);

            console.log('Dispatcher stopped successfully');
        } catch (error) {
            console.error('Error stopping dispatcher:', error);
            throw error;
        }
    }

    isDispatcherRunning(): boolean {
        return this.instance.process !== null && !this.instance.process.killed;
    }

    getDispatcherStatus() {
        return {
            isRunning: this.isDispatcherRunning(),
            pid: this.instance.pid,
            port: this.instance.port,
            config: this.instance.config
        };
    }

    private sendLogData(data: string) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('dispatcher-log-data', {
                projectId: this.project.id,
                data: data
            });
        }
    }

    private sendStatusUpdate(isRunning: boolean) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('dispatcher-status', {
                projectId: this.project.id,
                isRunning: isRunning,
                pid: this.instance.pid,
                port: this.instance.port
            });
        }
    }

    async flushDispatcher() {
        console.log('flushDispatcher');
        // TODO: Implement dispatcher flush functionality
        // This would typically send a flush request to the dispatcher
    }
}