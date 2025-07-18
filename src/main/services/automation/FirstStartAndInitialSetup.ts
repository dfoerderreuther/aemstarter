import { AutoTask } from "./Automation";
import { Project } from "../../../types/Project";
import * as fs from 'fs';
import * as path from 'path';
import { DispatcherManager } from "../DispatcherManager";
import { AemInstanceManager } from "../AemInstanceManager";
import { AemInstanceManagerRegister } from "../../AemInstanceManagerRegister";
import { DispatcherManagerRegister } from "../../DispatcherManagerRegister";
import { ReplicationSettings } from "../ReplicationSettings";
import { PackageInstaller } from "../PackageInstaller";
import { PackageManager } from "../PackageManager";
import { AutoStartStopService } from "../AutoStartStopService";

export class FirstStartAndInitialSetup implements AutoTask {

    public project: Project;
    protected aemInstanceManager: AemInstanceManager;
    protected dispatcherManager: DispatcherManager;
    protected startStopService: AutoStartStopService;

    public constructor(project: Project) {
        this.project = project;
        this.aemInstanceManager = AemInstanceManagerRegister.getInstanceManager(this.project);
        this.dispatcherManager = DispatcherManagerRegister.getManager(this.project);
        this.startStopService = new AutoStartStopService(project);
    }

    public async run(progressCallback?: (message: string) => void, parameters?: { [key: string]: string | boolean | number }) : Promise<void> {
        const progress = progressCallback || (() => { console.log('Progress callback not provided'); });

        const wknd = parameters?.wknd === true;
        const localPackage: string = (parameters?.localPackage ?? '') as string;
        const replication = parameters?.replication === true;

        progress(`Starting first start and initial setup. (wknd: ${wknd}, replication: ${replication}, custom package: ${localPackage ? `'${localPackage}'` : 'false'})`);

        if (!await this.awaitInstallComplete()) {
            progress('Error: Install did not complete in time');
            throw new Error('Install did not complete in time');
        }

        progress('Stopping all instances in case they were running');
        await this.startStopService.stop();

        progress('Starting all instances again');
        await this.startStopService.start();

        progress('Waiting for all instances to be running');
        if (!await this.startStopService.awaitAllRunning()) {
            progress('Error: Instances did not start in time');
            throw new Error('Instances did not start in time');
        }

        progress('Loading Oak jar');
        this.aemInstanceManager.loadOakJar();

        if (replication) {
            progress('Setting up replication');
            const replicationSettings = ReplicationSettings.getInstance();
            await replicationSettings.setReplication(this.project, 'author');
            await replicationSettings.setReplication(this.project, 'publisher');
            await replicationSettings.setReplication(this.project, 'dispatcher');
        }

        if (wknd) {
            progress('Installing WKND package');
            const packageInstaller = new PackageInstaller(this.project);
            const wkndUrl = "https://github.com/adobe/aem-guides-wknd/releases/download/aem-guides-wknd-3.2.0/aem-guides-wknd.all-3.2.0.zip"
            await packageInstaller.installPackage('author', wkndUrl);
            await packageInstaller.installPackage('publisher', wkndUrl);
        }

        if (localPackage) {
            progress('Installing local package');
            const packageInstaller = new PackageManager(this.project);
            await packageInstaller.installPackage('author', localPackage);
            await packageInstaller.installPackage('publisher', localPackage);
        }

        progress('Restarting dispatcher');
        await this.startStopService.restartDispatcher();

        progress('Done');
    }

    private async awaitInstallComplete(): Promise<boolean> {
        const folders = ['author/crx-quickstart', 'publisher/crx-quickstart', 'dispatcher/dispatcher-sdk'];
        const settingsPath = path.join(this.project.folderPath, 'settings.json');
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const checkInterval = 2000; // 2 seconds in milliseconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            if (fs.existsSync(settingsPath) && folders.every(folder => fs.existsSync(path.join(this.project.folderPath, folder)))) {
                return true;
            }
            
            // Wait for 2 seconds before next check
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        // Timeout reached, file and folders not found
        return false;
    }

}