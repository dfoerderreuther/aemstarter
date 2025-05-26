import { Project } from "../../types/Project";
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { ProjectSettings } from './ProjectSettings';

export class PackageInstaller {

    private project: Project;

    constructor(project: Project) {
        this.project = project;
    }


    async installPackage(instance: 'author' | 'publisher', packageUrl: string): Promise<void> {

        // Create install directory if it doesn't exist
        const installDir = path.join(this.project.folderPath, 'install');
        if (!fs.existsSync(installDir)) {
            fs.mkdirSync(installDir, { recursive: true });
        }

        // Extract filename from URL
        const fileName = path.basename(packageUrl);
        const filePath = path.join(installDir, fileName);

        // Download the package if it doesn't exist
        if (!fs.existsSync(filePath)) {
            console.log(`[PackageInstaller] Downloading package from ${packageUrl}`);
            
            try {
                const response = await fetch(packageUrl);
                if (!response.ok) {
                    throw new Error(`Failed to download WKND package: ${response.status} ${response.statusText}`);
                }

                const packageBuffer = await response.arrayBuffer();
                fs.writeFileSync(filePath, Buffer.from(packageBuffer));
                console.log(`[PackageInstaller] Downloaded WKND package to ${filePath}`);
            } catch (error) {
                console.error(`[PackageInstaller] Error downloading WKND package:`, error);
                throw error;
            }
        } else {
            console.log(`[PackageInstaller] WKND package already exists at ${filePath}`);
        }

        // Get instance settings to determine port
        const settings = ProjectSettings.getSettings(this.project);
        const instanceSettings = settings[instance];
        const port = instanceSettings.port;
        const host = 'localhost'; // Default host

        // Install the package using curl
        console.log(`[PackageInstaller] Installing WKND package on ${instance} instance (${host}:${port})`);
        
        return new Promise((resolve, reject) => {
            const curlCommand = `curl -u admin:admin -F file=@"${filePath}" -F name="${fileName}" -F force=true -F install=true http://${host}:${port}/crx/packmgr/service.jsp --progress-bar`;
            
            console.log(`[PackageInstaller] Executing: ${curlCommand}`);
            
            exec(curlCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[PackageInstaller] Error installing WKND package:`, error);
                    reject(error);
                    return;
                }
                
                if (stderr) {
                    console.log(`[PackageInstaller] curl stderr:`, stderr);
                }
                
                console.log(`[PackageInstaller] curl stdout:`, stdout);
                console.log(`[PackageInstaller] Successfully installed WKND package on ${instance} instance`);
                resolve();
            });
        });
    }

}