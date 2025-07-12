import { Project } from "../../../types/Project";
import { Installer } from "../Installer";
import { AutoTask } from "./Automation";
import { AutoStartStopService } from "../AutoStartStopService";


export class UpdateSdkAndRun implements AutoTask {

    public project: Project;
    protected startStopService: AutoStartStopService;

    public constructor(project: Project) {
        this.project = project;
        this.startStopService = new AutoStartStopService(project);
    }

    public async run(progressCallback?: (message: string) => void, parameters?: { [key: string]: string | boolean | number }) : Promise<void> {
        const progress = progressCallback || (() => { console.log('Progress callback not provided'); });

        progress('Updating SDK and running');

        const sdkPath = parameters?.sdkPath ? String(parameters.sdkPath) : null

        if (!sdkPath) {
            progress('Error: SDK path is not provided');
            return;
        }

        progress('Initiating automated AEM reinstallation process...');
        await this.startStopService.stop();

        progress('Installing SDK from: ' + sdkPath);

        const installer = new Installer(this.project);

        progress('Updating SDK');
        await installer.installSdk(sdkPath);

        progress('Removing existing AEM installation and preparing for fresh install...');
        await installer.reinstall();
        
        progress('Starting AEM author and publisher instances...');
        await this.startStopService.start();
        
        progress('AEM reinstallation completed successfully - all services are running');

        progress('Done');
    }
}