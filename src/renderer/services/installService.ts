import { Project } from '../../types/Project';

export class InstallService {
  static async installAEM(project: Project): Promise<void> {
    // Check if license.properties exists
    const licensePath = project.licensePath;
    const licenseExists = await window.electronAPI.checkFileExists(licensePath);
    if (!licenseExists) {
      throw new Error('license.properties file not found ' + licensePath);
    }

    // Check if SDK package exists
    const sdkPath = project.aemSdkPath;
    const sdkExists = await window.electronAPI.checkFileExists(sdkPath);
    if (!sdkExists) {
      throw new Error('aem-sdk.zip file not found in project folder');
    }

    // Create required folders
    const folders = ['author', 'publish', 'dispatcher', 'install'];
    for (const folder of folders) {
      const folderPath = `${project.folderPath}/${folder}`;
      try {
        await window.electronAPI.createDirectory(folderPath);
      } catch (error) {
        console.error(`Error creating directory ${folder}:`, error);
        // Continue with other folders even if one fails
      }
    }

    // Copy license.properties to author and publish
    try {
      await window.electronAPI.copyFile(licensePath, `${project.folderPath}/author/license.properties`);
      await window.electronAPI.copyFile(licensePath, `${project.folderPath}/publish/license.properties`);
    } catch (error) {
      console.error('Error copying license file:', error);
      throw new Error('Failed to copy license.properties to author and publish folders');
    }

    // Unzip SDK package to install folder
    try {
      await window.electronAPI.unzipFile(sdkPath, `${project.folderPath}/install`);
    } catch (error) {
      console.error('Error unzipping SDK:', error);
      throw new Error('Failed to unzip SDK package');
    }
  }
} 