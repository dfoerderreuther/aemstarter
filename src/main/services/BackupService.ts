import { Project } from "../../types/Project";
import path from 'node:path';
import fs from 'fs';
import { BackupInfo } from "../../types/BackupInfo";
import { enhancedExecAsync as execAsync } from '../enhancedExecAsync';
import { AutoStartStopService } from './AutoStartStopService';
import { AemInstanceManagerRegister } from '../AemInstanceManagerRegister';
import { DispatcherManagerRegister } from '../DispatcherManagerRegister';
import { HttpsServiceRegister } from '../HttpsServiceRegister';
import { AemInstanceManager } from './AemInstanceManager';
import { DispatcherManager } from './DispatcherManager';
import { HttpsService } from './HttpsService';

export class BackupService {
    private project: Project;
    private autoStartStopService: AutoStartStopService;
    private aemInstanceManager: AemInstanceManager;
    private dispatcherManager: DispatcherManager;
    private httpsService: HttpsService;

    private static aemBackupPaths = [
        'crx-quickstart'
    ]

    private static dispatcherBackupPaths = [
        'cache', 
        'config'
    ]

    private static aemDeleteBeforeRestorePaths = []

    private static dispatcherDeleteBeforeRestorePaths = [
        'cache', 
        'config'
    ]

    constructor(project: Project) {
        this.project = project;
        this.autoStartStopService = new AutoStartStopService(project);
        this.aemInstanceManager = AemInstanceManagerRegister.getInstanceManager(project);
        this.dispatcherManager = DispatcherManagerRegister.getManager(project);
        this.httpsService = HttpsServiceRegister.getService(project);
    }

    public async backup(tarName: string, compress = true, description?: string, selectedInstances?: { author: boolean; publisher: boolean; dispatcher: boolean }): Promise<void> {
        tarName = this.fixTarName(tarName, compress);
        
        // Default to all instances if not specified (backwards compatibility)
        const instances = selectedInstances || { author: true, publisher: true, dispatcher: true };
        
        // Check which instances are currently running
        const wasAuthorRunning = instances.author && this.aemInstanceManager.isInstanceRunning('author');
        const wasPublisherRunning = instances.publisher && this.aemInstanceManager.isInstanceRunning('publisher');
        const wasDispatcherRunning = instances.dispatcher && this.dispatcherManager.isDispatcherRunning();
        
        try {
            // Stop running instances that will be backed up
            const stopPromises: Promise<void>[] = [];
            if (wasAuthorRunning) {
                stopPromises.push(this.aemInstanceManager.stopInstance('author'));
            }
            if (wasPublisherRunning) {
                stopPromises.push(this.aemInstanceManager.stopInstance('publisher'));
            }
            if (wasDispatcherRunning) {
                stopPromises.push(this.dispatcherManager.stopDispatcher());
            }
            if (instances.author || instances.publisher || instances.dispatcher) {
                if (this.project.settings?.https?.enabled) {
                    stopPromises.push(this.httpsService.stopSslProxy());
                }
            }
            
            if (stopPromises.length > 0) {
                console.log('[Backup] Stopping instances before backup...');
                await Promise.all(stopPromises);
                // Wait a bit for processes to fully stop
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Compact and delete logs only for selected AEM instances
            for (const instance of ['author', 'publisher'] as const) {
                if (instances[instance]) {
                    await this.compact(instance);
                    await this.deleteLogs(instance);
                }
            }
            
            const backupFolderPath = this.getBackupFolder();
            const backupPath = path.join(backupFolderPath, tarName); 

            const paths = this.getBackupPaths(instances);

            const tarCommand = compress ? 'tar -czf' : 'tar -cf';
            const command = `${tarCommand} "${backupPath}" ${paths.join(' ')}`;

            console.log(`[Backup] Starting backup ${backupPath}`);
            console.log(`[Backup] Command: ${command}`);
            await execAsync(command, { cwd: this.project.folderPath });

            // Create metadata JSON file
            await this.createBackupMetadata(tarName, description, instances, compress);

            console.log(`[Backup] Backup done`);
        } finally {
            // Restart instances that were running before backup
            const startPromises: Promise<void>[] = [];
            if (wasAuthorRunning) {
                startPromises.push(this.aemInstanceManager.startInstance('author', 'start'));
            }
            if (wasPublisherRunning) {
                startPromises.push(this.aemInstanceManager.startInstance('publisher', 'start'));
            }
            
            if (startPromises.length > 0) {
                console.log('[Backup] Restarting instances after backup...');
                await Promise.all(startPromises);
                
                // Wait for AEM instances to start before starting dispatcher and SSL
                if (wasPublisherRunning) {
                    const maxWaitTime = 10 * 60 * 1000; // 10 minutes
                    const checkInterval = 2000; // 2 seconds
                    const startTime = Date.now();

                    while (Date.now() - startTime < maxWaitTime) {
                        if (await this.isAEMRunning('publisher')) {
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, checkInterval));
                    }
                }
                
                const additionalStartPromises: Promise<void>[] = [];
                if (wasDispatcherRunning && !this.dispatcherManager.isDispatcherRunning()) {
                    additionalStartPromises.push(this.dispatcherManager.startDispatcher());
                }
                if (this.project.settings?.https?.enabled && (wasAuthorRunning || wasPublisherRunning || wasDispatcherRunning)) {
                    additionalStartPromises.push(this.httpsService.startSslProxy());
                }
                
                if (additionalStartPromises.length > 0) {
                    await Promise.all(additionalStartPromises);
                }
            }
        }
    }

