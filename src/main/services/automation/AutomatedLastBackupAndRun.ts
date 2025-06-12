import { BackupInfo } from "../../../types/BackupInfo";
import { BackupService } from "../BackupService";
import { Project } from "../../../types/Project";
import { AemInstanceManagerRegister } from "../../AemInstanceManagerRegister";
import { DispatcherManagerRegister } from "../../DispatcherManagerRegister";
import { AutoTask } from "./Automation";
import { AemInstanceManager } from "../AemInstanceManager";
import { DispatcherManager } from "../DispatcherManager";

export class AutomatedLastBackupAndRun implements AutoTask {

    public project: Project;
    protected aemInstanceManager: AemInstanceManager;
    protected dispatcherManager: DispatcherManager;
    protected backupService: BackupService;


    public constructor(project: Project) {
        this.project = project;
        this.aemInstanceManager = AemInstanceManagerRegister.getInstanceManager(this.project);
        this.dispatcherManager = DispatcherManagerRegister.getManager(this.project);
        this.backupService = new BackupService(project)
    }

    public async run(progressCallback?: (message: string) => void) : Promise<void> {
        const progress = progressCallback || (() => {});
        
        progress('Finding last backup...');
        const lastBackup = await this.findLastBackup();
        if (lastBackup) {
            progress(`Last backup found: ${lastBackup.name}`);
        } else {
            progress('No backup found');
            return;
        }
        
        progress('Stopping running instances...');
        await this.stopWhenRunning();
        
        progress(`Restoring backup: ${lastBackup.name}...`);
        await this.restore(lastBackup);
        
        progress('Starting instances...');
        await this.start();
        
        progress('Automation completed successfully');
    }

    private async stopWhenRunning() {
        const stopPromises: Promise<void>[] = [];
        
        if (this.aemInstanceManager.isInstanceRunning('author')) {
            stopPromises.push(this.aemInstanceManager.stopInstance('author'));
        }
        if (this.aemInstanceManager.isInstanceRunning('publisher')) {
            stopPromises.push(this.aemInstanceManager.stopInstance('publisher'));
        }
        if (this.dispatcherManager.isDispatcherRunning()) {
            stopPromises.push(this.dispatcherManager.stopDispatcher());
        }
        await Promise.all(stopPromises);
    }

    private async findLastBackup(): Promise<BackupInfo> {
        const backups = await this.backupService.listBackups();
        if (backups.length === 0) {
            return Promise.reject(new Error('No backup found'));
        }
        return backups[backups.length - 1];
    }

    private async restore(backup: BackupInfo) {
        await this.backupService.restore(backup.name);
    }

    protected async start() {
        const startPromises: Promise<void>[] = [];
        startPromises.push(this.aemInstanceManager.startInstance('author', 'start'))
        startPromises.push(this.aemInstanceManager.startInstance('publisher', 'start'))
        startPromises.push(this.dispatcherManager.startDispatcher())
        await Promise.all(startPromises);
    }
}