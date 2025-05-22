import { Project } from "../../types/Project";

import fs from 'fs';
import extract from 'extract-zip';
import process from 'process';

const AUTHOR_ENV_TEMPLATE = `
CQ_RUNMODE=author,default
#CQ_RUNMODE=dynamicmedia_scene7,$CQ_RUNMODE
CQ_PORT=4502

export CQ_JVM_OPTS='-server -Xmx4096m -XX:MaxPermSize=256M -Djava.awt.headless=true'
`;

const PUBLISH_ENV_TEMPLATE = `
CQ_RUNMODE=publish,default
#CQ_RUNMODE=dynamicmedia_scene7,$CQ_RUNMODE
CQ_PORT=4503

export CQ_JVM_OPTS='-server -Xmx4096m -XX:MaxPermSize=256M -Djava.awt.headless=true'
`;

export class Installer {

    private project: Project;

    private folders = ['author', 'publish', 'dispatcher', 'install'];
    private licensePropertiesPath: string;
    private sdkPath: string;
    private workDir: string;
    private installDir: string;

    constructor(project: Project) {
        this.project = project;

        this.licensePropertiesPath = this.project.licensePath;
        this.sdkPath = this.project.aemSdkPath;
        this.workDir = this.project.folderPath;

        this.installDir = `${this.workDir}/install`;
    }

    async delete() {
        console.log('Deleting AEM for project:', this.project);
        for (const folder of this.folders) {
            const folderPath = `${this.project.folderPath}/${folder}`;
            fs.rmSync(folderPath, { force: true, recursive: true });
        }
        console.log('Deletion complete');
    }

    async install() {
        this.validate();
        
        console.log('Installing AEM for project:', this.project);
        await this.delete();
        
        await this.createFolders()
        await this.extractSdk()

        // Find and copy the AEM SDK quickstart file
        const files = fs.readdirSync(this.installDir);
        const quickstartFile = files.find(file => file.startsWith('aem-sdk-quickstart'));
        const dispatcherScript = files.find(file => file.match(/aem-sdk-dispatcher-.*.sh/));
        //const windowsDispatcherZip = files.find(file => file.match(/aem-sdk-dispatcher-.*.zip/));

        await this.installAemInstance(`${this.project.folderPath}/author`, this.installDir + '/' + quickstartFile, 'author');
        await this.installAemInstance(`${this.project.folderPath}/publish`, this.installDir + '/' + quickstartFile, 'publish');

        await this.installDispatcherLinux(`${this.project.folderPath}/dispatcher`, this.installDir + '/' + dispatcherScript);

        console.log('Installation complete');
    }

    private validate() {
        if (!fs.existsSync(this.licensePropertiesPath)) {
            throw new Error('license.properties file not found ' + this.licensePropertiesPath);
        }
        
        if (!fs.existsSync(this.sdkPath)) {
            throw new Error('aem-sdk.zip file not found');
        }
        
        if (!fs.existsSync(this.workDir)) {
            throw new Error('work folder not found');
        }
    }
    
    private async createFolders() {
        for (const folder of this.folders) {
            const folderPath = `${this.workDir}/${folder}`;
            fs.mkdirSync(folderPath, { recursive: true });
        }
    }

    private async extractSdk() {
        await extract(this.sdkPath, { dir: this.installDir });
    }

    private async installAemInstance(instanceDir: string, quickstartFile: string, type: string) {
        fs.copyFileSync(this.licensePropertiesPath, `${instanceDir}/license.properties`);
        fs.symlinkSync(
            quickstartFile,
            `${instanceDir}/aem-sdk-quickstart.jar`
        );
        if (type === 'author') {
            console.log('writing env.sh for author');
            fs.writeFileSync(`${instanceDir}/env.sh`, AUTHOR_ENV_TEMPLATE);
        } else if (type === 'publish') {
            console.log('writing env.sh for publish');
            fs.writeFileSync(`${instanceDir}/env.sh`, PUBLISH_ENV_TEMPLATE);
        }
    }

    private async installDispatcherLinux(dispatcherDir: string, dispatcherScript: string) {
        // Change to dispatcher directory and execute script
        console.log('installing dispatcher for linux', dispatcherDir, dispatcherScript);
        process.chdir(dispatcherDir);
        if (dispatcherScript) {
            const { execSync } = require('child_process');
            execSync(`chmod +x ${dispatcherScript}`);
            execSync(`${dispatcherScript}`);

            const files = fs.readdirSync(`${this.project.folderPath}/dispatcher`);
            const dispatcherDir = files.find(file => file.startsWith('dispatcher-sdk'));
            console.log('dispatcherDir', dispatcherDir);
            if (dispatcherDir) {
                fs.symlinkSync(
                    `${this.project.folderPath}/dispatcher/${dispatcherDir}`,
                    `${this.project.folderPath}/dispatcher/dispatcher-sdk`
                );
            }
        }
    }

}