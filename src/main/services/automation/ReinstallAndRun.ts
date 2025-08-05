import { AutoTask } from "./Automation";
import { Project } from "../../../types/Project";
import { Installer } from "../Installer";
import { AutoStartStopService } from "../AutoStartStopService";
import log from 'electron-log';

export class ReinstallAndRun implements AutoTask {

    public project: Project;
    protected startStopService: AutoStartStopService;


    public constructor(project: Project) {
        this.project = project;
        this.startStopService = new AutoStartStopService(project);
    }

    public async run(progressCallback?: (message: string) => void, parameters?: { [key: string]: string | boolean | number }) : Promise<void> {
        const progress = progressCallback || (() => { log.info('Progress callback not provided'); });
        const andStart = parameters?.andStart !== false; // Default to true if not specified
        
        progress('Initiating automated AEM reinstallation process...');
        await this.startStopService.stop();
        
        progress('Removing existing AEM installation and fresh install...');
        await this.reinstall();
        
        if (andStart) {
            progress('Starting AEM author and publisher instances...');
            await this.startStopService.start();
            progress('AEM reinstallation completed successfully - all services are running');
        } else {
            progress('AEM reinstallation completed successfully - instances not started');
        }
    }


    private async reinstall() {
        const installer = new Installer(this.project);
        await installer.reinstall();
    }
    
}