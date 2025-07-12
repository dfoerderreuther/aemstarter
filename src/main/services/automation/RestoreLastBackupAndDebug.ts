import { RestoreLastBackupAndRun } from "./RestoreLastBackupAndRun";


export class RestoreLastBackupAndDebug extends RestoreLastBackupAndRun {

    protected async start() {
        await this.startStopService.startDebug();
    }
}