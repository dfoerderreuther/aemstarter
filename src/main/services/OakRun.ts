import { Project } from "../../types/Project";
import path from 'path';
import { exec } from 'child_process';


export class OakRun {
    private project: Project;

    constructor(private project: Project) {
        this.project = project;
    }

    compact(instance: 'author' | 'publisher'): void {
        const instanceDir = instance === 'author' ? 'author' : 'publisher';
        const oakRunJar = path.join(this.project.folderPath, 'install', 'oak-run.jar');
        const command = `java  -Xss16m -Xmx8g -jar ${oakRunJar} compact ${instanceDir}/crx-quickstart/repository/segmentstore`;
        exec(command);
    }

}