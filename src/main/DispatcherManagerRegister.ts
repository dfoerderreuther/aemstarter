import { Project } from "../types/Project";
import { DispatcherManager } from "./services/DispatcherManager";

export class DispatcherManagerRegister {

    private static managers: Map<string, DispatcherManager> = new Map();

    static getManager(project: Project) : DispatcherManager {
        let manager = this.managers.get(project.id);
        if (!manager) {
            manager = new DispatcherManager(project);
            this.managers.set(project.id, manager);
        }
        return manager;
    }

    static updateProjectReference(project: Project): void {
        const manager = this.managers.get(project.id);
        if (manager) {
            manager.updateProject(project);
        }
    }
}