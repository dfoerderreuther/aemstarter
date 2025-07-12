import { BackupInfo } from "../../../types/BackupInfo";
import { BackupService } from "../BackupService";
import { Project } from "../../../types/Project";
import { AemInstanceManagerRegister } from "../../AemInstanceManagerRegister";
import { DispatcherManagerRegister } from "../../DispatcherManagerRegister";
import { AutoTask } from "./Automation";
import { AemInstanceManager } from "../AemInstanceManager";
import { DispatcherManager } from "../DispatcherManager";
import { HttpsService } from "../HttpsService";
import { HttpsServiceRegister } from "../../HttpsServiceRegister";

export class RestoreLastBackupAndRun implements AutoTask {

    public project: Project;
    protected aemInstanceManager: AemInstanceManager;
    protected dispatcherManager: DispatcherManager;
    protected httpsService: HttpsService;
    protected backupService: BackupService;


    public constructor(project: Project) {
        this.project = project;
        this.aemInstanceManager = AemInstanceManagerRegister.getInstanceManager(this.project);
        this.dispatcherManager = DispatcherManagerRegister.getManager(this.project);
        this.httpsService = HttpsServiceRegister.getService(this.project);
        this.backupService = new BackupService(project)
    }

    public async run(progressCallback?: (message: string) => void) : Promise<void> {
        const progress = progressCallback || (() => { console.log('Progress callback not provided'); });
        
        const lastBackup = await this.findBackup();
        if (lastBackup) {
            progress(`Found backup: "${lastBackup.name}"`);
        } else {
            progress('No backups available to restore');
            return;
        }
        
        progress('Stopping any currently running AEM and Dispatcher instances...');
        await this.stopWhenRunning();
        
        progress(`Restoring backup "${lastBackup.name}" - this may take some time...`);
        await this.restore(lastBackup);
        
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
        if (this.project.settings?.https?.enabled || false) {
            stopPromises.push(this.httpsService.stopSslProxy());
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

    private async restore(backup: BackupInfo) {
        await this.backupService.restore(backup.name);
    }

    protected async start() {
        const startPromises: Promise<void>[] = [];
        startPromises.push(this.aemInstanceManager.startInstance('author', 'start'))
        startPromises.push(this.aemInstanceManager.startInstance('publisher', 'start'))
        startPromises.push(this.dispatcherManager.startDispatcher())
        if (this.project.settings?.https?.enabled || false) {
            startPromises.push(this.httpsService.startSslProxy());
        }
        await Promise.all(startPromises);
    }
}