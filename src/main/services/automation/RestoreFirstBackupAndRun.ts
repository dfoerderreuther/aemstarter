import { BackupInfo } from "../../../types/BackupInfo";
import { RestoreLastBackupAndRun } from "./RestoreLastBackupAndRun";


export class RestoreFirstBackupAndRun extends RestoreLastBackupAndRun {

    protected async findBackup(): Promise<BackupInfo> {
        const backups = await this.backupService.listBackups();
        if (backups.length === 0) {
            return Promise.reject(new Error('No backup found'));
        }
        return backups[backups.length - 1];
    }
}