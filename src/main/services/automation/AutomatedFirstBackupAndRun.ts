import { BackupInfo } from "../../../types/BackupInfo";
import { AutomatedLastBackupAndRun } from "./AutomatedLastBackupAndRun";


export class AutomatedFirstBackupAndRun extends AutomatedLastBackupAndRun {

    protected async findBackup(): Promise<BackupInfo> {
        const backups = await this.backupService.listBackups();
        if (backups.length === 0) {
            return Promise.reject(new Error('No backup found'));
        }
        return backups[backups.length - 1];
    }
}