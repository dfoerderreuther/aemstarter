import { Project } from "../../../types/Project";
import { AutoTask } from "./Automation";

export class AutomatedLastBackupAndRun implements AutoTask {

    public project: Project;

    public constructor(project: Project) {
        this.project = project;
    }

    public async run() : Promise<void> {
        // Implementation will go here
        console.log('Running automated last backup and run...');
        console.log('not implemented yet');
    }
}