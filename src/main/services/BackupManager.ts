import { Project } from "../../types/Project";
import { BackupInfo } from "../../types/BackupInfo";
import { ProjectSettings } from "./ProjectSettings";
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
        
        if (allBackupFiles.length === 0) {
            return [];
        }
        
        const instancePath = path.join(this.project.folderPath, 'author');
        const backupPath = path.join(instancePath, 'backup');
        
        const backupInfoPromises = allBackupFiles.map(async (file) => {
            const filePath = path.join(backupPath, file);
            const publisherFilePath = filePath.replace('/author/', '/publisher/');
            const dispatcherFilePath = filePath.replace('/author/', '/dispatcher/');
            
            let fileSize = 0;
            let createdDate = new Date();
            
            try {
                const stats = fs.statSync(filePath);
                fileSize += stats.size;
                createdDate = stats.birthtime;
            } catch (error) {
                console.log(`[Backup] Author backup file not found: ${filePath}`);
            }
            
            try {
                const statsPublish = fs.statSync(publisherFilePath);
                fileSize += statsPublish.size;
            } catch (error) {
                console.log(`[Backup] Publisher backup file not found: ${publisherFilePath}`);
            }
            
            try {
                const statsDispatcher = fs.statSync(dispatcherFilePath);
                fileSize += statsDispatcher.size;
            } catch (error) {
                console.log(`[Backup] Dispatcher backup file not found: ${dispatcherFilePath}`);
            }
            
            return {
                name: file.replace('all__', '').replace('.tar.gz', '').replace('.tar', ''),
                createdDate: createdDate,
                fileSize: fileSize, 
                compressed: file.endsWith('.tar.gz')
            };
        });
        
        return Promise.all(backupInfoPromises);
    }

    async listBackups(instance: 'author' | 'publisher' | 'dispatcher'): Promise<string[]> {
        console.log(`[Backup] listing backups for ${instance} instance`);
        const instancePath = path.join(this.project.folderPath, instance);
        const backupPath = path.join(instancePath, 'backup');
        
        if (!fs.existsSync(backupPath)) {
            console.log(`[Backup] Backup directory does not exist: ${backupPath}`);
            return [];
        }
        
        const backupFiles = fs.readdirSync(backupPath);
        return backupFiles;
    }

    private fixTarName(tarName: string, compress: boolean): string {
        return tarName.replace(/[^a-zA-Z0-9 _]/g, '').replace(/ /g, '_') + (compress ? '.tar.gz' : '.tar');
    }


    async backupAll(tarName: string, compress: boolean = true): Promise<void> {
        tarName = "all__" + tarName;
        console.log(`[Backup] Starting backup all for ${tarName}`);
        await Promise.all([
            this.backup('author', tarName, compress),
            this.backup('publisher', tarName, compress),
            this.backup('dispatcher', tarName, compress)
        ]);
    }

    async backup(instance: 'author' | 'publisher' | 'dispatcher', tarName: string, compress: boolean = true): Promise<void> {
        tarName = this.fixTarName(tarName, compress);
        const instancePath = path.join(this.project.folderPath, instance);
        const backupFolderPath = path.join(instancePath, 'backup'); 
        if (!fs.existsSync(backupFolderPath)) {
            fs.mkdirSync(backupFolderPath);
        }
        const backupPath = path.join(backupFolderPath, tarName); 

        const tarCommand = compress ? 'tar -czf' : 'tar -cf';

        if (instance !== 'dispatcher') {
            await this.compact(instance);
            await this.deleteLogs(instance);

            const command = `${tarCommand} "${backupPath}" crx-quickstart`;

            console.log(`[Backup] Starting backup for ${instance} instance`);
            console.log(`[Backup] Command: ${command}`);

            try {
                await execAsync(command, { cwd: instancePath });
                console.log(`[Backup] Backup completed for ${instance} instance`);
            } catch (error) {
                console.error(`[Backup] Backup failed for ${instance} instance:`, error);
                throw error;
            }
        } else {
            const command = `${tarCommand} "${backupPath}" "${ProjectSettings.getSettings(this.project).dispatcher.config}" cache`;

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

    private findTarName(tarName: string, instance: 'author' | 'publisher' | 'dispatcher'): string {
        const searchName = tarName.replace(/ /g, '_');
        const instancePath = path.join(this.project.folderPath, instance);
        const backupFolderPath = path.join(instancePath, 'backup');
        
        if (!fs.existsSync(backupFolderPath)) {
            throw new Error(`Backup folder does not exist: ${backupFolderPath}`);
        }
        
        const backupFiles = fs.readdirSync(backupFolderPath);
        
        // Look for exact matches first (.tar.gz or .tar)
        const exactMatches = backupFiles.filter(file => 
            file === `${searchName}.tar.gz` || file === `${searchName}.tar`
        );
        
        if (exactMatches.length > 0) {
            // Prefer .tar.gz over .tar if both exist
            const preferredFile = exactMatches.find(file => file.endsWith('.tar.gz')) || exactMatches[0];
            return preferredFile;
        }
        
        throw new Error(`Backup file not found for: ${searchName} (looking for ${searchName}.tar or ${searchName}.tar.gz)`);
    }

    async deleteBackupAll(tarName: string): Promise<void> {
        tarName = "all__" + tarName;
        console.log(`[Delete] Starting delete for ${tarName}`);
        await Promise.all([
            this.delete('author', tarName),
            this.delete('publisher', tarName),
            this.delete('dispatcher', tarName)
        ]);
    }
    
    private async delete(instance: 'author' | 'publisher' | 'dispatcher', tarName: string): Promise<void> {
        const actualFileName = this.findTarName(tarName, instance);
        const instancePath = path.join(this.project.folderPath, instance);  
        const backupPath = path.join(instancePath, 'backup', actualFileName);
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            console.log(`[Delete] Deleted backup for ${instance} instance`);
        } else {
            console.log(`[Delete] Backup not found for ${instance} instance`);
        }
    }

    async restore(instance: 'author' | 'publisher' | 'dispatcher', tarName: string): Promise<void> {
        const actualFileName = this.findTarName(tarName, instance);
        const instancePath = path.join(this.project.folderPath, instance);
        const backupPath = path.join(instancePath, 'backup', actualFileName);

        console.log(`[Restore] Starting restore for ${instance} instance`);
        console.log(`[Restore] Found backup file: ${actualFileName}`);


        if (instance !== 'dispatcher') {

            const command = `rm -Rf crx-quickstart`;

            try {
                await execAsync(command, { cwd: instancePath });
            } catch (error) {
                console.error(`[Backup] Backup error:`, error);
                throw error;
            }
        } else {
            const command = `rm -Rf "${ProjectSettings.getSettings(this.project).dispatcher.config}" cache`;
            try {
                await execAsync(command, { cwd: instancePath });
            } catch (error) {
                console.error(`[Backup] Backup error:`, error);
                throw error;
            }
        }

        const tarCommand = actualFileName.endsWith('.tar.gz') ? 'tar -xzf' : 'tar -xf';

        const command = `${tarCommand} "${backupPath}"`;

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