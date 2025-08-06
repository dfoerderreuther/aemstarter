import { Project } from "../../types/Project";
import { PackageInfo } from "../../types/PackageInfo";
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';
import log from 'electron-log';

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
            log.info(`[PackageManager] Created packages directory: ${packagesDir}`);
        }

        // Create package-specific directory
        const packageDir = path.join(packagesDir, name);
        if (!fs.existsSync(packageDir)) {
            fs.mkdirSync(packageDir, { recursive: true });
            log.info(`[PackageManager] Created package directory: ${packageDir}`);
        }

        // Load package metadata to get actual AEM paths
        const metadataPath = path.join(packageDir, 'package.json');
        let packageMetadata: any = {};
        
        if (fs.existsSync(metadataPath)) {
            try {
                const metadataContent = fs.readFileSync(metadataPath, 'utf8');
                packageMetadata = JSON.parse(metadataContent);
                log.info(`[PackageManager] Loaded package metadata from: ${metadataPath}`);
            } catch (error) {
                log.error(`[PackageManager] Error loading package metadata:`, error);
                log.info(`[PackageManager] Will use fallback path construction`);
            }
        } else {
            log.info(`[PackageManager] No metadata file found, using fallback path construction`);
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
            
            log.info(`[PackageManager] Rebuilding package ${packageName} on ${instance} instance`);
            
            try {
                // Get the actual AEM package path from metadata, or fall back to constructed path
                let packagePath;
                if (instance === 'author' && packageMetadata.authorAemPath) {
                    packagePath = packageMetadata.authorAemPath;
                    log.info(`[PackageManager] Using stored author AEM path: ${packagePath}`);
                } else if (instance === 'publisher' && packageMetadata.publisherAemPath) {
                    packagePath = packageMetadata.publisherAemPath;
                    log.info(`[PackageManager] Using stored publisher AEM path: ${packagePath}`);
                } else {
                    // Fallback to constructed path for backward compatibility
                    packagePath = `/etc/packages/aem-starter/${packageName}.zip`;
                    log.info(`[PackageManager] Using fallback path: ${packagePath}`);
                }
                
                // Build the package
                const buildUrl = `http://${host}:${port}/crx/packmgr/service/.json${packagePath}?cmd=build`;
                log.info(`[PackageManager] Building package: ${buildUrl}`);
                
                const buildResponse = await fetch(buildUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
                    }
                });
                
                const buildResponseText = await buildResponse.text();
                log.info(`[PackageManager] Build response status: ${buildResponse.status}`);
                log.info(`[PackageManager] Build response text:`, buildResponseText);
                
                if (!buildResponse.ok) {
                    throw new Error(`Failed to build package: ${buildResponse.status} ${buildResponse.statusText}. Response: ${buildResponseText}`);
                }
                
                // Download the built package
                const downloadUrl = `http://${host}:${port}${packagePath}`;
                const tempPackagePath = path.join(packageDir, `${packageName}.zip`);
                log.info(`[PackageManager] Downloading package from ${downloadUrl} to ${tempPackagePath}`);
                await this.atomicDownloadWithAuth(downloadUrl, tempPackagePath);
                
                log.info(`[PackageManager] Successfully rebuilt and downloaded package: ${packageName}`);
                
            } catch (error) {
                log.error(`[PackageManager] Error rebuilding/downloading package ${packageName}:`, error);
                throw error;
            }
        }
    }

    public async createPackage(name: string, instance: string, paths: string[]): Promise<void> {
        // Create packages directory if it doesn't exist
        const packagesDir = path.join(this.project.folderPath, 'packages');
        if (!fs.existsSync(packagesDir)) {
            fs.mkdirSync(packagesDir, { recursive: true });
            log.info(`[PackageManager] Created packages directory: ${packagesDir}`);
        }

        // Check if package already exists
        const packagePath = path.join(packagesDir, `${name}.zip`);
        if (fs.existsSync(packagePath)) {
            throw new Error(`Package '${name}' already exists. Please choose a different name.`);
        }

        // Get instance settings
        const settings = this.project.settings;
        const instanceKey = instance as 'author' | 'publisher';
        const instanceSettings = settings[instanceKey];
        if (!instanceSettings) {
            throw new Error(`Instance settings not found for: ${instance}`);
        }
        
        const port = instanceSettings.port;
        const host = 'localhost';
        
        log.info(`[PackageManager] Creating package ${name} with paths: ${paths.join(', ')} from ${instance} instance`);
        
        try {
            // Create package zip with filter.xml
            const packageBuffer = this.createPackageZip(name, paths);
            
            // Save package locally first for debugging
            fs.writeFileSync(packagePath, packageBuffer);
            log.info(`[PackageManager] Created package zip at: ${packagePath}`);
            log.info(`[PackageManager] Package size: ${packageBuffer.length} bytes`);
            
            // Debug: Check zip contents
            try {
                const testZip = new AdmZip(packagePath);
                const entries = testZip.getEntries();
                log.info(`[PackageManager] Zip contains ${entries.length} entries:`);
                entries.forEach(entry => {
                    log.info(`  - ${entry.entryName} (${entry.header.size} bytes)`);
                });
            } catch (zipError) {
                log.error(`[PackageManager] Error reading zip contents:`, zipError);
            }
            
            // Upload package to package manager using proper form data
            const boundary = `----WebKitFormBoundary${randomUUID()}`;
            const formData = this.createSimpleMultipartFormData(boundary, packageBuffer, `${name}.zip`);
            
            const uploadUrl = `http://${host}:${port}/crx/packmgr/service/.json`;
            log.info(`[PackageManager] Uploading package to: ${uploadUrl}`);
            log.info(`[PackageManager] Form data size: ${formData.length} bytes`);
            log.info(`[PackageManager] Boundary: ${boundary}`);
            
            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: formData
            });
            
            const uploadResponseText = await uploadResponse.text();
            log.info(`[PackageManager] Upload response status: ${uploadResponse.status}`);
            log.info(`[PackageManager] Upload response text:`, uploadResponseText);
            
            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload package: ${uploadResponse.status} ${uploadResponse.statusText}. Response: ${uploadResponseText}`);
            }
            
            // Extract package path from response
            let aemPackagePath;
            try {
                const responseJson = JSON.parse(uploadResponseText);
                if (responseJson.success && responseJson.path) {
                    aemPackagePath = responseJson.path;
                    log.info(`[PackageManager] Package uploaded to: ${aemPackagePath}`);
                } else {
                    throw new Error(`Upload response indicates failure: ${uploadResponseText}`);
                }
            } catch (parseError) {
                log.info(`[PackageManager] Could not parse upload response as JSON, trying to extract path from HTML response`);
                // Try to extract path from HTML response
                const pathMatch = uploadResponseText.match(/\/etc\/packages\/[^"]+\.zip/);
                if (pathMatch) {
                    aemPackagePath = pathMatch[0];
                    log.info(`[PackageManager] Extracted package path: ${aemPackagePath}`);
                } else {
                    throw new Error(`Could not determine package path from upload response: ${uploadResponseText}`);
                }
            }
            
            // Build the package
            const buildUrl = `http://${host}:${port}/crx/packmgr/service/.json${aemPackagePath}?cmd=build`;
            log.info(`[PackageManager] Building package: ${buildUrl}`);
            
            const buildResponse = await fetch(buildUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
                }
            });
            
            const buildResponseText = await buildResponse.text();
            log.info(`[PackageManager] Build response status: ${buildResponse.status}`);
            log.info(`[PackageManager] Build response text:`, buildResponseText);
            
            if (!buildResponse.ok) {
                throw new Error(`Failed to build package: ${buildResponse.status} ${buildResponse.statusText}. Response: ${buildResponseText}`);
            }
            
            // Download the built package
            const downloadUrl = `http://${host}:${port}${aemPackagePath}`;
            log.info(`[PackageManager] Downloading package from ${downloadUrl} to ${packagePath}`);
            await this.atomicDownloadWithAuth(downloadUrl, packagePath);
            
            log.info(`[PackageManager] Successfully created, built and downloaded package: ${name}`);
            
        } catch (error) {
            log.error(`[PackageManager] Error creating/building/downloading package ${name}:`, error);
            throw error;
        }
    }

    public async listPackages(): Promise<PackageInfo[]> {
        const packagesDir = path.join(this.project.folderPath, 'packages');
        if (!fs.existsSync(packagesDir)) {
            return [];
        }

        const packages: PackageInfo[] = [];
        for (const fileName of fs.readdirSync(packagesDir)) {
            const filePath = path.join(packagesDir, fileName);
            
            // Skip if not a zip file
            if (!fileName.endsWith('.zip') || !fs.statSync(filePath).isFile()) {
                continue;
            }
            
            try {
                // Get package name without .zip extension
                const packageName = fileName.replace('.zip', '');
                
                // Get file stats
                const stats = fs.statSync(filePath);
                
                // Extract paths from filter.xml in the zip file
                const paths: string[] = [];
                try {
                    const zip = new AdmZip(filePath);
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
                            log.error(`[PackageManager] Error reading filter.xml content for ${packageName}:`, filterError);
                        }
                    }
                } catch (zipError) {
                    log.error(`[PackageManager] Error reading zip file for ${packageName}:`, zipError);
                }
                
                packages.push({
                    name: packageName,
                    createdDate: stats.birthtime || stats.ctime,
                    paths: paths,
                    size: stats.size
                });
            } catch (error) {
                log.error(`[PackageManager] Error reading package file ${fileName}:`, error);
            }
        }
        return packages;
    }

    public async deletePackage(packageName: string): Promise<void> {
        const packagesDir = path.join(this.project.folderPath, 'packages');
        const packageFilePath = path.join(packagesDir, `${packageName}.zip`);
        
        if (fs.existsSync(packageFilePath)) {
            fs.unlinkSync(packageFilePath);
            log.info(`[PackageManager] Deleted package file: ${packageName}.zip`);
        } else {
            log.info(`[PackageManager] Package file not found: ${packageName}.zip`);
        }
    }

    public async downloadWebPackage(packageUrl: string): Promise<string> {
        // Create packages directory if it doesn't exist
        const packagesDir = path.join(this.project.folderPath, 'packages');
        if (!fs.existsSync(packagesDir)) {
            fs.mkdirSync(packagesDir, { recursive: true });
            log.info(`[PackageManager] Created packages directory: ${packagesDir}`);
        }

        // Extract filename from URL (use original filename)
        const fileName = path.basename(packageUrl);
        const filePath = path.join(packagesDir, fileName);

        log.info(`[PackageManager] Downloading web package from ${packageUrl} to ${filePath}`);

        try {
            // Download the package
            await this.atomicDownloadWithAuth(packageUrl, filePath);
            log.info(`[PackageManager] Successfully downloaded web package: ${fileName}`);
            return path.basename(filePath, '.zip'); // Return package name without extension
        } catch (error) {
            log.error(`[PackageManager] Error downloading web package:`, error);
            throw error;
        }
    }

    public async importPackage(sourceFilePath: string): Promise<string> {
        // Create packages directory if it doesn't exist
        const packagesDir = path.join(this.project.folderPath, 'packages');
        if (!fs.existsSync(packagesDir)) {
            fs.mkdirSync(packagesDir, { recursive: true });
            log.info(`[PackageManager] Created packages directory: ${packagesDir}`);
        }

        // Verify source file exists
        if (!fs.existsSync(sourceFilePath)) {
            throw new Error(`Source package file not found: ${sourceFilePath}`);
        }

        // Extract filename from source path
        const fileName = path.basename(sourceFilePath);
        const targetFilePath = path.join(packagesDir, fileName);

        log.info(`[PackageManager] Importing package from ${sourceFilePath} to ${targetFilePath}`);

        try {
            // Check if target file already exists
            if (fs.existsSync(targetFilePath)) {
                // Generate unique filename if file already exists
                const nameWithoutExt = path.basename(fileName, '.zip');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const uniqueFileName = `${nameWithoutExt}-${timestamp}.zip`;
                const uniqueTargetPath = path.join(packagesDir, uniqueFileName);
                
                log.info(`[PackageManager] Target file exists, using unique name: ${uniqueFileName}`);
                fs.copyFileSync(sourceFilePath, uniqueTargetPath);
                log.info(`[PackageManager] Successfully imported package: ${uniqueFileName}`);
                return path.basename(uniqueTargetPath, '.zip'); // Return package name without extension
            } else {
                // Copy the file to packages directory
                fs.copyFileSync(sourceFilePath, targetFilePath);
                log.info(`[PackageManager] Successfully imported package: ${fileName}`);
                return path.basename(targetFilePath, '.zip'); // Return package name without extension
            }
        } catch (error) {
            log.error(`[PackageManager] Error importing package:`, error);
            throw error;
        }
    }



    async installPackage(instance: 'author' | 'publisher', packageName: string): Promise<void> {
        const packagesDir = path.join(this.project.folderPath, 'packages');
        const zipFilePath = path.join(packagesDir, `${packageName}.zip`);

        if (!fs.existsSync(zipFilePath)) {
            throw new Error(`Package file not found: ${zipFilePath}`);
        }

        log.info(`[PackageManager] Installing package ${packageName} to ${instance} instance from ${zipFilePath}`);
        return this.installPackageFromFile(instance, zipFilePath);
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

        log.info(`[PackageManager] Installing package on ${instance} instance (${host}:${port})`);
        
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
            log.info(`[PackageManager] Installing package to: ${url}`);

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
            log.info(`[PackageManager] Installation response:`, responseText);
            log.info(`[PackageManager] Successfully installed package on ${instance} instance`);
            
        } catch (error) {
            log.error(`[PackageManager] Error installing package:`, error);
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
