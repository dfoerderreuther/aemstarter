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
    private aemInstanceManager: AemInstanceManager;
    private dispatcherManager: DispatcherManager;
    private backupService: BackupService;


    public constructor(project: Project) {
        this.project = project;
        this.aemInstanceManager = AemInstanceManagerRegister.getInstanceManager(this.project);
        this.dispatcherManager = DispatcherManagerRegister.getManager(this.project);
        this.backupService = new BackupService(project)

    }

    public async run() : Promise<void> {
        // Implementation will go here
        const lastBackup = await this.findLastBackup();
        if (lastBackup) {
            console.log(`Last backup found: ${lastBackup.name}`);
        } else {
            console.log('No backup found');
            return;
        }
        console.log('[AutomatedLastBackupAndRun] stop')
        await this.stopWhenRunning();
        console.log('[AutomatedLastBackupAndRun] restore')
        await this.restore(lastBackup);
        console.log('[AutomatedLastBackupAndRun] start')
        await this.start()
        console.log('[AutomatedLastBackupAndRun] done')

    }

    private async stopWhenRunning() {
        if (this.aemInstanceManager.isInstanceRunning('author')) {
            await this.aemInstanceManager.stopInstance('author');
        }
        if (this.aemInstanceManager.isInstanceRunning('publisher')) {
            await this.aemInstanceManager.stopInstance('publisher');
        }
        if (this.dispatcherManager.isDispatcherRunning()) {
            await this.dispatcherManager.stopDispatcher();
        }
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

    private async start() {
        await this.aemInstanceManager.startInstance('author', 'start')
        await this.aemInstanceManager.startInstance('publisher', 'start')
        await this.dispatcherManager.startDispatcher()
    }
}