import { Project } from "../types/Project";
import { ProjectManager } from "./services/ProjectManager";

export class ProjectManagerRegister {

    private static projectManager: ProjectManager;

    static getManager() : ProjectManager {
        if (!this.projectManager) {
            this.projectManager = new ProjectManager();
        }
        return this.projectManager;
    }
}