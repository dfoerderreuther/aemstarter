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

        progress('Updating SDK and start');

        const sdkPath = parameters?.sdkPath ? String(parameters.sdkPath) : null

        if (!sdkPath) {
            progress('Error: SDK path is not provided');
            return;
        }

        progress('Stopping AEM instances...');
        await this.startStopService.stop();

        progress('Unpack SDK from: ' + sdkPath);
        const installer = new Installer(this.project);
        await installer.installSdk(sdkPath);

        progress('Removing existing AEM installation and installing new SDK');
        await installer.reinstall();
        
        progress('Starting all instances...');
        await this.startStopService.start();
        
        progress('AEM SDK update completed successfully - all services are running');

        progress('Done');
    }
}