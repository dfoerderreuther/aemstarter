import { Project } from "../../types/Project";
import { BackupInfo } from "../../types/BackupInfo";
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export class BackupManager {
    private project: Project;

    constructor(project: Project) {
        this.project = project;
    }

    async compact(instance: 'author' | 'publisher'): Promise<void> {
        const instancePath = path.join(this.project.folderPath, instance);
        const oakRunJar = path.join(instancePath, 'oak-run.jar');
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

    async listBackupsAll(): Promise<BackupInfo[]> {
        const backupFiles = await this.listBackups('author');
        const allBackupFiles = backupFiles.filter(file => file.startsWith('all__'));
        
        const instancePath = path.join(this.project.folderPath, 'author');
        const backupPath = path.join(instancePath, 'backup');
        
        const backupInfoPromises = allBackupFiles.map(async (file) => {
            const filePath = path.join(backupPath, file);
            const stats = fs.statSync(filePath);
            
            return {
                name: file.replace('all__', '').replace('.tar', ''),
                createdDate: stats.birthtime,
                fileSize: stats.size
            };
        });
        
        return Promise.all(backupInfoPromises);
    }

    async listBackups(instance: 'author' | 'publisher' | 'dispatcher'): Promise<string[]> {
        console.log(`[Backup] listing backups for ${instance} instance`);
        const instancePath = path.join(this.project.folderPath, instance);
        const backupPath = path.join(instancePath, 'backup');
        const backupFiles = fs.readdirSync(backupPath);
        return backupFiles;
    }

    private fixTarName(tarName: string): string {
        return tarName.replace(/ /g, '_') + '.tar';
    }

    async backupAll(tarName: string): Promise<void> {
        tarName = "all__" + tarName;
        console.log(`[Backup] Starting backup all for ${tarName}`);
        await Promise.all([
            this.backup('author', tarName),
            this.backup('publisher', tarName),
            this.backup('dispatcher', tarName)
        ]);
    }

    async backup(instance: 'author' | 'publisher' | 'dispatcher', tarName: string): Promise<void> {
        tarName = this.fixTarName(tarName);
        if (instance !== 'dispatcher') {
            await this.compact(instance);
            await this.deleteLogs(instance);

            const instancePath = path.join(this.project.folderPath, instance);
            const backupFolderPath = path.join(instancePath, 'backup'); 
            if (!fs.existsSync(backupFolderPath)) {
                fs.mkdirSync(backupFolderPath);
            }
            const backupPath = path.join(backupFolderPath, tarName); 

            const command = `tar -cf "${backupPath}" crx-quickstart`;

            console.log(`[Backup] Starting backup for ${instance} instance`);
            console.log(`[Backup] Command: ${command}`);

            try {
                await execAsync(command, { cwd: instancePath });
                console.log(`[Backup] Backup completed for ${instance} instance`);
            } catch (error) {
                console.error(`[Backup] Backup failed for ${instance} instance:`, error);
                throw error;
            }
        }
    }

    async restoreAll(tarName: string): Promise<void> {
        tarName = "all__" + tarName;
        console.log(`[Restore] Starting restore all for ${tarName}`);
        await Promise.all([
            this.restore('author', tarName),
            this.restore('publisher', tarName),
            this.restore('dispatcher', tarName)
        ]);
    }

    async restore(instance: 'author' | 'publisher' | 'dispatcher', tarName: string): Promise<void> {
        tarName = this.fixTarName(tarName);
        console.log(`[Restore] Starting restore for ${instance} instance`);
        if (instance !== 'dispatcher') {  
            const instancePath = path.join(this.project.folderPath, instance);
            const backupPath = path.join(instancePath, 'backup', tarName);

            const command = `tar -xf "${backupPath}"`;

            console.log(`[Restore] Command: ${command}`);
            console.log(`[Restore] Instance path: ${instancePath}`);

            try {
                await execAsync(command, { cwd: instancePath });
                console.log(`[Restore] Restore completed for ${instance} instance`);
            } catch (error) {
                console.error(`[Restore] Restore failed for ${instance} instance:`, error);
                throw error;
            }
        }
    }
}