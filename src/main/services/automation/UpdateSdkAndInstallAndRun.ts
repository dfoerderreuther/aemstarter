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
import { Installer } from "../Installer";
import log from 'electron-log';

export class UpdateSdkAndInstallAndRun implements AutoTask {

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

        const authorPackages: string[] = (parameters?.authorPackages as string[]) || [];
        const publisherPackages: string[] = (parameters?.publisherPackages as string[]) || [];
        const replication = parameters?.replication === true;
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

        if (!await this.awaitInstallComplete()) {
            progress('Error: Install did not complete in time');
            throw new Error('Install did not complete in time');
        }
        
        progress('Starting all instances. Waiting for all instances to be running...');
        await this.startStopService.start();
        if (!await this.startStopService.awaitAllRunning()) {
            progress('Error: Instances did not start in time');
            throw new Error('Instances did not start in time');
        }
        progress('AEM SDK update completed successfully - all services are running');

        progress(`Starting first start and initial setup. (replication: ${replication}, author packages: ${authorPackages.length}, publisher packages: ${publisherPackages.length})`);

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
            progress(`Installing ${authorPackages.length} package(s) to Author instance in order`);
            const packageManager = new PackageManager(this.project);
            for (let i = 0; i < authorPackages.length; i++) {
                const packageName = authorPackages[i];
                progress(`Installing Author package ${i + 1}/${authorPackages.length}: ${packageName}`);
                await packageManager.installPackage('author', packageName);
            }
        }

        if (publisherPackages.length > 0) {
            progress(`Installing ${publisherPackages.length} package(s) to Publisher instance in order`);
            const packageManager = new PackageManager(this.project);
            for (let i = 0; i < publisherPackages.length; i++) {
                const packageName = publisherPackages[i];
                progress(`Installing Publisher package ${i + 1}/${publisherPackages.length}: ${packageName}`);
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