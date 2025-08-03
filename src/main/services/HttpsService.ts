import { Project } from "../../types/Project";
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as https from 'https';
import * as httpProxy from 'http-proxy';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

export class HttpsService {
    private project: Project;
    private server: https.Server | null = null;
    private mainWindow: BrowserWindow | null = null;

    constructor(project: Project) {
        this.project = project;
    }

    public setMainWindow(mainWindow: BrowserWindow): void {
        this.mainWindow = mainWindow;
    }

    public updateProject(project: Project): void {
        this.project = project;
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

            log.info('[HTTPS Proxy] Generating self-signed certificate...');
            execSync(opensslCommand, { 
                cwd: this.project.folderPath,
                stdio: 'inherit' 
            });
            
            log.info(`[HTTPS Proxy] Self-signed certificate generated successfully in ${sslDir}`);
            
        } catch (error) {
            log.error(`[HTTPS Proxy] Error generating self-signed certificate: ${error}`);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to generate self-signed certificate: ${errorMessage}`);
        }
    }

    public async startSslProxy(): Promise<void> {
        log.info('[HttpsService] startSslProxy');
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
                proxy.on('error', (err, _req, res) => {
                    log.error(`[HTTPS Proxy] Proxy error: ${err.message}`);
                    if (res && 'writeHead' in res && !res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Proxy error occurred');
                    }
                });
                
                this.server = https.createServer(options, (req, res) => {
                    proxy.web(req, res);
                });
                
                this.server.on('error', (err) => {
                    log.error(`[HTTPS Proxy] HTTPS server error: ${err.message}`);
                    reject(err);
                });
                
                this.server.listen(httpsPort, () => {
                    log.info(`[HTTPS Proxy] HTTPS Proxy running on https://localhost:${httpsPort} → ${target}`);
                    this.sendStatusUpdate(true);
                    resolve();
                });
                
            } catch (error) {
                log.error(`[HTTPS Proxy] Error starting SSL proxy: ${error}`);
                const errorMessage = error instanceof Error ? error.message : String(error);
                reject(new Error(`Failed to start SSL proxy: ${errorMessage}`));
            }
        });
    }

    public async stopSslProxy(): Promise<void> {
        log.info('[HttpsService] stopSslProxy');
        return new Promise((resolve, reject) => {
            if (!this.server) {
                log.info('[HTTPS Proxy] No SSL proxy server to stop');
                this.sendStatusUpdate(false);
                resolve();
                return;
            }

            log.info('[HTTPS Proxy] Stopping SSL proxy server...');
            
            this.server.close((err) => {
                if (err) {
                    log.error(`[HTTPS Proxy] Error stopping SSL proxy server: ${err.message}`);
                    reject(new Error(`Failed to stop SSL proxy server: ${err.message}`));
                } else {
                    log.info('[HTTPS Proxy] SSL proxy server stopped successfully');
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