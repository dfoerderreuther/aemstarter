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

export class FirstStartAndInitialSetup implements AutoTask {

    public project: Project;
    protected aemInstanceManager: AemInstanceManager;
    protected dispatcherManager: DispatcherManager;

    public constructor(project: Project) {
        this.project = project;
        this.aemInstanceManager = AemInstanceManagerRegister.getInstanceManager(this.project);
        this.dispatcherManager = DispatcherManagerRegister.getManager(this.project);
    }

    public async run(progressCallback?: (message: string) => void) : Promise<void> {
        const progress = progressCallback || (() => { console.log('Progress callback not provided'); });

        progress('Starting first start and initial setup');

        if (!await this.awaitInstallComplete()) {
            progress('Error: Install did not complete in time');
            throw new Error('Install did not complete in time');
        }

        progress('Stopping all instances in case they were running');
        await this.stopWhenRunning();

        progress('Starting all instances again');
        await this.start();

        progress('Waiting for all instances to be running');
        await this.awaitAllRunning();

        progress('Loading Oak jar');
        this.aemInstanceManager.loadOakJar();

        progress('Setting up replication');
        const replicationSettings = ReplicationSettings.getInstance();
        await replicationSettings.setReplication(this.project, 'author');
        await replicationSettings.setReplication(this.project, 'publisher');
        await replicationSettings.setReplication(this.project, 'dispatcher');

        progress('Installing WKND package');
        const packageInstaller = new PackageInstaller(this.project);
        const wkndUrl = "https://github.com/adobe/aem-guides-wknd/releases/download/aem-guides-wknd-3.2.0/aem-guides-wknd.all-3.2.0.zip"
        await packageInstaller.installPackage('author', wkndUrl);
        await packageInstaller.installPackage('publisher', wkndUrl);
    }

    private async awaitInstallComplete(): Promise<boolean> {
        const settingsPath = path.join(this.project.folderPath, 'settings.json');
        const maxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        const checkInterval = 2000; // 2 seconds in milliseconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            if (fs.existsSync(settingsPath)) {
                return true;
            }
            
            // Wait for 2 seconds before next check
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        // Timeout reached, file not found
        return false;
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

    protected async start() {
        const startPromises: Promise<void>[] = [];
        startPromises.push(this.aemInstanceManager.startInstance('author', 'start'))
        startPromises.push(this.aemInstanceManager.startInstance('publisher', 'start'))
        startPromises.push(this.dispatcherManager.startDispatcher())
        await Promise.all(startPromises);
    }

    private async awaitAllRunning() {
        const maxWaitTime = 10 * 60 * 1000; // 5 minutes in milliseconds
        const checkInterval = 2000; // 2 seconds in milliseconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            if (await this.isAEMRunning('author') && await this.isAEMRunning('publisher') && await this.isDispatcherRunning()) {
                return true;
            }

            // Wait for 2 seconds before next check
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        // Timeout reached, file not found
        return false;
    }

    private async isAEMRunning(instanceType: 'author' | 'publisher') {
        if (!this.aemInstanceManager.isInstanceRunning(instanceType)) return false;

        const port = instanceType === 'author' ? this.project.settings.author.port : this.project.settings.publisher.port;
        const response = await fetch(`http://localhost:${port}/libs/granite/core/content/login.html`);
        return response.status === 200;
    }

    private async isDispatcherRunning() {
        return this.dispatcherManager.isDispatcherRunning();
    }
}