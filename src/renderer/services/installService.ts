import { Project } from '../../types/Project';

export class InstallService {
  static async installAEM(project: Project): Promise<void> {
    await window.electronAPI.installAEM(project);
  }
} 