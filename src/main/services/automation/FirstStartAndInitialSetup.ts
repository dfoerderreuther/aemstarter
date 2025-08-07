import { AutoTask } from "./Automation";
import { Project } from "../../../types/Project";
import * as fs from 'fs';
import * as path from 'path';
import { DispatcherManager } from "../DispatcherManager";
import { AemInstanceManager } from "../AemInstanceManager";
import { AemInstanceManagerRegister } from "../../AemInstanceManagerRegister";
import { DispatcherManagerRegister } from "../../DispatcherManagerRegister";
import { ReplicationSettings } from "../ReplicationSettings";
import { PackageManager } from "../PackageManager";
import { AutoStartStopService } from "../AutoStartStopService";
import log from 'electron-log';

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

    public async run(progressCallback?: (message: string) => void, parameters?: { [key: string]: string | boolean | number | string[] }) : Promise<void> {
        const progress = progressCallback || (() => { log.info('Progress callback not provided'); });

        const authorPackages: string[] = (parameters?.authorPackages ?? []) as string[];
        const publisherPackages: string[] = (parameters?.publisherPackages ?? []) as string[];
        const replication = parameters?.replication === true;

        progress(`Starting first start and initial setup. (replication: ${replication}, author packages: ${authorPackages.length}, publisher packages: ${publisherPackages.length})`);

        if (!await this.awaitInstallComplete()) {
            progress('Error: Install did not complete in time');
            throw new Error('Install did not complete in time');
        }

        progress('Stopping all instances in case they were running');
        await this.startStopService.stop();

        progress('Starting all instances');
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

        if (authorPackages.length > 0) {
            progress(`Installing ${authorPackages.length} packages to Author instance`);
            const packageManager = new PackageManager(this.project);
            for (const packageName of authorPackages) {
                progress(`Installing package '${packageName}' to Author`);
                await packageManager.installPackage('author', packageName);
            }
        }

        if (publisherPackages.length > 0) {
            progress(`Installing ${publisherPackages.length} packages to Publisher instance`);
            const packageManager = new PackageManager(this.project);
            for (const packageName of publisherPackages) {
                progress(`Installing package '${packageName}' to Publisher`);
                await packageManager.installPackage('publisher', packageName);
            }
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