import { BackupInfo } from "../../../types/BackupInfo";
import { BackupService } from "../BackupService";
import { Project } from "../../../types/Project";
import { AutoTask } from "./Automation";
import { AutoStartStopService } from "../AutoStartStopService";

export class CreateBackupAndRun implements AutoTask {

    public project: Project;
    protected startStopService: AutoStartStopService;
    protected backupService: BackupService;

    public constructor(project: Project) {
        this.project = project;
        this.startStopService = new AutoStartStopService(project);
        this.backupService = new BackupService(project)
    }

    public async run(progressCallback?: (message: string) => void, parameters?: { [key: string]: string | boolean | number }) : Promise<void> {
        const progress = progressCallback || (() => { console.log('Progress callback not provided'); });
        
        progress('Stopping any currently running AEM and Dispatcher instances...');
        await this.startStopService.stop();

        const backupName = parameters?.backupName ? String(parameters.backupName) : 'backup ' + new Date().toISOString().replace(/[:.]/g, '-');
        progress(`Create backup "${backupName}" - this may take some time...`);
        await this.backupService.backup(backupName);
        
        progress('Starting AEM Author, Publisher, and Dispatcher instances...');
        await this.startStopService.start();
        progress('Automated backup restoration and startup completed successfully!');
    }

    protected async findBackup(): Promise<BackupInfo> {
        const backups = await this.backupService.listBackups();
        if (backups.length === 0) {
            return Promise.reject(new Error('No backup found'));
        }
        return backups[0];
    }

}