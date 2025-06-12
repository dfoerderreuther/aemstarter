import { AutomatedLastBackupAndRun } from "./AutomatedLastBackupAndRun";


export class AutomatedLastBackupAndDebug extends AutomatedLastBackupAndRun {

    protected async start() {
        const startPromises: Promise<void>[] = [];
        startPromises.push(this.aemInstanceManager.startInstance('author', 'debug'))
        startPromises.push(this.aemInstanceManager.startInstance('publisher', 'debug'))
        startPromises.push(this.dispatcherManager.startDispatcher())
        await Promise.all(startPromises);
    }
}