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
     * Installs a package from a URL or local file path
     */
    async installPackage(instance: 'author' | 'publisher', packageUrl: string): Promise<void> {
        if (packageUrl.startsWith('http://') || packageUrl.startsWith('https://')) {
            // Handle URL installation
            await this.installPackageFromUrl(instance, packageUrl);
        } else {
            // Handle local file installation
            await this.installPackageFromFile(instance, packageUrl);
        }
    }

    /**
     * Downloads and installs a package from a URL
     */
    private async installPackageFromUrl(instance: 'author' | 'publisher', packageUrl: string): Promise<void> {
        console.log(`[PackageInstaller] Installing package from URL: ${packageUrl} on ${instance} instance`);
        
        // Get instance settings to determine port
        const settings = this.project.settings;
        const instanceSettings = settings[instance];
        const port = instanceSettings.port;
        const host = 'localhost';

        try {
            // Download the package
            const response = await fetch(packageUrl);
            if (!response.ok) {
                throw new Error(`Failed to download package: ${response.status} ${response.statusText}`);
            }

            const packageBuffer = await response.arrayBuffer();
            const fileName = path.basename(packageUrl);
            
            // Create FormData-like structure manually
            const boundary = `----WebKitFormBoundary${randomUUID()}`;
            const formData = this.createMultipartFormData(boundary, {
                file: { buffer: Buffer.from(packageBuffer), filename: fileName },
                name: fileName,
                force: 'true',
                install: 'true'
            });

            const url = `http://${host}:${port}/crx/packmgr/service.jsp`;
            console.log(`[PackageInstaller] Installing package to: ${url}`);

            const installResponse = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': formData.length.toString()
                },
                body: formData
            });

            if (!installResponse.ok) {
                const responseText = await installResponse.text();
                throw new Error(`Failed to install package: ${installResponse.status} ${installResponse.statusText}. Response: ${responseText}`);
            }

            const responseText = await installResponse.text();
            console.log(`[PackageInstaller] Installation response:`, responseText);
            console.log(`[PackageInstaller] Successfully installed package from URL on ${instance} instance`);
            
        } catch (error) {
            console.error(`[PackageInstaller] Error installing package from URL:`, error);
            throw error;
        }
    }

    /**
     * Installs a package from a local file path
     */
    private async installPackageFromFile(instance: 'author' | 'publisher', filePath: string): Promise<void> {
        console.log(`[PackageInstaller] Installing package from file: ${filePath} on ${instance} instance`);

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
        const host = 'localhost';

        try {
            // Read the file as a buffer
            const fileBuffer = fs.readFileSync(filePath);
            
            // Create FormData-like structure manually
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
            console.log(`[PackageInstaller] Successfully installed package from file on ${instance} instance`);
            
        } catch (error) {
            console.error(`[PackageInstaller] Error installing package from file:`, error);
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
                const contentType = value.filename.endsWith('.zip') ? 'application/zip' : 'application/octet-stream';
                parts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"; filename="${value.filename}"\r\n`));
                parts.push(Buffer.from(`Content-Type: ${contentType}\r\n\r\n`));
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