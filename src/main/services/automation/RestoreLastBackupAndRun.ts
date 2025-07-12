import { BackupInfo } from "../../../types/BackupInfo";
import { BackupService } from "../BackupService";
import { Project } from "../../../types/Project";
import { AutoTask } from "./Automation";
import { AutoStartStopService } from "../AutoStartStopService";

export class RestoreLastBackupAndRun implements AutoTask {

    public project: Project;
    protected startStopService: AutoStartStopService;
    protected backupService: BackupService;

    public constructor(project: Project) {
        this.project = project;
        this.startStopService = new AutoStartStopService(project);
        this.backupService = new BackupService(project);
    }

    public async run(progressCallback?: (message: string) => void, parameters?: { [key: string]: string | boolean | number }) : Promise<void> {
        const progress = progressCallback || (() => { console.log('Progress callback not provided'); });
        
        const lastBackup = await this.findBackup();
        if (lastBackup) {
            progress(`Found backup: "${lastBackup.name}"`);
        } else {
            progress('No backups available to restore');
            return;
        }
        
        progress('Stopping any currently running AEM and Dispatcher instances...');
        await this.startStopService.stop();
        
        progress(`Restoring backup "${lastBackup.name}" - this may take some time...`);
        await this.restore(lastBackup);
        
        progress('Starting AEM Author, Publisher, and Dispatcher instances...');
        await this.start();
        
        progress('Automated backup restoration and startup completed successfully!');
    }

    protected async findBackup(): Promise<BackupInfo> {
        const backups = await this.backupService.listBackups();
        if (backups.length === 0) {
            return Promise.reject(new Error('No backup found'));
        }
        return backups[0];
    }

    private async restore(backup: BackupInfo) {
        await this.backupService.restore(backup.name);
    }

    protected async start() {
        await this.startStopService.start();
    }

}