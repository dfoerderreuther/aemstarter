import { Project } from "../../types/Project";

import fs from 'fs';
import path from 'path';
import extract from 'extract-zip';
import process from 'process';
import { ProjectSettingsService } from "./ProjectSettingsService";
import { enhancedExecAsync as execAsync } from '../enhancedExecAsync';


const README_TEMPLATE = `
# AEM Installation of {{PROJECT_NAME}}

## Author
This is the author instance of the AEM installation.

## Publisher
This is the publisher instance of the AEM installation.

## Dispatcher
This is the dispatcher instance of the AEM installation.

## Install
This is the install files of the AEM installation.

`;

export class Installer {

    private project: Project;

    private folders = ['author', 'publisher', 'dispatcher', 'install', 'packages', 'backup'];
    private licensePropertiesPath: string;
    private sdkPath: string;
    private classicQuickstartPath: string;
    private workDir: string;
    private installDir: string;

    constructor(project: Project) {
        this.project = project;

        this.licensePropertiesPath = this.project.licensePath;
        this.sdkPath = this.project.aemSdkPath;
        this.classicQuickstartPath = this.project.classicQuickstartPath;
        this.workDir = this.project.folderPath;

        this.installDir = `${this.workDir}/install`;
    }

    async reinstall() {
        for (const folder of ['author', 'publisher', 'dispatcher']) {
            const folderPath = `${this.project.folderPath}/${folder}`;
            fs.rmSync(folderPath, { force: true, recursive: true });
            fs.mkdirSync(folderPath, { recursive: true });
        }
        // Find and copy the AEM SDK quickstart file
        const files = fs.readdirSync(this.installDir);
        let quickstartFile = files.find(file => file.startsWith('aem-sdk-quickstart'));
        
        // Use classic quickstart JAR if in classic mode
        if (this.project.classic && this.classicQuickstartPath) {
            quickstartFile = path.basename(this.classicQuickstartPath);
        }
        
        const oakRunFile = files.find(file => file.match(/oak-run-.*\.jar$/));

        await this.installAemInstance(`${this.project.folderPath}/author`, this.installDir + '/' + quickstartFile, 'author');
        await this.installAemInstance(`${this.project.folderPath}/publisher`, this.installDir + '/' + quickstartFile, 'publisher');

        if (process.platform === 'win32') {
            const windowsDispatcherZip = files.find(file => file.match(/aem-sdk-dispatcher-.*.zip/));
            await this.installDispatcherWindows(`${this.project.folderPath}/dispatcher`, this.installDir + '/' + windowsDispatcherZip);
        } else {
            const dispatcherScript = files.find(file => file.match(/aem-sdk-dispatcher-.*.sh/));
            await this.installDispatcherLinux(`${this.project.folderPath}/dispatcher`, this.installDir + '/' + dispatcherScript);
        }

        this.createReadme();
        this.createSettings();
        
        if (oakRunFile) {
            const oakRunPath = `${this.installDir}/${oakRunFile}`;
            
            if (process.platform === 'win32') {
                fs.copyFileSync(oakRunPath, `${this.workDir}/author/oak-run.jar`);
                fs.copyFileSync(oakRunPath, `${this.workDir}/publisher/oak-run.jar`);
            } else {
                fs.symlinkSync(oakRunPath, `${this.workDir}/author/oak-run.jar`);
                fs.symlinkSync(oakRunPath, `${this.workDir}/publisher/oak-run.jar`);
            }
        }

        console.log('Installation complete');
    }

    async install() {
        this.validate();
        
        console.log('Installing AEM for project:', this.project);
        await this.delete();
        
        await this.createFolders()
        await this.extractSdk()

        // Handle classic quickstart JAR if needed
        if (this.project.classic && this.classicQuickstartPath) {
            const jarFileName = path.basename(this.classicQuickstartPath);
            const targetPath = `${this.installDir}/${jarFileName}`;
            fs.copyFileSync(this.classicQuickstartPath, targetPath);
            console.log(`Copied classic quickstart JAR to: ${targetPath}`);
        }

        // Find and copy the AEM SDK quickstart file
        const files = fs.readdirSync(this.installDir);
        let quickstartFile = files.find(file => file.startsWith('aem-sdk-quickstart'));
        
        // Use classic quickstart JAR if in classic mode
        if (this.project.classic && this.classicQuickstartPath) {
            quickstartFile = path.basename(this.classicQuickstartPath);
        }
        
        const dispatcherScript = files.find(file => file.match(/aem-sdk-dispatcher-.*.sh/));
        //const windowsDispatcherZip = files.find(file => file.match(/aem-sdk-dispatcher-.*.zip/));

        await this.installAemInstance(`${this.project.folderPath}/author`, this.installDir + '/' + quickstartFile, 'author');
        await this.installAemInstance(`${this.project.folderPath}/publisher`, this.installDir + '/' + quickstartFile, 'publisher');

        await this.installDispatcherLinux(`${this.project.folderPath}/dispatcher`, this.installDir + '/' + dispatcherScript);

        this.createReadme();
        this.createSettings();


        console.log('Installation complete');
    }

