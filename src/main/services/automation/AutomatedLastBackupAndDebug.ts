import { AutomatedLastBackupAndRun } from "./AutomatedLastBackupAndRun";


export class AutomatedLastBackupAndDebug extends AutomatedLastBackupAndRun {

    protected async start() {
        await this.aemInstanceManager.startInstance('author', 'debug')
        await this.aemInstanceManager.startInstance('publisher', 'debug')
        await this.dispatcherManager.startDispatcher()
    }
}