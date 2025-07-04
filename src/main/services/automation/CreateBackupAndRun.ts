import { BackupInfo } from "../../../types/BackupInfo";
import { BackupService } from "../BackupService";
import { Project } from "../../../types/Project";
import { AemInstanceManagerRegister } from "../../AemInstanceManagerRegister";
import { DispatcherManagerRegister } from "../../DispatcherManagerRegister";
import { AutoTask } from "./Automation";
import { AemInstanceManager } from "../AemInstanceManager";
import { DispatcherManager } from "../DispatcherManager";

export class CreateBackupAndRun implements AutoTask {

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
        const progress = progressCallback || (() => { console.log('Progress callback not provided'); });
        

        
        progress('Stopping any currently running AEM and Dispatcher instances...');
        await this.stopWhenRunning();

        const backupName = 'backup ' + new Date().toISOString().replace(/[:.]/g, '-');
        progress(`Create backup "${backupName}" - this may take some time...`);
        await this.backupService.backup(backupName);
        
        progress('Starting AEM Author, Publisher, and Dispatcher instances...');
        await this.start();
        
        progress('Automated backup restoration and startup completed successfully!');
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

    protected async findBackup(): Promise<BackupInfo> {
        const backups = await this.backupService.listBackups();
        if (backups.length === 0) {
            return Promise.reject(new Error('No backup found'));
        }
        return backups[0];
    }


    protected async start() {
        const startPromises: Promise<void>[] = [];
        startPromises.push(this.aemInstanceManager.startInstance('author', 'start'))
        startPromises.push(this.aemInstanceManager.startInstance('publisher', 'start'))
        startPromises.push(this.dispatcherManager.startDispatcher())
        await Promise.all(startPromises);
    }
}