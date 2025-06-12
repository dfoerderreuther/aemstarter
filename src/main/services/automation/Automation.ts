import { Project } from '../../../types/Project';
import { AutomatedLastBackupAndDebug } from './AutomatedLastBackupAndDebug';
import { AutomatedLastBackupAndRun } from './AutomatedLastBackupAndRun';
import { AutomatedReinstall } from './AutomatedReinstall';

export interface AutoTask {
    project: Project;
    run() : Promise<void>;
}

type AutoTaskConstructor = new (project: Project) => AutoTask;

export class Automation {

    private project: Project;

    private static taskRegistry: Map<string, AutoTaskConstructor> = new Map<string, AutoTaskConstructor>([
        ['last-backup-and-run', AutomatedLastBackupAndRun],
        ['last-backup-and-debug', AutomatedLastBackupAndDebug],
        ['reinstall', AutomatedReinstall]   
    ]);

    private constructor(project: Project) {
        this.project = project;
    }

    static async run(project: Project, type: string) : Promise<void> {
        const automation = new Automation(project);
        await automation.run(type);
    }

    private async run(type: string) : Promise<void> {
        const TaskConstructor = Automation.taskRegistry.get(type);
        if (TaskConstructor) {
            console.log(`[Automation] Running task: ${type}`);
            const task = new TaskConstructor(this.project);
            await task.run();
            console.log(`[Automation] Task ${type} completed`);
        } else {
            console.log(`[Automation] Unknown task: ${type}`);
        } 
    }

}