import { Project } from "../../types/Project";
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
            fs.unlinkSync(path.join(logsPath, file));
        });
    }

    async listBackupsAll(): Promise<string[]> {
        const backupFiles = await this.listBackups('author');
        return backupFiles.filter(file => file.startsWith('all__'));
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

            const command = `tar -cf "${backupPath}" "${instancePath}/crx-quickstart/repository"`;

            console.log(`[Backup] Starting backup for ${instance} instance`);
            console.log(`[Backup] Command: ${command}`);

            try {
                await execAsync(command, { cwd: this.project.folderPath });
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
        if (instance !== 'dispatcher') {  
            const instancePath = path.join(this.project.folderPath, instance);
            const backupPath = path.join(instancePath, 'backup', tarName);

            const command = `tar -xf "${backupPath}" -C "${instancePath}/crx-quickstart/repository"`;

            console.log(`[Restore] Starting restore for ${instance} instance`);
            console.log(`[Restore] Command: ${command}`);
        }
    }
}