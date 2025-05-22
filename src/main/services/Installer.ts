import { Project } from "../../types/Project";

import fs from 'fs';
import path from 'path';
import extract from 'extract-zip';
import process from 'process';

export class Installer {

    private project: Project;

    private folders = ['author', 'publish', 'dispatcher', 'install'];

    constructor(project: Project) {
        this.project = project;
    }

    async delete() {
        console.log('Deleting AEM for project:', this.project);
        for (const folder of this.folders) {
            const folderPath = `${this.project.folderPath}/${folder}`;
            fs.rmSync(folderPath, { force: true, recursive: true });
        }
    }

    async install() {
        console.log('Installing AEM for project:', this.project);
        await this.delete();
        
        const licensePath = this.project.licensePath;
        const sdkPath = this.project.aemSdkPath;

        const licenseExists = fs.existsSync(licensePath);
        if (!licenseExists) {
            throw new Error('license.properties file not found ' + licensePath);
        }
        
        const sdkExists = fs.existsSync(sdkPath);
        if (!sdkExists) {
            throw new Error('aem-sdk.zip file not found in project folder');
        }

        for (const folder of this.folders) {
            const folderPath = `${this.project.folderPath}/${folder}`;
            fs.mkdirSync(folderPath, { recursive: true });
        }

        for (const folder of ['author', 'publish']) {
            fs.copyFileSync(licensePath, `${this.project.folderPath}/${folder}/license.properties`);
        }

        await extract(sdkPath, { dir: `${this.project.folderPath}/install` });
        
        // Find and copy the AEM SDK quickstart file
        const installDir = `${this.project.folderPath}/install`;
        const files = fs.readdirSync(installDir);
        const quickstartFile = files.find(file => file.startsWith('aem-sdk-quickstart'));
        const dispatcherScript = files.find(file => file.match(/aem-sdk-dispatcher-.*.sh/));
        const windowsDispatcherZip = files.find(file => file.match(/aem-sdk-dispatcher-.*.zip/));

        console.log(quickstartFile);
        console.log(dispatcherScript);
        console.log(windowsDispatcherZip);
        
        for (const folder of ['author', 'publish']) {
            fs.copyFileSync(licensePath, `${this.project.folderPath}/${folder}/license.properties`);
            if (quickstartFile) {
                fs.symlinkSync(
                    `${installDir}/${quickstartFile}`,
                    `${this.project.folderPath}/${folder}/aem-sdk-quickstart.jar`
                );
            }
        }

        // Change to dispatcher directory and execute script
        process.chdir(`${this.project.folderPath}/dispatcher`);
        if (dispatcherScript) {
            const { execSync } = require('child_process');
            execSync(`chmod +x ${installDir}/${dispatcherScript}`);
            execSync(`${installDir}/${dispatcherScript}`);

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
        console.log('Installation complete');
    }
}