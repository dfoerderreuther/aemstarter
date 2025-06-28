import { Project } from "../../types/Project";
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { randomUUID } from 'crypto';

export class PackageInstaller {

    private project: Project;

    constructor(project: Project) {
        this.project = project;
    }

    /**
     * Atomically downloads a file to prevent corruption during concurrent downloads
     */
    private async atomicDownload(url: string, targetPath: string): Promise<void> {
        const tempPath = `${targetPath}.tmp.${randomUUID()}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download package: ${response.status} ${response.statusText}`);
            }

            const packageBuffer = await response.arrayBuffer();
            fs.writeFileSync(tempPath, Buffer.from(packageBuffer));
            
            // Atomic rename - this operation is atomic on most filesystems
            fs.renameSync(tempPath, targetPath);
            
        } catch (error) {
            // Clean up temp file if download failed
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            throw error;
        }
    }

    async installPackage(instance: 'author' | 'publisher', packageUrl: string): Promise<void> {

        // Create install directory if it doesn't exist
        const installDir = this.getInstallDir();

        // Extract filename from URL and make it instance-specific
        const originalFileName = path.basename(packageUrl);
        const fileExtension = path.extname(originalFileName);
        const baseName = path.basename(originalFileName, fileExtension);
        const fileName = `${baseName}${fileExtension}`;
        const filePath = path.join(installDir, fileName);

        if (packageUrl.startsWith('http')) {

            // Download the package if it doesn't exist
            if (!fs.existsSync(filePath)) {
                console.log(`[PackageInstaller] Downloading package from ${packageUrl} for ${instance} instance`);
                
                try {
                    await this.atomicDownload(packageUrl, filePath);
                    console.log(`[PackageInstaller] Downloaded package to ${filePath}`);
                } catch (error) {
                    console.error(`[PackageInstaller] Error downloading package:`, error);
                    throw error;
                }
            } else {
                console.log(`[PackageInstaller] Package already exists at ${filePath}`);
            }
        } else {
            // its a file
            
            // Copy the package if it doesn't exist
            if (!fs.existsSync(filePath)) {
                console.log(`[PackageInstaller] Copying package from ${packageUrl} for ${instance} instance`);
                fs.copyFileSync(packageUrl, filePath);
                console.log(`[PackageInstaller] Copied package to ${filePath}`);
            } else {
                console.log(`[PackageInstaller] Package already exists at ${filePath}`);
            }
        }
        return this.installPackageFromFile(instance, filePath);
    }

    private getInstallDir(): string {
        // Create install directory if it doesn't exist
        const installDir = path.join(this.project.folderPath, 'install');
        if (!fs.existsSync(installDir)) {
            fs.mkdirSync(installDir, { recursive: true });
        }
        return installDir;
    }

    private async installPackageFromFile(instance: 'author' | 'publisher', filePath: string): Promise<void> {

        // Verify the file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`Package file not found: ${filePath}`);
        }

        // Extract filename for the package manager
        const fileName = path.basename(filePath);

        // Get instance settings to determine port
        const settings = this.project.settings;
        const instanceSettings = settings[instance];
        const port = instanceSettings.port;
        const host = 'localhost'; // Default host

        // Install the package using curl
        console.log(`[PackageInstaller] Installing package on ${instance} instance (${host}:${port})`);
        
        return new Promise((resolve, reject) => {
            const curlCommand = `curl -u admin:admin -F file=@"${filePath}" -F name="${fileName}" -F force=true -F install=true http://${host}:${port}/crx/packmgr/service.jsp --progress-bar`;
            
            console.log(`[PackageInstaller] Executing: ${curlCommand}`);
            
            exec(curlCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[PackageInstaller] Error installing package:`, error);
                    reject(error);
                    return;
                }
                
                if (stderr) {
                    console.log(`[PackageInstaller] curl stderr:`, stderr);
                }
                
                console.log(`[PackageInstaller] curl stdout:`, stdout);
                console.log(`[PackageInstaller] Successfully installed package on ${instance} instance`);
                resolve();
            });
        });
    }

}