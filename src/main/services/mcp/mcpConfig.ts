/**
 * Resolve MCP tool config from live project settings, keyed by project id so any
 * settings change (ports, dispatcher folder) is picked up on the next tool call.
 */
import path from 'node:path';
import { Project } from '../../../types/Project';
import { ProjectManagerRegister } from '../../ProjectManagerRegister';
import { AemConfig } from './aemTools';
import { DispatcherConfig } from './dispatcherTools';

const AEM_AUTH = 'Basic ' + Buffer.from('admin:admin').toString('base64');

export function getProjectOrThrow(projectId: string): Project {
    const project = ProjectManagerRegister.getManager().getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return project;
}

export function resolveAemConfig(projectId: string, target: 'author' | 'publisher'): AemConfig {
    const project = getProjectOrThrow(projectId);
    const port = target === 'publisher'
        ? project.settings.publisher?.port ?? 4503
        : project.settings.author?.port ?? 4502;
    return { base: `http://localhost:${port}`, auth: AEM_AUTH };
}

export function resolveDispatcherConfig(projectId: string): DispatcherConfig {
    const project = getProjectOrThrow(projectId);
    return {
        dir: path.join(project.folderPath, 'dispatcher'),
        port: String(project.settings.dispatcher?.port ?? 80),
    };
}
