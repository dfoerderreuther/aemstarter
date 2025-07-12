import { Project } from "../../types/Project";
import { PackageInfo } from "../../types/PackageInfo";
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';

export class PackageManager {

    private project: Project;

    constructor(project: Project) {
        this.project = project;
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
     * Creates properties.xml content for the package
     */
    private createPropertiesXml(name: string, group: string = 'aem-starter'): string {
        const timestamp = new Date().toISOString();
        return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
    <entry key="name">${name}</entry>
    <entry key="group">${group}</entry>
    <entry key="version">1.0</entry>
    <entry key="created">${timestamp}</entry>
    <entry key="createdBy">aem-starter</entry>
    <entry key="description">Package created by AEM Starter</entry>
    <entry key="buildCount">1</entry>
    <entry key="packageType">content</entry>
    <entry key="requiresRoot">false</entry>
    <entry key="allowIndexDefinitions">false</entry>
</properties>`;
    }

    /**
     * Creates definition/.content.xml content for the package
     */
    private createDefinitionXml(name: string, group: string = 'aem-starter'): string {
        const timestamp = new Date().toISOString();
        return `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:vlt="http://www.day.com/jcr/vault/1.0" xmlns:jcr="http://www.jcp.org/jcr/1.0" xmlns:nt="http://www.jcp.org/jcr/nt/1.0"
    jcr:created="${timestamp}"
    jcr:createdBy="aem-starter"
    jcr:description="Package created by AEM Starter"
    jcr:lastModified="${timestamp}"
    jcr:lastModifiedBy="aem-starter"
    jcr:primaryType="vlt:PackageDefinition"
    buildCount="1"
    builtWith="aem-starter"
    group="${group}"
    name="${name}"
    version="1.0"/>`;
    }

    /**
     * Creates a package zip with proper AEM package structure including metadata
     */
    private createPackageZip(name: string, paths: string[]): Buffer {
        const zip = new AdmZip();
        
        // Create filter.xml content
        const filterXml = this.createFilterXml(paths);
        
        // Create properties.xml content
        const propertiesXml = this.createPropertiesXml(name);
        
        // Create definition/.content.xml content
        const definitionXml = this.createDefinitionXml(name);
        
        // Add all metadata files to the zip with proper structure
        zip.addFile('META-INF/vault/filter.xml', Buffer.from(filterXml, 'utf8'));
        zip.addFile('META-INF/vault/properties.xml', Buffer.from(propertiesXml, 'utf8'));
        zip.addFile('META-INF/vault/definition/.content.xml', Buffer.from(definitionXml, 'utf8'));
        
        // Add jcr_root folder (required for AEM packages)
        zip.addFile('jcr_root/.content.xml', Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"/>', 'utf8'));
        
        return zip.toBuffer();
    }

    public async rebuildPackage(name: string, instances: string[]): Promise<void> {
        // Create packages directory if it doesn't exist
        const packagesDir = path.join(this.project.folderPath, 'packages');
        if (!fs.existsSync(packagesDir)) {
            fs.mkdirSync(packagesDir, { recursive: true });
            console.log(`[PackageManager] Created packages directory: ${packagesDir}`);
        }

        // Create package-specific directory
        const packageDir = path.join(packagesDir, name);
        if (!fs.existsSync(packageDir)) {
            fs.mkdirSync(packageDir, { recursive: true });
            console.log(`[PackageManager] Created package directory: ${packageDir}`);
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
            
            console.log(`[PackageManager] Rebuilding package ${packageName} on ${instance} instance`);
            
            try {
                // Construct the expected package path (assuming default group 'aem-starter')
                const packagePath = `/etc/packages/aem-starter/${packageName}.zip`;
                
                // Build the package
                const buildUrl = `http://${host}:${port}/crx/packmgr/service/.json${packagePath}?cmd=build`;
                console.log(`[PackageManager] Building package: ${buildUrl}`);
                
                const buildResponse = await fetch(buildUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
                    }
                });
                
                const buildResponseText = await buildResponse.text();
                console.log(`[PackageManager] Build response status: ${buildResponse.status}`);
                console.log(`[PackageManager] Build response text:`, buildResponseText);
                