    private async delete() {
        console.log('Deleting AEM for project:', this.project);
        for (const folder of this.folders) {
            const folderPath = `${this.project.folderPath}/${folder}`;
            fs.rmSync(folderPath, { force: true, recursive: true });
        }
        fs.rmSync(`${this.project.folderPath}/screenshots`, { force: true, recursive: true });
        console.log('Deletion complete');
    }

    private validate() {
        if (this.licensePropertiesPath && !fs.existsSync(this.licensePropertiesPath)) {
            throw new Error('license.properties file not found ' + this.licensePropertiesPath);
        }
        
        if (!fs.existsSync(this.sdkPath)) {
            throw new Error('aem-sdk.zip file not found');
        }
        
        if (this.project.classic && !fs.existsSync(this.classicQuickstartPath)) {
            throw new Error('classic quickstart jar file not found ' + this.classicQuickstartPath);
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
        console.log('installing aem instance for', process.platform, type, instanceDir, quickstartFile);
        if (fs.existsSync(this.licensePropertiesPath)) {
            fs.copyFileSync(this.licensePropertiesPath, `${instanceDir}/license.properties`);
        }
        
        if (process.platform === 'win32') {
            fs.copyFileSync(quickstartFile, `${instanceDir}/aem-quickstart.jar`);
        } else {
            fs.symlinkSync(quickstartFile, `${instanceDir}/aem-quickstart.jar`);
        }
        
        // Force headless mode and terminal-like behavior
        const javaCommand = `java -Djava.awt.headless=true -Dorg.apache.felix.webconsole.internal.servlet.OsgiManager.username=admin -jar aem-quickstart.jar -unpack -nobrowser -nointeractive`;
        
        await execAsync(javaCommand, { 
            cwd: instanceDir,
            env: {
                ...process.env,
                DISPLAY: '',  // Remove display access
                TERM: 'xterm',  // Set terminal type
                JAVA_TOOL_OPTIONS: '-Djava.awt.headless=true'  // Additional headless enforcement
            }
        });
    }


    private async installDispatcherWindows(installDir: string, dispatcherZip: string) {
        console.log('installing dispatcher for windows', installDir, dispatcherZip);
        process.chdir(installDir);
        await execAsync(`unzip ${dispatcherZip} -d dispatcher-sdk`, { cwd: installDir });
        
        // Copy dispatcher-sdk/src to config
        await execAsync(`xcopy "${installDir}\\dispatcher-sdk\\src" "${installDir}\\config" /E /I /Y`, { cwd: installDir });
    }

    private async installDispatcherLinux(installDir: string, dispatcherScript: string) {
        // Change to dispatcher directory and execute script
        console.log('installing dispatcher for linux', installDir, dispatcherScript);
        process.chdir(installDir);
        if (dispatcherScript) {


            await execAsync(`chmod +x ${dispatcherScript}`, { cwd: installDir });
            await execAsync(`${dispatcherScript}`, { cwd: installDir });


            const files = fs.readdirSync(`${installDir}`);
            const dispatcherDir = files.find(file => file.startsWith('dispatcher-sdk'));
            if (dispatcherDir) {
                fs.symlinkSync(
                    `${installDir}/${dispatcherDir}`,
                    `${installDir}/dispatcher-sdk`
                );
            }
            await execAsync(`cp -R ${installDir}/dispatcher-sdk/src ${installDir}/config`, { cwd: installDir });
        }
        //const configPath = `${this.workDir}/dispatcher/config`;
        //fs.mkdirSync(configPath, { recursive: true });
    }

    private createReadme() {
        if (fs.existsSync(`${this.project.folderPath}/README.md`)) {
            return;
        }
        const readmeContent = README_TEMPLATE.replace('{{PROJECT_NAME}}', this.project.name);
        fs.writeFileSync(`${this.project.folderPath}/README.md`, readmeContent);
    }

    private createSettings() {
        if (fs.existsSync(`${this.project.folderPath}/settings.json`)) {
            return;
        }
        const settingsContent = JSON.stringify(ProjectSettingsService.getDefaultSettings(this.project), null, 2);
        fs.writeFileSync(`${this.project.folderPath}/settings.json`, settingsContent);
    }


}