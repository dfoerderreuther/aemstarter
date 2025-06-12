import { AutoTask } from "./Automation";
import { Project } from "../../../types/Project";
import { DispatcherManager } from "../DispatcherManager";
import { AemInstanceManager } from "../AemInstanceManager";
import { BackupService } from "../BackupService";
import { AemInstanceManagerRegister } from "../../AemInstanceManagerRegister";
import { DispatcherManagerRegister } from "../../DispatcherManagerRegister";
import { Installer } from "../../installer/Installer";

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
        
        progress('Starting reinstall process...');
        await this.stopWhenRunning();
        
        progress('Deleting existing AEM installation...');
        await this.reinstall();
        
        progress('Starting AEM instances...');
        await this.start();
        
        progress('Reinstall completed successfully');
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