    public async restore(tarName: string): Promise<void> {
        // Load metadata to determine which instances to restore
        const metadata = await this.loadBackupMetadata(tarName);
        const instances = metadata?.selectedInstances || { author: true, publisher: true, dispatcher: true };
        
        // Check which instances are currently running
        const wasAuthorRunning = instances.author && this.aemInstanceManager.isInstanceRunning('author');
        const wasPublisherRunning = instances.publisher && this.aemInstanceManager.isInstanceRunning('publisher');
        const wasDispatcherRunning = instances.dispatcher && this.dispatcherManager.isDispatcherRunning();
        
        try {
            // Stop running instances that will be restored
            const stopPromises: Promise<void>[] = [];
            if (wasAuthorRunning) {
                stopPromises.push(this.aemInstanceManager.stopInstance('author'));
            }
            if (wasPublisherRunning) {
                stopPromises.push(this.aemInstanceManager.stopInstance('publisher'));
            }
            if (wasDispatcherRunning) {
                stopPromises.push(this.dispatcherManager.stopDispatcher());
            }
            if (instances.author || instances.publisher || instances.dispatcher) {
                if (this.project.settings?.https?.enabled) {
                    stopPromises.push(this.httpsService.stopSslProxy());
                }
            }
            
            if (stopPromises.length > 0) {
                console.log('[Restore] Stopping instances before restore...');
                await Promise.all(stopPromises);
                // Wait a bit for processes to fully stop
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            await this.cleanBeforeRestore(instances);
            const backupFolderPath = this.getBackupFolder();
            const backupPath = path.join(backupFolderPath, tarName);

            const tarCommand = tarName.endsWith('.tar.gz') ? 'tar -xzf' : 'tar -xf';

            const command = `${tarCommand} "${backupPath}"`;

            console.log(`[Restore] Starting restore ${backupPath}`);
            console.log(`[Restore] Command: ${command}`);
            await execAsync(command, { cwd: this.project.folderPath });

            console.log(`[Restore] Restore done`);
        } finally {
            // Restart instances that were running before restore
            const startPromises: Promise<void>[] = [];
            if (wasAuthorRunning) {
                startPromises.push(this.aemInstanceManager.startInstance('author', 'start'));
            }
            if (wasPublisherRunning) {
                startPromises.push(this.aemInstanceManager.startInstance('publisher', 'start'));
            }
            
            if (startPromises.length > 0) {
                console.log('[Restore] Restarting instances after restore...');
                await Promise.all(startPromises);
                
                // Wait for AEM instances to start before starting dispatcher and SSL
                if (wasPublisherRunning) {
                    const maxWaitTime = 10 * 60 * 1000; // 10 minutes
                    const checkInterval = 2000; // 2 seconds
                    const startTime = Date.now();

                    while (Date.now() - startTime < maxWaitTime) {
                        if (await this.isAEMRunning('publisher')) {
                            break;
                        }
                        await new Promise(resolve => setTimeout(resolve, checkInterval));
                    }
                }
                
                const additionalStartPromises: Promise<void>[] = [];
                if (wasDispatcherRunning && !this.dispatcherManager.isDispatcherRunning()) {
                    additionalStartPromises.push(this.dispatcherManager.startDispatcher());
                }
                if (this.project.settings?.https?.enabled && (wasAuthorRunning || wasPublisherRunning || wasDispatcherRunning)) {
                    additionalStartPromises.push(this.httpsService.startSslProxy());
                }
                
                if (additionalStartPromises.length > 0) {
                    await Promise.all(additionalStartPromises);
                }
            }
        }
    }

    public async deleteBackup(tarName: string): Promise<void> {
        const backupFolderPath = this.getBackupFolder();
        const backupPath = path.join(backupFolderPath, tarName);
        const metadataPath = path.join(backupFolderPath, tarName + '.json');
        
        // Delete the backup file
        fs.unlinkSync(backupPath);
        
        // Delete the metadata file if it exists
        try {
            if (fs.existsSync(metadataPath)) {
                fs.unlinkSync(metadataPath);
                console.log(`[Backup] Metadata deleted: ${metadataPath}`);
            }
        } catch (error) {
            console.log(`[Backup] Could not delete metadata file: ${error}`);
        }
    }

    public async listBackups(): Promise<BackupInfo[]> {
        const backupFiles = this.listFiles();
        const allBackupFiles = backupFiles;
        
        if (allBackupFiles.length === 0) {
            return Promise.all([]);
        }
        
        const backupPath = path.join(this.project.folderPath, 'backup');
        
        const backupInfo = await Promise.all(allBackupFiles.map(async (file) => {
            const filePath = path.join(backupPath, file);
            
            let fileSize = 0;
            let createdDate = new Date();
            
            try {
                const stats = fs.statSync(filePath);
                fileSize += stats.size;
                createdDate = stats.birthtime;
            } catch (error) {
                console.log(`[Backup] backup file not found: ${filePath}`);
            }
            
            // Load metadata
            const metadata = await this.loadBackupMetadata(file);
            
            return {
                name: file,
                createdDate: createdDate,
                fileSize: fileSize, 
                compressed: file.endsWith('.tar.gz'),
                description: metadata?.description,
                selectedInstances: metadata?.selectedInstances
            };
        }));
        
        return backupInfo.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
    }

    private listFiles(): string[] {
        const backupFolderPath = this.getBackupFolder();
        const files = fs.readdirSync(backupFolderPath);
        return files.filter(file => file.endsWith('.tar') || file.endsWith('.tar.gz'));
    }

    private getCleanPaths(instances: { author: boolean; publisher: boolean; dispatcher: boolean }): string[] {
        const paths = [];
        if (instances.author) {
            paths.push(...BackupService.aemDeleteBeforeRestorePaths.map(p => path.join('author', p)));
        }
        if (instances.publisher) {
            paths.push(...BackupService.aemDeleteBeforeRestorePaths.map(p => path.join('publisher', p)));
        }
        if (instances.dispatcher) {
            paths.push(...BackupService.dispatcherDeleteBeforeRestorePaths.map(p => path.join('dispatcher', p)));
        }
        return paths;
    }

    private async cleanBeforeRestore(instances: { author: boolean; publisher: boolean; dispatcher: boolean }): Promise<void> {
        const paths = this.getCleanPaths(instances);
        
        for (const relativePath of paths) {
            const fullPath = path.join(this.project.folderPath, relativePath);
            
            try {
                if (fs.existsSync(fullPath)) {
                    const stats = fs.statSync(fullPath);
                    if (stats.isDirectory()) {
                        console.log(`[Clean] Deleting directory: ${fullPath}`);
                        await this.deleteDirectory(fullPath);
                    } else {
                        console.log(`[Clean] Deleting file: ${fullPath}`);
                        fs.unlinkSync(fullPath);
                    }
                } else {
                    console.log(`[Clean] Path does not exist, skipping: ${fullPath}`);
                }
            } catch (error) {
                console.error(`[Clean] Error deleting path ${fullPath}:`, error);
            }
        }
    }

    private async deleteDirectory(dirPath: string): Promise<void> {
        try {
            await fs.promises.rm(dirPath, { recursive: true, force: true });
        } catch (error) {
            console.error(`[Clean] Error deleting directory ${dirPath}:`, error);
            throw error;
        }
    }



    private getBackupPaths(instances: { author: boolean; publisher: boolean; dispatcher: boolean }): string[] {
        const paths = [];
        if (instances.author) {
            paths.push(...BackupService.aemBackupPaths.map(p => path.join('author', p)));
        }
        if (instances.publisher) {
            paths.push(...BackupService.aemBackupPaths.map(p => path.join('publisher', p)));
        }
        if (instances.dispatcher) {
            paths.push(...BackupService.dispatcherBackupPaths.map(p => path.join('dispatcher', p)));
        }
        return paths;
    }

    private getBackupFolder(): string {
        const backupFolderPath = path.join(this.project.folderPath, 'backup'); 
        if (!fs.existsSync(backupFolderPath)) {
            fs.mkdirSync(backupFolderPath);
        }
        return backupFolderPath;
    }

    public async compact(instance: 'author' | 'publisher'): Promise<void> {
        const instancePath = path.join(this.project.folderPath, instance);
        const oakRunJar = path.join(instancePath, 'oak-run.jar');

        if (!fs.existsSync(oakRunJar)) {
            console.log(`[OakRun] Oak run jar not found: ${oakRunJar}`);
            return;
        }

        const segmentStorePath = path.join(instancePath, 'crx-quickstart', 'repository', 'segmentstore');
        const logPath = path.join(instancePath, 'crx-quickstart', 'logs', 'oak-run-compact.log');
        
        const command = `java -Xss16m -Xmx8g -jar "${oakRunJar}" compact "${segmentStorePath}" > "${logPath}" 2>&1`;
        
        console.log(`[OakRun] Starting compaction for ${instance} instance`);
        console.log(`[OakRun] Command: ${command}`);
        
        try {
            await execAsync(command, { cwd: this.project.folderPath });
            console.log(`[OakRun] Compaction completed for ${instance} instance`);
        } catch (error) {
            console.error(`[OakRun] Compaction failed for ${instance} instance:`, error);
            throw error;
        }
    }

    private fixTarName(tarName: string, compress: boolean): string {
        return tarName.replace(/[^a-zA-Z0-9 _]/g, '').replace(/ /g, '_') + (compress ? '.tar.gz' : '.tar');
    }

    private async deleteLogs(instance: 'author' | 'publisher'): Promise<void> {
        const instancePath = path.join(this.project.folderPath, instance);
        const logsPath = path.join(instancePath, 'crx-quickstart', 'logs');
        const logFiles = fs.readdirSync(logsPath);
        logFiles.forEach(file => {
            try {
                fs.unlinkSync(path.join(logsPath, file));
            } catch (error) {
                console.error(`[Backup] Error deleting log file ${file}:`, error);
            }
        });
    }

    private async createBackupMetadata(tarName: string, description?: string, selectedInstances?: { author: boolean; publisher: boolean; dispatcher: boolean }, compressed?: boolean): Promise<void> {
        const backupFolderPath = this.getBackupFolder();
        const metadataPath = path.join(backupFolderPath, tarName + '.json');
        
        const metadata = {
            name: tarName,
            description: description || '',
            selectedInstances: selectedInstances || { author: true, publisher: true, dispatcher: true },
            compressed: compressed || false,
            createdDate: new Date().toISOString()
        };
        
        try {
            await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
            console.log(`[Backup] Metadata created: ${metadataPath}`);
        } catch (error) {
            console.error(`[Backup] Error creating metadata: ${error}`);
        }
    }

    private async loadBackupMetadata(tarName: string): Promise<{ description?: string; selectedInstances?: { author: boolean; publisher: boolean; dispatcher: boolean } } | null> {
        const backupFolderPath = this.getBackupFolder();
        const metadataPath = path.join(backupFolderPath, tarName + '.json');
        
        try {
            if (fs.existsSync(metadataPath)) {
                const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8');
                return JSON.parse(metadataContent);
            }
        } catch (error) {
            console.log(`[Backup] Could not load metadata for ${tarName}: ${error}`);
        }
        
        return null; // Backwards compatibility - assume all instances selected
    }

    private async isAEMRunning(instanceType: 'author' | 'publisher'): Promise<boolean> {
        if (!this.aemInstanceManager.isInstanceRunning(instanceType)) return false;

        const port = instanceType === 'author' ? this.project.settings.author.port : this.project.settings.publisher.port;
        try {
            const response = await fetch(`http://localhost:${port}/libs/granite/core/content/login.html`, {
                method: 'HEAD'
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
}