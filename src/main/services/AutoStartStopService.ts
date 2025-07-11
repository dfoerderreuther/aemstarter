import { Project } from "../../types/Project";
import { AemInstanceManagerRegister } from "../AemInstanceManagerRegister";
import { DispatcherManagerRegister } from "../DispatcherManagerRegister";
import { AemInstanceManager } from "./AemInstanceManager";
import { DispatcherManager } from "./DispatcherManager";
import { HttpsService } from "./HttpsService";
import { HttpsServiceRegister } from "../HttpsServiceRegister";

export class AutoStartStopService {

    public project: Project;
    protected aemInstanceManager: AemInstanceManager;
    protected dispatcherManager: DispatcherManager;
    protected httpsService: HttpsService;

    public constructor(project: Project) {
        this.project = project;
        this.aemInstanceManager = AemInstanceManagerRegister.getInstanceManager(this.project);
        this.dispatcherManager = DispatcherManagerRegister.getManager(this.project);
        this.httpsService = HttpsServiceRegister.getService(this.project);
    }

    public async start() {
        const startPromises: Promise<void>[] = [];
        startPromises.push(this.aemInstanceManager.startInstance('author', 'start'))
        startPromises.push(this.aemInstanceManager.startInstance('publisher', 'start'))
        startPromises.push(this.dispatcherManager.startDispatcher())
        if (this.project.settings?.https?.enabled || false) {
            startPromises.push(this.httpsService.startSslProxy());
        }
        await Promise.all(startPromises);
    }
    
    public async startDebug() {
        const startPromises: Promise<void>[] = [];
        startPromises.push(this.aemInstanceManager.startInstance('author', 'debug'))
        startPromises.push(this.aemInstanceManager.startInstance('publisher', 'debug'))
        startPromises.push(this.dispatcherManager.startDispatcher())
        if (this.project.settings?.https?.enabled || false) {
            startPromises.push(this.httpsService.startSslProxy());
        }
        await Promise.all(startPromises);
    }

    public async stop() {
        const stopPromises: Promise<void>[] = [];
        
        if (this.aemInstanceManager.isInstanceRunning('author')) {
            stopPromises.push(this.aemInstanceManager.stopInstance('author'));
        }
        if (this.aemInstanceManager.isInstanceRunning('publisher')) {
            stopPromises.push(this.aemInstanceManager.stopInstance('publisher'));
        }
        if (this.dispatcherManager.isDispatcherRunning()) {
            stopPromises.push(this.dispatcherManager.stopDispatcher());
        }
        if (this.project.settings?.https?.enabled || false) {
            stopPromises.push(this.httpsService.stopSslProxy());
        }
        await Promise.all(stopPromises);
    }

}