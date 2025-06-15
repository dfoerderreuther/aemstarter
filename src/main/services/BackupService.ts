import { Project } from "../../types/Project";
import path from 'node:path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BackupInfo } from "../../types/BackupInfo";

const execAsync = promisify(exec);

export class BackupService {
    private project: Project;

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
    }

    async backup(tarName: string, compress = true): Promise<void> {
        tarName = this.fixTarName(tarName, compress);
        
        for (const instance of ['author', 'publisher'] as const) {
            await this.compact(instance);
            await this.deleteLogs(instance);
        }
        
        const backupFolderPath = this.getBackupFolder();
        const backupPath = path.join(backupFolderPath, tarName); 

        const paths = this.getBackupPaths();

        const tarCommand = compress ? 'tar -czf' : 'tar -cf';
        const command = `${tarCommand} "${backupPath}" ${paths.join(' ')}`;

        console.log(`[Backup] Starting backup ${backupPath}`);
        console.log(`[Backup] Command: ${command}`);
        await execAsync(command, { cwd: this.project.folderPath });

        console.log(`[Backup] Backup done`);
    }

    private listFiles(): string[] {
        const backupFolderPath = this.getBackupFolder();
        const files = fs.readdirSync(backupFolderPath);
        return files.filter(file => file.endsWith('.tar') || file.endsWith('.tar.gz'));
    }

    async listBackups(): Promise<BackupInfo[]> {
        const backupFiles = this.listFiles();
        const allBackupFiles = backupFiles;
        
        if (allBackupFiles.length === 0) {
            return Promise.all([]);
        }
        
        const backupPath = path.join(this.project.folderPath, 'backup');
        
        const backupInfo = allBackupFiles.map((file) => {
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
            
            return {
                name: file,
                createdDate: createdDate,
                fileSize: fileSize, 
                compressed: file.endsWith('.tar.gz')
            };
        }).sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
        
        return backupInfo;
    }

    private getCleanPaths(): string[] {
        const paths = [];
        paths.push(...BackupService.aemDeleteBeforeRestorePaths.map(p => path.join('author', p)));
        paths.push(...BackupService.aemDeleteBeforeRestorePaths.map(p => path.join('publisher', p)));
        paths.push(...BackupService.dispatcherDeleteBeforeRestorePaths.map(p => path.join('dispatcher', p)));
        return paths;
    }

    async cleanBeforeRestore(): Promise<void> {
        const paths = this.getCleanPaths();
        
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

    async restore(tarName: string): Promise<void> {
        await this.cleanBeforeRestore();
        const backupFolderPath = this.getBackupFolder();
        const backupPath = path.join(backupFolderPath, tarName);

        const tarCommand = tarName.endsWith('.tar.gz') ? 'tar -xzf' : 'tar -xf';

        const command = `${tarCommand} "${backupPath}"`;

        console.log(`[Restore] Starting restore ${backupPath}`);
        console.log(`[Restore] Command: ${command}`);
        await execAsync(command, { cwd: this.project.folderPath });

        console.log(`[Restore] Restore done`);
    }

    async deleteBackup(tarName: string): Promise<void> {
        const backupFolderPath = this.getBackupFolder();
        const backupPath = path.join(backupFolderPath, tarName);
        fs.unlinkSync(backupPath);
    }

    private getBackupPaths(): string[] {
        const paths = [];
        paths.push(...BackupService.aemBackupPaths.map(p => path.join('author', p)));
        paths.push(...BackupService.aemBackupPaths.map(p => path.join('publisher', p)));
        paths.push(...BackupService.dispatcherBackupPaths.map(p => path.join('dispatcher', p)));
        return paths;
    }

    private getBackupFolder(): string {
        const backupFolderPath = path.join(this.project.folderPath, 'backup'); 
        if (!fs.existsSync(backupFolderPath)) {
            fs.mkdirSync(backupFolderPath);
        }
        return backupFolderPath;
    }

    async compact(instance: 'author' | 'publisher'): Promise<void> {
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
}