import { AutoTask } from "./Automation";
import { Project } from "../../../types/Project";
import { BackupService } from "../BackupService";
import { Installer } from "../Installer";
import { AutoStartStopService } from "../AutoStartStopService";

export class ReinstallAndRun implements AutoTask {

    public project: Project;
    protected startStopService: AutoStartStopService;
    protected backupService: BackupService;


    public constructor(project: Project) {
        this.project = project;
        this.startStopService = new AutoStartStopService(project);
        this.backupService = new BackupService(project)
    }

    public async run(progressCallback?: (message: string) => void) : Promise<void> {
        const progress = progressCallback || (() => { console.log('Progress callback not provided'); });
        
        progress('Initiating automated AEM reinstallation process...');
        await this.startStopService.stop();
        
        progress('Removing existing AEM installation and preparing for fresh install...');
        await this.reinstall();
        
        progress('Starting AEM author and publisher instances...');
        await this.startStopService.start();
        
        progress('AEM reinstallation completed successfully - all services are running');
    }


    private async reinstall() {
        const installer = new Installer(this.project);
        await installer.reinstall();
    }
    
}