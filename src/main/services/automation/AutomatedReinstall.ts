import { AutoTask } from "./Automation";
import { Project } from "../../../types/Project";
import { DispatcherManager } from "../DispatcherManager";
import { AemInstanceManager } from "../AemInstanceManager";
import { BackupService } from "../BackupService";
import { AemInstanceManagerRegister } from "../../AemInstanceManagerRegister";
import { DispatcherManagerRegister } from "../../DispatcherManagerRegister";
import { Installer } from "../Installer";

export class AutomatedReinstall implements AutoTask {

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
        await Promise.all(stopPromises);
    }
    
    private async reinstall() {
        const installer = new Installer(this.project);
        await installer.delete();
        await installer.install();
    }
    
    protected async start() {
        await this.aemInstanceManager.startInstance('author', 'start')
        await this.aemInstanceManager.startInstance('publisher', 'start')
        await this.dispatcherManager.startDispatcher()
    }
    
}