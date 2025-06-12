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

    public async run() : Promise<void> {
        console.log('[AutomatedReinstall] Running');
        await this.stopWhenRunning();
        console.log('[AutomatedReinstall] Reinstall');
        await this.reinstall();
        console.log('[AutomatedReinstall] Start');
        await this.start();
        console.log('[AutomatedReinstall] Done');
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