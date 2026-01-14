import { Project, SslProxySettings } from "../../types/Project";
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as https from 'https';
import * as httpProxy from 'http-proxy';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

export type SslProxyType = 'author' | 'publisher' | 'dispatcher';

interface ProxyInstance {
    server: https.Server;
    proxy: httpProxy;
    type: SslProxyType;
    port: number;
    targetPort: number;
}

export class HttpsService {
    private project: Project;
    private proxies: Map<SslProxyType, ProxyInstance> = new Map();
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

    /**
     * Get SSL settings for a specific proxy type
     */
    private getSslSettings(type: SslProxyType): SslProxySettings {
        const ssl = this.project.settings?.ssl;
        if (ssl) {
            return ssl[type] || { enabled: false, port: this.getDefaultPort(type) };
        }
        
        // Fallback to old https settings for dispatcher only (backward compatibility)
        if (type === 'dispatcher' && this.project.settings?.https) {
            return this.project.settings.https;
        }
        
        return { enabled: false, port: this.getDefaultPort(type) };
    }

    private getDefaultPort(type: SslProxyType): number {
        switch (type) {
            case 'author': return 8502;
            case 'publisher': return 8503;
            case 'dispatcher': return 443;
        }
    }

    /**
     * Get the target port for a specific proxy type
     */
    private getTargetPort(type: SslProxyType): number {
        switch (type) {
            case 'author': return this.project.settings.author.port;
            case 'publisher': return this.project.settings.publisher.port;
            case 'dispatcher': return this.project.settings.dispatcher.port;
        }
    }

    /**
     * Check if any SSL proxy is enabled
     */
    public isAnySslProxyEnabled(): boolean {
        const ssl = this.project.settings?.ssl;
        if (ssl) {
            return ssl.author?.enabled || ssl.publisher?.enabled || ssl.dispatcher?.enabled;
        }
        // Fallback to old https settings
        return this.project.settings?.https?.enabled || false;
    }

    /**
     * Get enabled SSL proxy types
     */
    public getEnabledSslProxyTypes(): SslProxyType[] {
        const types: SslProxyType[] = [];
        const ssl = this.project.settings?.ssl;
        
        if (ssl) {
            if (ssl.author?.enabled) types.push('author');
            if (ssl.publisher?.enabled) types.push('publisher');
            if (ssl.dispatcher?.enabled) types.push('dispatcher');
        } else if (this.project.settings?.https?.enabled) {
            // Fallback to old https settings (dispatcher only)
            types.push('dispatcher');
        }
        
        return types;
    }

