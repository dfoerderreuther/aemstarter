import { Project } from "../../types/Project";
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';

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

    /**
     * Atomically downloads a file from AEM with authentication
     */
    private async atomicDownloadWithAuth(url: string, targetPath: string): Promise<void> {
        const tempPath = `${targetPath}.tmp.${randomUUID()}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
                }
            });
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

    /**
     * Creates a filter.xml content with the given paths
     */
    private createFilterXml(paths: string[]): string {
        const filterEntries = paths.map(path => `    <filter root="${path}"/>`).join('\n');
        return `<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
${filterEntries}
</workspaceFilter>`;
    }

    /**
     * Creates a package zip with META-INF/vault/filter.xml and jcr_root structure
     */
    private createPackageZip(name: string, paths: string[]): Buffer {
        const zip = new AdmZip();
        
        // Create filter.xml content
        const filterXml = this.createFilterXml(paths);
        
        // Add filter.xml to the zip with proper structure
        zip.addFile('META-INF/vault/filter.xml', Buffer.from(filterXml, 'utf8'));
        
        // Add jcr_root folder (required for AEM packages)
        zip.addFile('jcr_root/.content.xml', Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"/>', 'utf8'));
        
        return zip.toBuffer();
    }

    public async createPackage(name: string, instances: string[], paths: string[]): Promise<void> {
        // Create packages directory if it doesn't exist
        const packagesDir = path.join(this.project.folderPath, 'packages');
        if (!fs.existsSync(packagesDir)) {
            fs.mkdirSync(packagesDir, { recursive: true });
            console.log(`[PackageInstaller] Created packages directory: ${packagesDir}`);
        }

        // Get instance settings
        const settings = this.project.settings;

        for (const instance of instances) {
            const instanceKey = instance as 'author' | 'publisher';
            const instanceSettings = settings[instanceKey];
            if (!instanceSettings) {
                throw new Error(`Instance settings not found for: ${instance}`);
            }
            
            const port = instanceSettings.port;
            const host = 'localhost';
            const packageName = `${name}-${instance}`;
            
            console.log(`[PackageInstaller] Creating package ${packageName} with paths: ${paths.join(', ')} on ${instance} instance`);
            
            try {
                // Create package zip with filter.xml
                const packageBuffer = this.createPackageZip(packageName, paths);
                
                // Save package locally first for debugging
                const tempPackagePath = path.join(packagesDir, `${packageName}.zip`);
                fs.writeFileSync(tempPackagePath, packageBuffer);
                console.log(`[PackageInstaller] Created package zip at: ${tempPackagePath}`);
                console.log(`[PackageInstaller] Package size: ${packageBuffer.length} bytes`);
                
                // Debug: Check zip contents
                try {
                    const testZip = new AdmZip(tempPackagePath);
                    const entries = testZip.getEntries();
                    console.log(`[PackageInstaller] Zip contains ${entries.length} entries:`);
                    entries.forEach(entry => {
                        console.log(`  - ${entry.entryName} (${entry.header.size} bytes)`);
                    });
                } catch (zipError) {
                    console.error(`[PackageInstaller] Error reading zip contents:`, zipError);
                }
                
                // Upload package to package manager using proper form data
                const boundary = `----WebKitFormBoundary${randomUUID()}`;
                const formData = this.createSimpleMultipartFormData(boundary, packageBuffer, `${packageName}.zip`);
                
                const uploadUrl = `http://${host}:${port}/crx/packmgr/service/.json`;
                console.log(`[PackageInstaller] Uploading package to: ${uploadUrl}`);
                console.log(`[PackageInstaller] Form data size: ${formData.length} bytes`);
                console.log(`[PackageInstaller] Boundary: ${boundary}`);
                
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    body: formData
                });
                
                const uploadResponseText = await uploadResponse.text();
                console.log(`[PackageInstaller] Upload response status: ${uploadResponse.status}`);
                console.log(`[PackageInstaller] Upload response text:`, uploadResponseText);
                
                if (!uploadResponse.ok) {
                    throw new Error(`Failed to upload package: ${uploadResponse.status} ${uploadResponse.statusText}. Response: ${uploadResponseText}`);
                }
                
                // Extract package path from response
                let packagePath;
                try {
                    const responseJson = JSON.parse(uploadResponseText);
                    if (responseJson.success && responseJson.path) {
                        packagePath = responseJson.path;
                        console.log(`[PackageInstaller] Package uploaded to: ${packagePath}`);
                    } else {
                        throw new Error(`Upload response indicates failure: ${uploadResponseText}`);
                    }
                } catch (parseError) {
                    console.log(`[PackageInstaller] Could not parse upload response as JSON, trying to extract path from HTML response`);
                    // Try to extract path from HTML response
                    const pathMatch = uploadResponseText.match(/\/etc\/packages\/[^"]+\.zip/);
                    if (pathMatch) {
                        packagePath = pathMatch[0];
                        console.log(`[PackageInstaller] Extracted package path: ${packagePath}`);
                    } else {
                        throw new Error(`Could not determine package path from upload response: ${uploadResponseText}`);
                    }
                }
                
                // Build the package
                const buildUrl = `http://${host}:${port}/crx/packmgr/service/.json${packagePath}?cmd=build`;
                console.log(`[PackageInstaller] Building package: ${buildUrl}`);
                
                const buildResponse = await fetch(buildUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
                    }
                });
                
                const buildResponseText = await buildResponse.text();
                console.log(`[PackageInstaller] Build response status: ${buildResponse.status}`);
                console.log(`[PackageInstaller] Build response text:`, buildResponseText);
                
                if (!buildResponse.ok) {
                    throw new Error(`Failed to build package: ${buildResponse.status} ${buildResponse.statusText}. Response: ${buildResponseText}`);
                }
                
                // Download the built package
                const downloadUrl = `http://${host}:${port}${packagePath}`;
                console.log(`[PackageInstaller] Downloading package from ${downloadUrl} to ${tempPackagePath}`);
                await this.atomicDownloadWithAuth(downloadUrl, tempPackagePath);
                
                console.log(`[PackageInstaller] Successfully created, built and downloaded package: ${packageName}`);
                
            } catch (error) {
                console.error(`[PackageInstaller] Error creating/building/downloading package ${packageName}:`, error);
                throw error;
            }
        }
    }

    public async listPackages(): Promise<string[]> {
        const packagesDir = path.join(this.project.folderPath, 'packages');
        if (!fs.existsSync(packagesDir)) {
            return [];
        }
        return fs.readdirSync(packagesDir);
    }

    public async deletePackage(packageName: string): Promise<void> {
        const packagesDir = path.join(this.project.folderPath, 'packages');
        const packagePath = path.join(packagesDir, packageName);
        
        if (fs.existsSync(packagePath)) {
            fs.unlinkSync(packagePath);
            console.log(`[PackageInstaller] Deleted package: ${packageName}`);
        } else {
            console.log(`[PackageInstaller] Package not found: ${packageName}`);
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
     * Creates simple multipart form data for package upload (matches curl -F cmd=upload -F force=true -F package=@file)
     */
    private createSimpleMultipartFormData(boundary: string, fileBuffer: Buffer, filename: string): Buffer {
        const parts: Buffer[] = [];
        
        // Add cmd=upload field
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="cmd"\r\n\r\n`));
        parts.push(Buffer.from('upload'));
        parts.push(Buffer.from('\r\n'));
        
        // Add force=true field
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="force"\r\n\r\n`));
        parts.push(Buffer.from('true'));
        parts.push(Buffer.from('\r\n'));
        
        // Add package file field
        parts.push(Buffer.from(`--${boundary}\r\n`));
        parts.push(Buffer.from(`Content-Disposition: form-data; name="package"; filename="${filename}"\r\n`));
        parts.push(Buffer.from('Content-Type: application/zip\r\n\r\n'));
        parts.push(fileBuffer);
        parts.push(Buffer.from('\r\n'));
        
        parts.push(Buffer.from(`--${boundary}--\r\n`));
        
        return Buffer.concat(parts);
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