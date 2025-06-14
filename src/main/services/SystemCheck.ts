import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';
import { SystemCheckResults } from '../../types/SystemCheckResults';
import { EditorAvailableResults } from '../../types/EditorAvailableResults';
import { ProjectSettings } from '../../types/Project';

const execAsync = promisify(exec);

export class SystemCheck {

    async runAllChecks(settings: ProjectSettings): Promise<SystemCheckResults> {
        const javaAvailable = await this.checkJavaAvailability();
        const javaVersion = await this.checkJavaVersion();
        const dockerAvailable = await this.checkDockerAvailability();
        const dockerDaemonRunning = await this.checkDockerDaemonRunning();
        const dockerVersion = await this.checkDockerVersion();
        const portDispatcherAvailable = await this.checkPortDispatcherAvailable(settings);
        const portAuthorAvailable = await this.checkportAuthorAvailable(settings);
        const portPublisherAvailable = await this.checkportPublisherAvailable(settings);
        const portAuthorDebugAvailable = await this.checkPortAuthorDebugAvailable(settings);
        const portPublisherDebugAvailable = await this.checkPortPublisherDebugAvailable(settings);

        return {
            javaAvailable,
            javaVersion,
            dockerAvailable,
            dockerDaemonRunning,
            dockerVersion,
            portDispatcherAvailable,
            portAuthorAvailable,
            portPublisherAvailable,
            portAuthorDebugAvailable,
            portPublisherDebugAvailable
        };
    }

    async checkEditorAvailability(): Promise<EditorAvailableResults> {
        return {
            visualStudioCode: await this.checkAvailability('code --version'),
            cursor: await this.checkAvailability('cursor --version'),
            idea: await this.checkAvailability('idea --version')
        };
    }

    private async checkJavaAvailability(): Promise<boolean> {
        return this.checkAvailability('java -version');
    }

    private async checkAvailability(command: string): Promise<boolean> {
        try {
            await execAsync(command);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async checkJavaVersion(): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync('java -version');
            const versionOutput = stderr || stdout;
            
            // Extract version from the output
            const versionMatch = versionOutput.match(/version "([^"]+)"/);
            if (versionMatch) {
                return versionMatch[1];
            }
            
            // Fallback to full output if version parsing fails
            return versionOutput.split('\n')[0].trim();
        } catch (error) {
            return 'Not available';
        }
    }

    private async checkDockerAvailability(): Promise<boolean> {
        return this.checkAvailability('docker --version');
    }

    private async checkDockerDaemonRunning(): Promise<boolean> {
        return this.checkAvailability('docker info');
    }

    private async checkDockerVersion(): Promise<string> {
        try {
            const { stdout } = await execAsync('docker --version');
            // Extract version from "Docker version X.X.X, build ..."
            const versionMatch = stdout.match(/Docker version ([^,]+)/);
            if (versionMatch) {
                return versionMatch[1];
            }
            return stdout.trim();
        } catch (error) {
            return 'Not available';
        }
    }

    private async checkPortAvailable(port: number): Promise<[number, boolean]> {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.listen(port, () => {
                server.once('close', () => {
                    resolve([port, true]);
                });
                server.close();
            });
            
            server.on('error', () => {
                resolve([port, false]);
            });
        });
    }

    private parseDebugPortFromJvmOpts(debugJvmOpts: string, defaultPort: number): number {
        // Parse the debug port from JVM options like:
        // " -server -Xdebug -agentlib:jdwp=transport=dt_socket,address=5005,suspend=n,server=y"
        const addressMatch = debugJvmOpts.match(/address=(\d+)/);
        if (addressMatch) {
            return parseInt(addressMatch[1], 10);
        }
        
        // Fallback to default port if parsing fails
        return defaultPort;
    }

    private async checkPortDispatcherAvailable(settings: ProjectSettings): Promise<[number, boolean]> {
        return this.checkPortAvailable(settings.dispatcher.port);
    }

    private async checkportAuthorAvailable(settings: ProjectSettings): Promise<[number, boolean]> {
        return this.checkPortAvailable(settings.author.port);
    }

    private async checkportPublisherAvailable(settings: ProjectSettings): Promise<[number, boolean]> {
        return this.checkPortAvailable(settings.publisher.port);
    }

    private async checkPortAuthorDebugAvailable(settings: ProjectSettings): Promise<[number, boolean]> {
        const debugPort = this.parseDebugPortFromJvmOpts(settings.author.debugJvmOpts, 5005);
        return this.checkPortAvailable(debugPort);
    }

    private async checkPortPublisherDebugAvailable(settings: ProjectSettings): Promise<[number, boolean]> {
        const debugPort = this.parseDebugPortFromJvmOpts(settings.publisher.debugJvmOpts, 5006);
        return this.checkPortAvailable(debugPort);
    }
}