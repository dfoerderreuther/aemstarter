import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';
import { SystemCheckResults } from '../../types/SystemCheckResults';
import { EditorAvailableResults } from '../../types/EditorAvailableResults';

const execAsync = promisify(exec);

export class SystemCheck {

    async runAllChecks(): Promise<SystemCheckResults> {
        const javaAvailable = await this.checkJavaAvailability();
        const javaVersion = await this.checkJavaVersion();
        const dockerAvailable = await this.checkDockerAvailability();
        const dockerDaemonRunning = await this.checkDockerDaemonRunning();
        const dockerVersion = await this.checkDockerVersion();
        const port80Available = await this.checkPort80Available();
        const port4502Available = await this.checkPort4502Available();
        const port4503Available = await this.checkPort4503Available();
        const portAuthorDebugAvailable = await this.checkPortAuthorDebugAvailable();
        const portPublisherDebugAvailable = await this.checkPortPublisherDebugAvailable();

        return {
            javaAvailable,
            javaVersion,
            dockerAvailable,
            dockerDaemonRunning,
            dockerVersion,
            port80Available,
            port4502Available,
            port4503Available,
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

    private async checkPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.listen(port, () => {
                server.once('close', () => {
                    resolve(true);
                });
                server.close();
            });
            
            server.on('error', () => {
                resolve(false);
            });
        });
    }

    private async checkPort80Available(): Promise<boolean> {
        return this.checkPortAvailable(80);
    }

    private async checkPort4502Available(): Promise<boolean> {
        return this.checkPortAvailable(4502);
    }

    private async checkPort4503Available(): Promise<boolean> {
        return this.checkPortAvailable(4503);
    }

    private async checkPortAuthorDebugAvailable(): Promise<boolean> {
        return this.checkPortAvailable(5005);
    }

    private async checkPortPublisherDebugAvailable(): Promise<boolean> {
        return this.checkPortAvailable(5006);
    }
}