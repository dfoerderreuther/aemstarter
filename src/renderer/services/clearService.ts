import { Project } from '../../types/Project';

export class ClearService {
  static async clearAEM(project: Project): Promise<void> {
    const folders = ['author', 'publish', 'dispatcher', 'install'];
    
    for (const folder of folders) {
      const folderPath = `${project.folderPath}/${folder}`;
      try {
        const exists = await window.electronAPI.checkFileExists(folderPath);
        if (exists) {
          await window.electronAPI.deleteDirectory(folderPath);
        }
      } catch (error) {
        console.error(`Error checking directory ${folder}:`, error);
        throw new Error(`Failed to check ${folder} directory`);
      }
    }
  }
} 