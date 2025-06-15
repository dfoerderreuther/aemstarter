import { ChildProcess, spawn } from 'child_process';
import { Project } from '../../types/Project';
import { ProjectSettingsService } from './ProjectSettingsService';
import path from 'path';
import fs from 'fs';
import { BrowserWindow } from 'electron';
import { AemHealthChecker, HealthStatus } from './AemHealthChecker';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
    private healthChecker: AemHealthChecker;

    constructor(project: Project, mainWindow?: BrowserWindow) {
        this.project = project;
        this.mainWindow = mainWindow || null;
        this.healthChecker = new AemHealthChecker(project);
        this.instance = {
            process: null,
            pid: null,
            port: 80,
            config: './dispatcher-sdk/src'
        };
    }

    setMainWindow(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        // Send current status when window is set/updated
        this.sendStatusUpdate(this.isDispatcherRunning());
    }

    async startDispatcher(): Promise<void> {
        // Clean up any stale references first
        this.cleanupStaleReferences();
        
        if (this.instance.process) {
            throw new Error('Dispatcher is already running');
        }

        // Ensure clean state before starting
        this.instance.process = null;
        this.instance.pid = null;

        // Load settings from ProjectSettings
        const settings = ProjectSettingsService.getSettings(this.project);
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
            `host.docker.internal:${settings.publisher.port}`,
            dispatcherSettings.port.toString()
        ];

        console.log(`Starting dispatcher with command: ${args.join(' ')}`);
        console.log(`Working directory: ${dispatcherDir}`);

        try {
            // Start the dispatcher process
            const dispatcherProcess = spawn('bash', args, {
                cwd: dispatcherDir,
                env: env,
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: true
            });

            // Immediately check if process started successfully
            if (!dispatcherProcess.pid) {
                throw new Error('Failed to start dispatcher process - no PID assigned');
            }

            this.instance.process = dispatcherProcess;
            this.instance.pid = dispatcherProcess.pid;
            this.instance.port = dispatcherSettings.port;
            this.instance.config = dispatcherSettings.config;

            // Handle process output
            dispatcherProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                this.sendLogData(output);
            });

            dispatcherProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                this.sendLogData(output);
            });

            // Handle process exit - ensure cleanup
            dispatcherProcess.on('exit', (code, signal) => {
                console.log(`Dispatcher process exited with code ${code} and signal ${signal}`);
                // Only clean up if this is still our current process
                if (this.instance.process === dispatcherProcess) {
                    this.instance.process = null;
                    this.instance.pid = null;
                    this.healthChecker.stopHealthChecking('dispatcher');
                    this.sendStatusUpdate(false);
                }
            });

            dispatcherProcess.on('error', (error) => {
                console.error('Dispatcher process error:', error);
                // Only clean up if this is still our current process
                if (this.instance.process === dispatcherProcess) {
                    this.instance.process = null;
                    this.instance.pid = null;
                    this.healthChecker.stopHealthChecking('dispatcher');
                    this.sendStatusUpdate(false);
                }
            });

            // Wait a moment to ensure process is stable before sending status update
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify process is still running before sending success status
            if (dispatcherProcess.killed || dispatcherProcess.exitCode !== null) {
                throw new Error('Dispatcher process terminated immediately after start');
            }

            // Send initial status update
            this.sendStatusUpdate(true);
            
            // Start health checking after a short delay to allow dispatcher to start
            setTimeout(() => {
                if (this.instance.process === dispatcherProcess && this.isDispatcherRunning()) {
                    this.healthChecker.startHealthChecking('dispatcher', this.instance.port, 30000);
                }
            }, 10000); // Wait 10 seconds after startup
            
            // Send another status update after a short delay to ensure UI synchronization
            setTimeout(() => {
                if (this.instance.process === dispatcherProcess && this.isDispatcherRunning()) {
                    this.sendStatusUpdate(true);
                }
            }, 1000);

            console.log(`Dispatcher started successfully with PID: ${dispatcherProcess.pid}`);
        } catch (error) {
            console.error('Error starting dispatcher:', error);
            // Ensure clean state on error
            this.instance.process = null;
            this.instance.pid = null;
            this.sendStatusUpdate(false);
            throw error;
        }
    }

    async stopDispatcher(): Promise<void> {
        if (!this.instance.process) {
            throw new Error('Dispatcher is not running');
        }

        // Stop health checking
        this.healthChecker.stopHealthChecking('dispatcher');

        const processToStop = this.instance.process;
        const pidToStop = this.instance.pid;

        try {
            console.log(`Stopping dispatcher with PID: ${pidToStop}`);
            
            // Send SIGINT (Ctrl+C) to the process group - this is the standard way
            // the dispatcher script expects to be stopped
            if (pidToStop) {
                try {
                    // Kill the entire process group with SIGINT (Ctrl+C equivalent)
                    process.kill(-pidToStop, 'SIGINT');
                    console.log('Sent SIGINT to process group');
                } catch (killError) {
                    console.warn('Error sending SIGINT to process group, trying individual process:', killError);
                    // Fallback to killing just the main process
                    processToStop.kill('SIGINT');
                }
            } else {
                processToStop.kill('SIGINT');
            }
            
            // Wait longer for graceful shutdown since Docker containers may take time to stop
            console.log('Waiting for graceful shutdown...');
            let waitTime = 0;
            const maxWaitTime = 10000; // 10 seconds
            const checkInterval = 500; // Check every 500ms
            
            while (waitTime < maxWaitTime && processToStop.exitCode === null && !processToStop.killed) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                waitTime += checkInterval;
            }
            
            // If still running, try SIGTERM
            if (processToStop.exitCode === null && !processToStop.killed) {
                console.log('Process still running, sending SIGTERM...');
                if (pidToStop) {
                    try {
                        process.kill(-pidToStop, 'SIGTERM');
                    } catch (killError) {
                        console.warn('Error sending SIGTERM to process group:', killError);
                        processToStop.kill('SIGTERM');
                    }
                } else {
                    processToStop.kill('SIGTERM');
                }
                
                // Wait a bit more for SIGTERM
                waitTime = 0;
                const maxTermWaitTime = 5000; // 5 seconds
                while (waitTime < maxTermWaitTime && processToStop.exitCode === null && !processToStop.killed) {
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                    waitTime += checkInterval;
                }
            }
            
            // Final force kill if absolutely necessary
            if (processToStop.exitCode === null && !processToStop.killed) {
                console.log('Process still running, force killing with SIGKILL...');
                this.killDispatcher();
                
                // Wait a bit for force kill to take effect
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log('Dispatcher stopped successfully');
        } catch (error) {
            console.error('Error stopping dispatcher:', error);
        } finally {
            // Always clean up instance state, regardless of how stopping went
            if (this.instance.process === processToStop) {
                this.instance.process = null;
                this.instance.pid = null;
                this.sendStatusUpdate(false);
            }
        }
    }

    async killDispatcher(): Promise<void> {
        const port = this.instance.port;
        console.log(`[DispatcherManager] Force killing dispatcher containers on port ${port}`);
        
        try {
            // Stop health checking first
            this.healthChecker.stopHealthChecking('dispatcher');
            
            
            // Find containers using the dispatcher port
            console.log(`Looking for Docker containers using port ${port}...`);
            
            // First, try to find containers by port mapping
            let containerIds: string[] = [];
            
            try {
                const { stdout: portOutput } = await execAsync(`docker ps --format "{{.ID}} {{.Ports}}" | grep ":${port}->"`, { timeout: 10000 });
                if (portOutput.trim()) {
                    containerIds = portOutput.trim().split('\n').map((line: string) => line.split(' ')[0]);
                    console.log(`Found containers by port mapping: ${containerIds.join(', ')}`);
                }
            } catch (portError) {
                console.log('No containers found by port mapping or error occurred:', portError instanceof Error ? portError.message : String(portError));
            }
            
            if (containerIds.length === 0) {
                console.log('No Docker containers found to kill');
                this.sendLogData('No Docker containers found to kill\n');
            } else {
                console.log(`Found ${containerIds.length} container(s) to kill: ${containerIds.join(', ')}`);
                this.sendLogData(`Killing ${containerIds.length} Docker container(s): ${containerIds.join(', ')}\n`);
                
                // Kill each container
                for (const containerId of containerIds) {
                    try {
                        console.log(`Killing container ${containerId}...`);
                        await execAsync(`docker kill ${containerId}`, { timeout: 10000 });
                        this.sendLogData(`Killed container ${containerId}\n`);
                        
                        // Also remove the container to clean up
                        try {
                            await execAsync(`docker rm ${containerId}`, { timeout: 5000 });
                            console.log(`Removed container ${containerId}`);
                        } catch (rmError) {
                            console.warn(`Could not remove container ${containerId}:`, rmError instanceof Error ? rmError.message : String(rmError));
                        }
                    } catch (killError) {
                        console.error(`Error killing container ${containerId}:`, killError);
                        this.sendLogData(`Error killing container ${containerId}: ${killError instanceof Error ? killError.message : String(killError)}\n`);
                    }
                }
            }
            
            // Clean up our internal state
            this.instance.process = null;
            this.instance.pid = null;
            this.sendStatusUpdate(false);
            
            console.log('Docker dispatcher kill operation completed');
            this.sendLogData('Docker dispatcher kill operation completed\n');
            
        } catch (error) {
            console.error('Error during killDispatcher:', error);
            this.sendLogData(`Error during force kill: ${error instanceof Error ? error.message : String(error)}\n`);
            
            // Still clean up our state even if Docker operations failed
            this.instance.process = null;
            this.instance.pid = null;
            this.sendStatusUpdate(false);
            
            throw error;
        }
    }

    isDispatcherRunning(): boolean {
        if (!this.instance.process) {
            return false;
        }
        
        // Check if process is actually still running
        if (this.instance.process.killed || this.instance.process.exitCode !== null) {
            // Process is dead, clean up
            this.instance.process = null;
            this.instance.pid = null;
            this.sendStatusUpdate(false);
            return false;
        }
        
        return true;
    }

    clearCache(): void {
        try {
            const cacheDir = path.join(this.project.folderPath, 'dispatcher', 'cache', 'html');
            
            // Check if cache directory exists
            if (!fs.existsSync(cacheDir)) {
                this.sendLogData(`Cache directory does not exist: ${cacheDir}\n`);
                return;
            }
            
            // Read directory contents and delete each item
            const items = fs.readdirSync(cacheDir);
            
            if (items.length === 0) {
                this.sendLogData(`Cache directory is already empty\n`);
                return;
            }
            
            let deletedCount = 0;
            for (const item of items) {
                const itemPath = path.join(cacheDir, item);
                try {
                    fs.rmSync(itemPath, { recursive: true, force: true });
                    deletedCount++;
                } catch (itemError) {
                    console.error(`[DispatcherManager] Error deleting cache item ${itemPath}:`, itemError);
                    this.sendLogData(`Warning: Could not delete ${item}: ${itemError instanceof Error ? itemError.message : String(itemError)}\n`);
                }
            }
            
            this.sendLogData(`Cache cleared: ${deletedCount} items deleted\n`);
            
        } catch (error) {
            console.error('[DispatcherManager] Error clearing cache:', error);
            this.sendLogData(`Error clearing cache: ${error instanceof Error ? error.message : String(error)}\n`);
            throw error;
        }
    }

    /**
     * Clean up any stale process references and ensure consistent state
     */
    cleanupStaleReferences(): void {
        if (this.instance.process) {
            if (this.instance.process.killed || this.instance.process.exitCode !== null) {
                console.log('Cleaning up stale process reference');
                this.instance.process = null;
                this.instance.pid = null;
                this.sendStatusUpdate(false);
            }
        }
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
        } else {
            console.warn(`[DispatcherManager] Cannot send status update - mainWindow is ${this.mainWindow ? 'destroyed' : 'null'}`);
        }
    }

    /**
     * Force a status update to be sent to the UI
     */
    forceStatusUpdate(): void {
        this.sendStatusUpdate(this.isDispatcherRunning());
    }

    // Health checking functionality
    async takeScreenshot(): Promise<string> {
        if (!this.isDispatcherRunning()) {
            throw new Error('Dispatcher is not running');
        }

        return this.healthChecker.takeScreenshot('dispatcher', this.instance.port);
    }

    getHealthStatus(): HealthStatus | null {
        return this.healthChecker.getLastHealthStatus('dispatcher');
    }

    async checkHealth(): Promise<HealthStatus> {
        if (!this.isDispatcherRunning()) {
            throw new Error('Dispatcher is not running');
        }

        return this.healthChecker.checkHealth('dispatcher', this.instance.port);
    }

    startHealthChecking(intervalMs = 30000) {
        if (!this.isDispatcherRunning()) {
            console.warn('Cannot start health checking for dispatcher: not running');
            return;
        }

        this.healthChecker.startHealthChecking('dispatcher', this.instance.port, intervalMs);
    }

    stopHealthChecking() {
        this.healthChecker.stopHealthChecking('dispatcher');
    }

    cleanup() {
        this.healthChecker.cleanup();
    }

}