    /**
     * Start a single SSL proxy for a specific type
     */
    private async startSingleProxy(type: SslProxyType): Promise<void> {
        const settings = this.getSslSettings(type);
        
        if (!settings.enabled) {
            log.info(`[HTTPS Proxy] ${type} proxy not enabled, skipping`);
            return;
        }

        // Skip if already running
        if (this.proxies.has(type)) {
            log.info(`[HTTPS Proxy] ${type} proxy already running`);
            return;
        }

        log.info(`[HttpsService] Starting ${type} SSL proxy`);

        const sslDir = path.join(this.project.folderPath, 'ssl');
        const keyPath = path.join(sslDir, 'localhost.key');
        const certPath = path.join(sslDir, 'localhost.crt');
        const targetPort = this.getTargetPort(type);
        const httpsPort = settings.port;
        
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
            changeOrigin: false, // Keep original Host header for AEM authentication
            secure: false,
            xfwd: true, // Forward X-Forwarded-* headers
            preserveHeaderKeyCase: true,
            cookieDomainRewrite: '', // Don't rewrite cookie domains
            autoRewrite: true // Auto-rewrite Location headers on redirects
        });
        
        // Handle proxy errors
        proxy.on('error', (err, _req, res) => {
            log.error(`[HTTPS Proxy] ${type} proxy error: ${err.message}`);
            if (res && 'writeHead' in res && !res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Proxy error occurred');
            }
        });

        // Add X-Forwarded-Proto header for proper HTTPS detection
        proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.setHeader('X-Forwarded-Proto', 'https');
            proxyReq.setHeader('X-Forwarded-Port', String(httpsPort));
            
            // Log POST requests for debugging
            if (req.method === 'POST') {
                log.info(`[HTTPS Proxy] ${type} proxying POST request: ${req.url}`);
            }
        });
        
        const server = https.createServer(options, (req, res) => {
            proxy.web(req, res);
        });

        return new Promise((resolve, reject) => {
            server.on('error', (err) => {
                log.error(`[HTTPS Proxy] ${type} HTTPS server error: ${err.message}`);
                reject(err);
            });
            
            server.listen(httpsPort, () => {
                log.info(`[HTTPS Proxy] ${type} HTTPS Proxy running on https://localhost:${httpsPort} → ${target}`);
                
                this.proxies.set(type, {
                    server,
                    proxy,
                    type,
                    port: httpsPort,
                    targetPort
                });
                
                resolve();
            });
        });
    }

    /**
     * Stop a single SSL proxy for a specific type
     */
    private async stopSingleProxy(type: SslProxyType): Promise<void> {
        const proxyInstance = this.proxies.get(type);
        
        if (!proxyInstance) {
            log.info(`[HTTPS Proxy] No ${type} SSL proxy server to stop`);
            return;
        }

        log.info(`[HTTPS Proxy] Stopping ${type} SSL proxy server...`);

        return new Promise((resolve, reject) => {
            proxyInstance.server.close((err) => {
                if (err) {
                    log.error(`[HTTPS Proxy] Error stopping ${type} SSL proxy server: ${err.message}`);
                    reject(new Error(`Failed to stop ${type} SSL proxy server: ${err.message}`));
                } else {
                    log.info(`[HTTPS Proxy] ${type} SSL proxy server stopped successfully`);
                    this.proxies.delete(type);
                    resolve();
                }
            });
        });
    }

    /**
     * Start all enabled SSL proxies
     */
    public async startSslProxy(): Promise<void> {
        log.info('[HttpsService] startSslProxy - starting all enabled proxies');
        
        const enabledTypes = this.getEnabledSslProxyTypes();
        
        if (enabledTypes.length === 0) {
            log.info('[HTTPS Proxy] No SSL proxies enabled');
            return;
        }
        
        // Start all enabled proxies in order: author, publisher, dispatcher
        const orderedTypes: SslProxyType[] = ['author', 'publisher', 'dispatcher'];
        
        for (const type of orderedTypes) {
            if (enabledTypes.includes(type)) {
                try {
                    await this.startSingleProxy(type);
                } catch (error) {
                    log.error(`[HTTPS Proxy] Failed to start ${type} proxy:`, error);
                    // Continue trying to start other proxies
                }
            }
        }
        
        this.sendStatusUpdate(this.proxies.size > 0);
    }

    /**
     * Stop all SSL proxies
     */
    public async stopSslProxy(): Promise<void> {
        log.info('[HttpsService] stopSslProxy - stopping all proxies');
        
        if (this.proxies.size === 0) {
            log.info('[HTTPS Proxy] No SSL proxy servers to stop');
            this.sendStatusUpdate(false);
            return;
        }

        const stopPromises: Promise<void>[] = [];
        
        for (const type of this.proxies.keys()) {
            stopPromises.push(this.stopSingleProxy(type));
        }
        
        await Promise.all(stopPromises);
        this.sendStatusUpdate(false);
    }

    /**
     * Check if any SSL proxy is running
     */
    public async isSslProxyRunning(): Promise<boolean> {
        return this.proxies.size > 0;
    }

    /**
     * Check if a specific SSL proxy type is running
     */
    public isProxyTypeRunning(type: SslProxyType): boolean {
        return this.proxies.has(type);
    }

    /**
     * Get running proxy info
     */
    public getRunningProxies(): { type: SslProxyType; port: number; targetPort: number }[] {
        const result: { type: SslProxyType; port: number; targetPort: number }[] = [];
        
        for (const [type, instance] of this.proxies.entries()) {
            result.push({
                type,
                port: instance.port,
                targetPort: instance.targetPort
            });
        }
        
        return result;
    }

    private sendStatusUpdate(isRunning: boolean): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            const runningProxies = this.getRunningProxies();
            
            this.mainWindow.webContents.send('ssl-proxy-status', {
                projectId: this.project.id,
                isRunning: isRunning,
                runningProxies: runningProxies,
                // Keep port for backward compatibility (use dispatcher port if available, otherwise first running proxy)
                port: runningProxies.find(p => p.type === 'dispatcher')?.port 
                    || runningProxies[0]?.port 
                    || this.project.settings?.ssl?.dispatcher?.port 
                    || this.project.settings?.https?.port 
                    || 443
            });
        }
    }

    /**
     * Force a status update to be sent to the UI
     */
    public forceStatusUpdate(): void {
        this.sendStatusUpdate(this.proxies.size > 0);
    }
}