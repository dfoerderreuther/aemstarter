import { AutoTask } from "./Automation";
import { Project } from "../../../types/Project";
import { DispatcherManager } from "../DispatcherManager";
import { AemInstanceManager } from "../AemInstanceManager";
import { BackupService } from "../BackupService";
import { AemInstanceManagerRegister } from "../../AemInstanceManagerRegister";
import { DispatcherManagerRegister } from "../../DispatcherManagerRegister";
import { Installer } from "../Installer";
import { HttpsService } from "../HttpsService";
import { HttpsServiceRegister } from "../../HttpsServiceRegister";

export class ReinstallAndRun implements AutoTask {

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
        
        progress('Initiating automated AEM reinstallation process...');
        await this.stopWhenRunning();
        
        progress('Removing existing AEM installation and preparing for fresh install...');
        await this.reinstall();
        
        progress('Starting AEM author and publisher instances...');
        await this.start();
        
        progress('AEM reinstallation completed successfully - all services are running');
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
    
    private async reinstall() {
        const installer = new Installer(this.project);
        await installer.reinstall();
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