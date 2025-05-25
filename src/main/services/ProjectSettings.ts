import { Project } from '../../types/Project';
import fs from 'fs';
import path from 'path';

export class ProjectSettings {

    static SETTINGS_TEMPLATE = `
{
    "version": "1.0.0",
    "author": {
        "port": 4502,
        "runmode": "author,default",
        "jvmOpts": "-server -Xmx4096m -XX:MaxPermSize=256M -Djava.awt.headless=true",
        "debugJvmOpts": " -server -Xdebug -agentlib:jdwp=transport=dt_socket,address=5005,suspend=n,server=y"
    },
    "publisher": {
        "port": 4503,
        "runmode": "publish,default", 
        "jvmOpts": "-server -Xmx4096m -XX:MaxPermSize=256M -Djava.awt.headless=true",
        "debugJvmOpts": " -server -Xdebug -agentlib:jdwp=transport=dt_socket,address=5006,suspend=n,server=y"
    }
}
    `;

    static getSettings(project: Project) {
        const settingsPath = path.join(project.folderPath, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
        return JSON.parse(ProjectSettings.SETTINGS_TEMPLATE);
    }

    static saveSettings(project: Project, settings: any) {
        const settingsPath = path.join(project.folderPath, 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }


}