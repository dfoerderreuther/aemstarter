import { Project } from "../../types/Project";
import path from 'path';
import fs from 'fs';
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
        console.log(`[PackageInstaller] DEBUG: packageUrl = ${packageUrl}`);
        console.log(`[PackageInstaller] DEBUG: installDir = ${installDir}`);

        // Extract filename from URL and make it instance-specific
        const originalFileName = path.basename(packageUrl);
        console.log(`[PackageInstaller] DEBUG: originalFileName = ${originalFileName}`);
        const fileExtension = path.extname(originalFileName);
        const baseName = path.basename(originalFileName, fileExtension);
        const fileName = `${baseName}-${instance}${fileExtension}`;
        const filePath = path.join(installDir, fileName);
        console.log(`[PackageInstaller] DEBUG: fileName = ${fileName}`);
        console.log(`[PackageInstaller] DEBUG: filePath = ${filePath}`);

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

        console.log(`[PackageInstaller] Installing package on ${instance} instance (${host}:${port})`);
        
        try {
            // Read the file as a buffer
            const fileBuffer = fs.readFileSync(filePath);
            
            // Create FormData-like structure manually since Node.js doesn't have FormData
            const boundary = `----WebKitFormBoundary${randomUUID()}`;
            const formData = this.createMultipartFormData(boundary, {
                file: { buffer: fileBuffer, filename: fileName },
                name: fileName,
                force: 'true',
                install: 'true'
            });

            const url = `http://${host}:${port}/crx/packmgr/service.jsp`;
            console.log(`[PackageInstaller] Installing package to: ${url}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': formData.length.toString()
                },
                body: formData
            });

            if (!response.ok) {
                const responseText = await response.text();
                throw new Error(`Failed to install package: ${response.status} ${response.statusText}. Response: ${responseText}`);
            }

            const responseText = await response.text();
            console.log(`[PackageInstaller] Installation response:`, responseText);
            console.log(`[PackageInstaller] Successfully installed package on ${instance} instance`);
            
        } catch (error) {
            console.error(`[PackageInstaller] Error installing package:`, error);
            throw error;
        }
    }

    /**
     * Creates multipart form data manually for cross-platform compatibility
     */
    private createMultipartFormData(boundary: string, fields: Record<string, any>): Buffer {
        const parts: Buffer[] = [];
        
        for (const [name, value] of Object.entries(fields)) {
            parts.push(Buffer.from(`--${boundary}\r\n`));
            
            if (value.buffer && value.filename) {
                // File field
                parts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"; filename="${value.filename}"\r\n`));
                parts.push(Buffer.from('Content-Type: application/octet-stream\r\n\r\n'));
                parts.push(value.buffer);
            } else {
                // Text field
                parts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
                parts.push(Buffer.from(String(value)));
            }
            
            parts.push(Buffer.from('\r\n'));
        }
        
        parts.push(Buffer.from(`--${boundary}--\r\n`));
        
        return Buffer.concat(parts);
    }

}