import { Project } from "../types/Project";
import { HttpsService } from "./services/HttpsService";
import { BrowserWindow } from 'electron';

export class HttpsServiceRegister {

    private static services: Map<string, HttpsService> = new Map();

    static getService(project: Project) : HttpsService {
        let service = this.services.get(project.id);
        if (!service) {
            service = new HttpsService(project);
            this.services.set(project.id, service);
        }
        return service;
    }

    static updateProjectReference(project: Project): void {
        const service = this.services.get(project.id);
        if (service) {
            service.updateProject(project);
        }
    }

    static setMainWindow(mainWindow: BrowserWindow): void {
        this.services.forEach(service => {
            service.setMainWindow(mainWindow);
        });
    }
} 