import { Project } from "../types/Project";
import { AemInstanceManager } from "./services/AemInstanceManager";


export class AemInstanceManagerRegister {

    private static instanceManagers: Map<string, AemInstanceManager> = new Map();

    static getInstanceManager(project: Project) : AemInstanceManager {
        let manager = this.instanceManagers.get(project.id);
        if (!manager) {
            manager = new AemInstanceManager(project);
            this.instanceManagers.set(project.id, manager);
        }
        return manager;
    }
}