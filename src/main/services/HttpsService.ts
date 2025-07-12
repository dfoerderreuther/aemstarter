import { Project } from "../../types/Project";
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as https from 'https';
import * as httpProxy from 'http-proxy';
import { BrowserWindow } from 'electron';

class HttpsProxyLogger {
    private project: Project;
    private logDir: string;

    constructor(project: Project) {
        this.project = project;
        this.logDir = path.join(this.project.folderPath, 'ssl', 'logs');
        this.ensureLogDirectory();
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    private getLogFilePath(): string {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        return path.join(this.logDir, `proxy_${dateStr}.log`);
    }

    private formatLogMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}\n`;
    }

    public log(message: string): void {
        const logFilePath = this.getLogFilePath();
        const formattedMessage = this.formatLogMessage('INFO', message);
        
        try {
            fs.appendFileSync(logFilePath, formattedMessage);
        } catch (error) {
            // Fallback to console if file writing fails
            console.log(`[HTTPS Proxy] ${message}`);
        }
    }

    public error(message: string): void {
        const logFilePath = this.getLogFilePath();
        const formattedMessage = this.formatLogMessage('ERROR', message);
        
        try {
            fs.appendFileSync(logFilePath, formattedMessage);
        } catch (error) {
            // Fallback to console if file writing fails
            console.error(`[HTTPS Proxy] ${message}`);
        }
    }

    public updateProject(project: Project): void {
        this.project = project;
        this.logDir = path.join(this.project.folderPath, 'ssl', 'logs');
        this.ensureLogDirectory();
    }
}

export class HttpsService {
    private project: Project;
    private server: https.Server | null = null;
    private logger: HttpsProxyLogger;
    private mainWindow: BrowserWindow | null = null;

    constructor(project: Project) {
        this.project = project;
        this.logger = new HttpsProxyLogger(project);
    }

    public setMainWindow(mainWindow: BrowserWindow): void {
        this.mainWindow = mainWindow;
    }

    public updateProject(project: Project): void {
        this.project = project;
        this.logger.updateProject(project);
    }

    private async generateSelfSignedCertificate(): Promise<void> {
        try {
            // Create SSL directory in the project folder
            const sslDir = path.join(this.project.folderPath, 'ssl');
            
            // Create the ssl directory if it doesn't exist
            if (!fs.existsSync(sslDir)) {
                fs.mkdirSync(sslDir, { recursive: true });
            }

            // Generate the self-signed certificate using OpenSSL
            const opensslCommand = `openssl req -x509 -nodes -days 365 -newkey rsa:2048 ` +
                `-keyout ${path.join(sslDir, 'localhost.key')} ` +
                `-out ${path.join(sslDir, 'localhost.crt')} ` +
                `-subj "/C=US/ST=State/L=City/O=Local/CN=localhost"`;

            this.logger.log('Generating self-signed certificate...');
            execSync(opensslCommand, { 
                cwd: this.project.folderPath,
                stdio: 'inherit' 
            });
            
            this.logger.log(`Self-signed certificate generated successfully in ${sslDir}`);
            
        } catch (error) {
            this.logger.error(`Error generating self-signed certificate: ${error}`);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to generate self-signed certificate: ${errorMessage}`);
        }
    }

    public async startSslProxy(): Promise<void> {
        console.log('[HttpsService] startSslProxy');
        return new Promise(async (resolve, reject) => {
            try {
                const sslDir = path.join(this.project.folderPath, 'ssl');
                const keyPath = path.join(sslDir, 'localhost.key');
                const certPath = path.join(sslDir, 'localhost.crt');
                const targetPort = this.project.settings.dispatcher.port;
                const httpsPort = this.project.settings.https.port || 443;
                
                // Check if SSL certificates exist, generate if they don't
                if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
                    await this.generateSelfSignedCertificate();
                }
                
                const target = `http://localhost:${targetPort}`;
                
                const options = {
                    key: fs.readFileSync(keyPath),
                    cert: fs.readFileSync(certPath),
                };
                
                const proxy = httpProxy.createProxyServer({
                    target: target,
                    changeOrigin: true,
                    secure: false,
                    headers: {
                        'X-Forwarded-Proto': 'https'
                    }
                });
                
                // Handle proxy errors
                proxy.on('error', (err, req, res) => {
                    this.logger.error(`Proxy error: ${err.message}`);
                    if (res && 'writeHead' in res && !res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Proxy error occurred');
                    }
                });
                
                this.server = https.createServer(options, (req, res) => {
                    proxy.web(req, res);
                });
                
                this.server.on('error', (err) => {
                    this.logger.error(`HTTPS server error: ${err.message}`);
                    reject(err);
                });
                
                this.server.listen(httpsPort, () => {
                    this.logger.log(`HTTPS Proxy running on https://localhost:${httpsPort} → ${target}`);
                    this.sendStatusUpdate(true);
                    resolve();
                });
                
            } catch (error) {
                this.logger.error(`Error starting SSL proxy: ${error}`);
                const errorMessage = error instanceof Error ? error.message : String(error);
                reject(new Error(`Failed to start SSL proxy: ${errorMessage}`));
            }
        });
    }

    public async stopSslProxy(): Promise<void> {
        console.log('[HttpsService] stopSslProxy');
        return new Promise((resolve, reject) => {
            if (!this.server) {
                this.logger.log('No SSL proxy server to stop');
                this.sendStatusUpdate(false);
                resolve();
                return;
            }

            this.logger.log('Stopping SSL proxy server...');
            
            this.server.close((err) => {
                if (err) {
                    this.logger.error(`Error stopping SSL proxy server: ${err.message}`);
                    reject(new Error(`Failed to stop SSL proxy server: ${err.message}`));
                } else {
                    this.logger.log('SSL proxy server stopped successfully');
                    this.server = null;
                    this.sendStatusUpdate(false);
                    resolve();
                }
            });
        });
    }

    public async isSslProxyRunning(): Promise<boolean> {
        return this.server !== null;
    }

    private sendStatusUpdate(isRunning: boolean): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('ssl-proxy-status', {
                projectId: this.project.id,
                isRunning: isRunning,
                port: this.project.settings?.https?.port || 443
            });
        }
    }

    /**
     * Force a status update to be sent to the UI
     */
    public forceStatusUpdate(): void {
        this.sendStatusUpdate(this.server !== null);
    }
}