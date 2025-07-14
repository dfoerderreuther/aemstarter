
import { enhancedExecAsync } from "../enhancedExecAsync";
import * as fs from "fs";
import * as path from "path";

export class JavaService {


    public async getJavaHomePaths(): Promise<string[]> {
        const platform = process.platform;
        
        try {
            if (platform === 'darwin') {
                return await this.getMacJavaHomePaths();
            } else if (platform === 'linux') {
                return await this.getLinuxJavaHomePaths();
            } else {
                throw new Error(`Unsupported platform: ${platform}. Java path detection is only supported on Mac and Linux.`);
            }
        } catch (error) {
            throw new Error(`Failed to detect Java installations: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getMacJavaHomePaths(): Promise<string[]> {
        try {
            const { stdout, stderr } = await enhancedExecAsync('/usr/libexec/java_home -V');
            console.log("[JavaService] getMacJavaHomePaths stdout:", stdout);
            console.log("[JavaService] getMacJavaHomePaths stderr:", stderr);
            
            // The -V flag outputs detailed info to stderr, not stdout
            const lines = stderr.split('\n');
            const javaPaths: string[] = [];
            
            for (const line of lines) {
                // Look for lines containing Java installation paths
                // Format: "    20.0.1 (arm64) "Oracle Corporation" - "Java SE 20.0.1" /Library/Java/JavaVirtualMachines/jdk-20.jdk/Contents/Home"
                const pathMatch = line.match(/\/(?:Library\/Java|System\/Library|usr\/lib)\/[^\s]+/);
                if (pathMatch) {
                    const javaPath = pathMatch[0].trim();
                    if (fs.existsSync(javaPath)) {
                        javaPaths.push(javaPath);
                    }
                }
            }
            
            if (javaPaths.length === 0) {
                throw new Error('No Java installations found via /usr/libexec/java_home -V');
            }
            
            return javaPaths;
        } catch (error) {
            throw new Error(`/usr/libexec/java_home command failed or not available: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getLinuxJavaHomePaths(): Promise<string[]> {
        // Try different methods in order of preference
        const methods = [
            () => this.getLinuxJavaFromUpdateJavaAlternatives(),
            () => this.getLinuxJavaFromUpdateAlternatives(),
            () => this.getLinuxJavaFromCommonDirectories()
        ];

        for (const method of methods) {
            try {
                const paths = await method();
                if (paths.length > 0) {
                    return paths;
                }
            } catch (error) {
                // Continue to next method
                console.log(`Java detection method failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        throw new Error('No Java installations found. Tried update-java-alternatives, update-alternatives, and common directories.');
    }

    private async getLinuxJavaFromUpdateJavaAlternatives(): Promise<string[]> {
        try {
            const { stdout } = await enhancedExecAsync('update-java-alternatives -l');
            const lines = stdout.split('\n').filter(line => line.trim());
            const javaPaths: string[] = [];
            
            for (const line of lines) {
                // Parse lines like: "java-1.11.0-openjdk-amd64      1111       /usr/lib/jvm/java-1.11.0-openjdk-amd64"
                const parts = line.split(/\s+/);
                if (parts.length >= 3) {
                    const javaPath = parts[2];
                    if (fs.existsSync(javaPath)) {
                        javaPaths.push(javaPath);
                    }
                }
            }
            
            return javaPaths;
        } catch (error) {
            throw new Error(`update-java-alternatives command failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getLinuxJavaFromUpdateAlternatives(): Promise<string[]> {
        try {
            const { stdout } = await enhancedExecAsync('update-alternatives --list java');
            const lines = stdout.split('\n').filter(line => line.trim());
            const javaPaths: string[] = [];
            
            for (const line of lines) {
                // Lines like: "/usr/lib/jvm/java-11-openjdk-amd64/bin/java"
                const javaPath = line.trim();
                if (javaPath && fs.existsSync(javaPath)) {
                    // Extract the JAVA_HOME path (remove /bin/java)
                    const javaHome = javaPath.replace(/\/bin\/java$/, '');
                    if (fs.existsSync(javaHome)) {
                        javaPaths.push(javaHome);
                    }
                }
            }
            
            return javaPaths;
        } catch (error) {
            throw new Error(`update-alternatives command failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async getLinuxJavaFromCommonDirectories(): Promise<string[]> {
        const commonDirectories = [
            '/usr/lib/jvm',
            '/usr/java',
            '/usr/local/java',
            '/opt/java',
            '/opt/jdk'
        ];
        
        const javaPaths: string[] = [];
        
        for (const dir of commonDirectories) {
            if (fs.existsSync(dir)) {
                try {
                    const entries = fs.readdirSync(dir);
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry);
                        const stat = fs.statSync(fullPath);
                        
                        if (stat.isDirectory()) {
                            // Check if this looks like a Java installation
                            const binJava = path.join(fullPath, 'bin', 'java');
                            if (fs.existsSync(binJava)) {
                                javaPaths.push(fullPath);
                            }
                        }
                    }
                } catch (error) {
                    // Continue to next directory
                    console.log(`Error reading directory ${dir}: ${error}`);
                }
            }
        }
        
        return javaPaths;
    }
}