                if (!buildResponse.ok) {
                    throw new Error(`Failed to build package: ${buildResponse.status} ${buildResponse.statusText}. Response: ${buildResponseText}`);
                }
                
                // Download the built package
                const downloadUrl = `http://${host}:${port}${packagePath}`;
                const tempPackagePath = path.join(packageDir, `${packageName}.zip`);
                console.log(`[PackageManager] Downloading package from ${downloadUrl} to ${tempPackagePath}`);
                await this.atomicDownloadWithAuth(downloadUrl, tempPackagePath);
                
                console.log(`[PackageManager] Successfully rebuilt and downloaded package: ${packageName}`);
                
            } catch (error) {
                console.error(`[PackageManager] Error rebuilding/downloading package ${packageName}:`, error);
                throw error;
            }
        }
    }

    public async createPackage(name: string, instances: string[], paths: string[]): Promise<void> {
        // Create packages directory if it doesn't exist
        const packagesDir = path.join(this.project.folderPath, 'packages');
        if (!fs.existsSync(packagesDir)) {
            fs.mkdirSync(packagesDir, { recursive: true });
            console.log(`[PackageManager] Created packages directory: ${packagesDir}`);
        }

        // Create package-specific directory
        const packageDir = path.join(packagesDir, name);
        if (fs.existsSync(packageDir)) {
            throw new Error(`Package '${name}' already exists. Please choose a different name.`);
        }
        fs.mkdirSync(packageDir, { recursive: true });
        console.log(`[PackageManager] Created package directory: ${packageDir}`);

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
            
            console.log(`[PackageManager] Creating package ${packageName} with paths: ${paths.join(', ')} on ${instance} instance`);
            
            try {
                // Create package zip with filter.xml
                const packageBuffer = this.createPackageZip(packageName, paths);
                
                // Save package locally first for debugging
                const tempPackagePath = path.join(packageDir, `${packageName}.zip`);
                fs.writeFileSync(tempPackagePath, packageBuffer);
                console.log(`[PackageManager] Created package zip at: ${tempPackagePath}`);
                console.log(`[PackageManager] Package size: ${packageBuffer.length} bytes`);
                
                // Debug: Check zip contents
                try {
                    const testZip = new AdmZip(tempPackagePath);
                    const entries = testZip.getEntries();
                    console.log(`[PackageManager] Zip contains ${entries.length} entries:`);
                    entries.forEach(entry => {
                        console.log(`  - ${entry.entryName} (${entry.header.size} bytes)`);
                    });
                } catch (zipError) {
                    console.error(`[PackageManager] Error reading zip contents:`, zipError);
                }
                
                // Upload package to package manager using proper form data
                const boundary = `----WebKitFormBoundary${randomUUID()}`;
                const formData = this.createSimpleMultipartFormData(boundary, packageBuffer, `${packageName}.zip`);
                
                const uploadUrl = `http://${host}:${port}/crx/packmgr/service/.json`;
                console.log(`[PackageManager] Uploading package to: ${uploadUrl}`);
                console.log(`[PackageManager] Form data size: ${formData.length} bytes`);
                console.log(`[PackageManager] Boundary: ${boundary}`);
                
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                        'Content-Type': `multipart/form-data; boundary=${boundary}`
                    },
                    body: formData
                });
                
                const uploadResponseText = await uploadResponse.text();
                console.log(`[PackageManager] Upload response status: ${uploadResponse.status}`);
                console.log(`[PackageManager] Upload response text:`, uploadResponseText);
                
                if (!uploadResponse.ok) {
                    throw new Error(`Failed to upload package: ${uploadResponse.status} ${uploadResponse.statusText}. Response: ${uploadResponseText}`);
                }
                
                // Extract package path from response
                let packagePath;
                try {
                    const responseJson = JSON.parse(uploadResponseText);
                    if (responseJson.success && responseJson.path) {
                        packagePath = responseJson.path;
                        console.log(`[PackageManager] Package uploaded to: ${packagePath}`);
                    } else {
                        throw new Error(`Upload response indicates failure: ${uploadResponseText}`);
                    }
                } catch (parseError) {
                    console.log(`[PackageManager] Could not parse upload response as JSON, trying to extract path from HTML response`);
                    // Try to extract path from HTML response
                    const pathMatch = uploadResponseText.match(/\/etc\/packages\/[^"]+\.zip/);
                    if (pathMatch) {
                        packagePath = pathMatch[0];
                        console.log(`[PackageManager] Extracted package path: ${packagePath}`);
                    } else {
                        throw new Error(`Could not determine package path from upload response: ${uploadResponseText}`);
                    }
                }
                
                // Build the package
                const buildUrl = `http://${host}:${port}/crx/packmgr/service/.json${packagePath}?cmd=build`;
                console.log(`[PackageManager] Building package: ${buildUrl}`);
                
                const buildResponse = await fetch(buildUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
                    }
                });
                
                const buildResponseText = await buildResponse.text();
                console.log(`[PackageManager] Build response status: ${buildResponse.status}`);
                console.log(`[PackageManager] Build response text:`, buildResponseText);
                
                if (!buildResponse.ok) {
                    throw new Error(`Failed to build package: ${buildResponse.status} ${buildResponse.statusText}. Response: ${buildResponseText}`);
                }
                
                // Download the built package
                const downloadUrl = `http://${host}:${port}${packagePath}`;
                console.log(`[PackageManager] Downloading package from ${downloadUrl} to ${tempPackagePath}`);
                await this.atomicDownloadWithAuth(downloadUrl, tempPackagePath);
                
                console.log(`[PackageManager] Successfully created, built and downloaded package: ${packageName}`);
                
            } catch (error) {
                console.error(`[PackageManager] Error creating/building/downloading package ${packageName}:`, error);
                throw error;
            }
        }
    }

    public async listPackages(): Promise<PackageInfo[]> {
        const packagesDir = path.join(this.project.folderPath, 'packages');
        if (!fs.existsSync(packagesDir)) {
            return [];
        }

        const packages: PackageInfo[] = [];
        for (const packageFolder of fs.readdirSync(packagesDir)) {
            const packageFolderPath = path.join(packagesDir, packageFolder);
            
            // Skip if not a directory
            if (!fs.statSync(packageFolderPath).isDirectory()) {
                continue;
            }
            
            try {
                // Check for author and publisher zip files
                const authorZipPath = path.join(packageFolderPath, `${packageFolder}-author.zip`);
                const publisherZipPath = path.join(packageFolderPath, `${packageFolder}-publisher.zip`);
                
                const hasAuthor = fs.existsSync(authorZipPath);
                const hasPublisher = fs.existsSync(publisherZipPath);
                
                // Get file sizes
                let authorSize: number | undefined;
                let publisherSize: number | undefined;
                
                if (hasAuthor) {
                    try {
                        const authorStats = fs.statSync(authorZipPath);
                        authorSize = authorStats.size;
                    } catch (error) {
                        console.error(`[PackageManager] Error getting author package size for ${packageFolder}:`, error);
                    }
                }
                
                if (hasPublisher) {
                    try {
                        const publisherStats = fs.statSync(publisherZipPath);
                        publisherSize = publisherStats.size;
                    } catch (error) {
                        console.error(`[PackageManager] Error getting publisher package size for ${packageFolder}:`, error);
                    }
                }
                
                // Get folder creation date
                const stats = fs.statSync(packageFolderPath);
                
                // Extract paths from one of the zip files (they should be the same)
                const paths: string[] = [];
                let zipToRead = hasAuthor ? authorZipPath : (hasPublisher ? publisherZipPath : null);
                
                if (zipToRead) {
                    try {
                        const zip = new AdmZip(zipToRead);
                        const entries = zip.getEntries();
                        const filterEntry = entries.find(entry => entry.entryName === 'META-INF/vault/filter.xml');
                        
                        if (filterEntry) {
                            try {
                                let filterXmlContent: string;
                                
                                if (filterEntry.data) {
                                    // Try the direct data approach first
                                    filterXmlContent = filterEntry.data.toString('utf8');
                                } else {
                                    // Try alternative method using zip.readFile()
                                    const data = zip.readFile('META-INF/vault/filter.xml');
                                    if (data) {
                                        filterXmlContent = data.toString('utf8');
                                    } else {
                                        throw new Error('Could not read filter.xml content using any method');
                                    }
                                }
                                
                                const pathsMatch = filterXmlContent.match(/<filter root="([^"]+)"/g);
                                if (pathsMatch) {
                                    for (const match of pathsMatch) {
                                        const pathMatch = match.match(/root="([^"]+)"/);
                                        if (pathMatch) {
                                            paths.push(pathMatch[1]);
                                        }
                                    }
                                }
                            } catch (filterError) {
                                console.error(`[PackageManager] Error reading filter.xml content for ${packageFolder}:`, filterError);
                            }
                        }
                    } catch (zipError) {
                        console.error(`[PackageManager] Error reading zip file for ${packageFolder}:`, zipError);
                    }
                }
                
                packages.push({
                    name: packageFolder,
                    createdDate: stats.birthtime || stats.ctime,
                    paths: paths,
                    hasAuthor: hasAuthor,
                    hasPublisher: hasPublisher,
                    authorSize: authorSize,
                    publisherSize: publisherSize
                });
            } catch (error) {
                console.error(`[PackageManager] Error reading package folder ${packageFolder}:`, error);
                // Still add the package with basic info if folder reading fails
                try {
                    const stats = fs.statSync(packageFolderPath);
                    packages.push({
                        name: packageFolder,
                        createdDate: stats.birthtime || stats.ctime,
                        paths: [],
                        hasAuthor: false,
                        hasPublisher: false
                    });
                } catch (statsError) {
                    console.error(`[PackageManager] Error getting stats for ${packageFolder}:`, statsError);
                }
            }
        }
        return packages;
    }

    public async deletePackage(packageName: string): Promise<void> {
        const packagesDir = path.join(this.project.folderPath, 'packages');
        const packageFolderPath = path.join(packagesDir, packageName);
        
        if (fs.existsSync(packageFolderPath)) {
            // Remove the entire package folder and its contents
            fs.rmSync(packageFolderPath, { recursive: true, force: true });
            console.log(`[PackageManager] Deleted package folder: ${packageName}`);
        } else {
            console.log(`[PackageManager] Package folder not found: ${packageName}`);
        }
    }

    async installPackage(instance: 'author' | 'publisher', packageName: string): Promise<void> {
        const packagesDir = path.join(this.project.folderPath, 'packages');
        const packageFolderPath = path.join(packagesDir, packageName);
        const zipFileName = `${packageName}-${instance}.zip`;
        const zipFilePath = path.join(packageFolderPath, zipFileName);

        if (!fs.existsSync(zipFilePath)) {
            throw new Error(`Package file not found: ${zipFilePath}`);
        }

        console.log(`[PackageManager] Installing package ${packageName} for ${instance} instance from ${zipFilePath}`);
        return this.installPackageFromFile(instance, zipFilePath);
    }

    async installPackageAll(packageName: string): Promise<void> {
        const packagesDir = path.join(this.project.folderPath, 'packages');
        const packageFolderPath = path.join(packagesDir, packageName);
        
        const authorZipPath = path.join(packageFolderPath, `${packageName}-author.zip`);
        const publisherZipPath = path.join(packageFolderPath, `${packageName}-publisher.zip`);
        
        const promises: Promise<void>[] = [];
        
        if (fs.existsSync(authorZipPath)) {
            promises.push(this.installPackageFromFile('author', authorZipPath));
        }
        
        if (fs.existsSync(publisherZipPath)) {
            promises.push(this.installPackageFromFile('publisher', publisherZipPath));
        }
        
        if (promises.length === 0) {
            throw new Error(`No package files found for: ${packageName}`);
        }
        
        await Promise.all(promises);
        console.log(`[PackageManager] Successfully installed all packages for ${packageName}`);
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

        console.log(`[PackageManager] Installing package on ${instance} instance (${host}:${port})`);
        
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
            console.log(`[PackageManager] Installing package to: ${url}`);

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
            console.log(`[PackageManager] Installation response:`, responseText);
            console.log(`[PackageManager] Successfully installed package on ${instance} instance`);
            
        } catch (error) {
            console.error(`[PackageManager] Error installing package:`, error);
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
