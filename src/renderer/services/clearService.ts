import { Project } from '../../types/Project';

export class ClearService {
  static async clearAEM(project: Project): Promise<void> {
    await window.electronAPI.deleteAEM(project);
  }
} 