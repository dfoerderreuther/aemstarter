import { Project } from '../../../types/Project';
import { CreateBackupAndRun } from './CreateBackupAndRun';
import { RestoreFirstBackupAndRun } from './RestoreFirstBackupAndRun';
import { RestoreLastBackupAndDebug } from './RestoreLastBackupAndDebug';
import { RestoreLastBackupAndRun } from './RestoreLastBackupAndRun';
import { ReinstallAndRun } from './ReinstallAndRun';
import { BrowserWindow } from 'electron';
import { FirstStartAndInitialSetup } from './FirstStartAndInitialSetup';
import { UpdateSdkAndRun } from './UpdateSdkAndRun';

export interface AutoTask {
    project: Project;
    parameters?: { [key: string]: string | boolean | number };
    run(progressCallback?: (message: string) => void, parameters?: { [key: string]: string | boolean | number }) : Promise<void>;
}

type AutoTaskConstructor = new (project: Project) => AutoTask;

export class Automation {

    private project: Project;

    private static taskRegistry: Map<string, AutoTaskConstructor> = new Map<string, AutoTaskConstructor>([
        ['create-backup-and-run', CreateBackupAndRun],
        ['last-backup-and-run', RestoreLastBackupAndRun],
        ['last-backup-and-debug', RestoreLastBackupAndDebug],
        ['first-backup-and-run', RestoreFirstBackupAndRun],
        ['reinstall', ReinstallAndRun],
        ['first-start-and-initial-setup', FirstStartAndInitialSetup], 
        ['update-sdk-and-run', UpdateSdkAndRun]
    ]);

    private constructor(project: Project) {
        this.project = project;
    }

    static async run(project: Project, type: string, mainWindow?: BrowserWindow, parameters?: { [key: string]: string | boolean | number }) : Promise<void> {
        const automation = new Automation(project);
        await automation.run(type, mainWindow, parameters);
    }

    private async run(type: string, mainWindow?: BrowserWindow, parameters?: { [key: string]: string | boolean | number }) : Promise<void> {
        const TaskConstructor = Automation.taskRegistry.get(type);
        if (TaskConstructor) {
            console.log(`[Automation] Running task: ${type}${parameters ? ' with parameters: ' + JSON.stringify(parameters) : ''}`);
            
            // Create progress callback to send updates to frontend
            const progressCallback = (message: string) => {
                console.log(`[Automation] ${type}: ${message}`);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('automation-progress', {
                        projectId: this.project.id,
                        taskType: type,
                        message: message,
                        timestamp: new Date().toISOString()
                    });
                }
            };

            const task = new TaskConstructor(this.project);
            await task.run(progressCallback, parameters);
            
            console.log(`[Automation] Task ${type} completed`);
            progressCallback('Task completed successfully');
        } else {
            console.log(`[Automation] Unknown task: ${type}`);
        } 
    }

}