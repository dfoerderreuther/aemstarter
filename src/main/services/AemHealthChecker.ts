import { BrowserWindow } from 'electron';
import { Project } from '../../types/Project';
import path from 'path';
import fs from 'fs';
import { ProjectSettings } from './ProjectSettings';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'starting' | 'unknown';
  responseTime?: number;
  statusCode?: number;
  error?: string;
  timestamp: number;
  screenshotPath?: string;
}

export class AemHealthChecker {
  private project: Project;
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastHealthStatus: Map<string, HealthStatus> = new Map();
  private currentIntervals: Map<string, { intervalMs: number; port: number }> = new Map();

  constructor(project: Project) {
    this.project = project;
  }

  async checkHealth(instanceType: 'author' | 'publisher' | 'dispatcher', port: number): Promise<HealthStatus> {
    // Read configuration on every health check run
    const settings = ProjectSettings.getSettings(this.project);
    
    // Skip health check if disabled in general configuration
    if (!settings.general?.healthCheck) {
      console.log(`[AemHealthChecker] Health check disabled in general settings, skipping ${instanceType}`);
      return {
        status: 'unknown',
        timestamp: Date.now()
      };
    }

    const startTime = Date.now();
    
    // Use different URLs based on instance type and configuration
    let url: string;
    let headers: Record<string, string> = {};
    
    // Get the health check path from settings
    const instanceSettings = settings[instanceType];
    const healthCheckPath = instanceSettings?.healthCheckPath || '';
    
    if (instanceType === 'dispatcher') {
      // For dispatcher, use healthCheckPath if configured, otherwise root URL
      url = `http://localhost:${port}${healthCheckPath || '/'}`;
    } else {
      // For AEM instances, use healthCheckPath if configured, otherwise check content root
      if (healthCheckPath) {
        url = `http://localhost:${port}${healthCheckPath}`;
        // Only add auth if not using a custom health check path (custom paths might be public)
        if (instanceType === 'author' || (healthCheckPath.startsWith('/system/') || healthCheckPath.startsWith('/bin/') || healthCheckPath.includes('admin'))) {
          headers = {
            'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
          };
        }
      } else {
        // Default to checking a content path that would return 404 if no content exists
        // Use the root path to check actual content availability
        url = `http://localhost:${port}/`;
        if (instanceType === 'author') {
          headers = {
            'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
          };
        }
      }
    }
        
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      const status: HealthStatus = {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime,
        statusCode: response.status,
        timestamp: Date.now()
      };

      console.log(`[AemHealthChecker] Health check result for ${instanceType}: status=${response.status}, ok=${response.ok}, url=${url}`);

      // Take a screenshot regardless of health status (for debugging)
      try {
        status.screenshotPath = await this.takeScreenshot(instanceType, port);
      } catch (screenshotError) {
        console.warn(`Failed to take screenshot for ${instanceType}:`, screenshotError);
      }

      this.lastHealthStatus.set(instanceType, status);
      this.sendHealthUpdate(instanceType, status);
      
      // Adjust interval based on health status
      this.adjustHealthCheckInterval(instanceType, port, status);
      
      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const status: HealthStatus = {
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };

      console.log(`[AemHealthChecker] Health check error for ${instanceType}:`, error);

      this.lastHealthStatus.set(instanceType, status);
      this.sendHealthUpdate(instanceType, status);
      
      // Adjust interval based on health status
      this.adjustHealthCheckInterval(instanceType, port, status);
      
      return status;
    }
  }

  async takeScreenshot(instanceType: 'author' | 'publisher' | 'dispatcher', port: number): Promise<string> {
    console.log(`[AemHealthChecker] Taking screenshot for ${instanceType} at ${port}`);
    const screenshotsDir = path.join(this.project.folderPath, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${instanceType}-${timestamp}.png`;
    const screenshotPath = path.join(screenshotsDir, filename);

    // Use Electron's built-in screenshot capability via a hidden window
    return new Promise((resolve, reject) => {
      const screenshotWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false,
          allowRunningInsecureContent: true
        }
      });

      const settings = ProjectSettings.getSettings(this.project);
      const instanceSettings = settings[instanceType];
      const healthCheckPath = instanceSettings?.healthCheckPath || '';

      screenshotWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        // Remove or modify restrictive Content Security Policy
        if (details.responseHeaders && details.responseHeaders['Content-Security-Policy']) {
          // Allow external images by modifying img-src directive
          details.responseHeaders['Content-Security-Policy'] = details.responseHeaders['Content-Security-Policy'].map(csp => {
            return csp.replace(/img-src '[^']*'[^;]*;?/g, "img-src 'self' data: https: http:;");
          });
        }
        callback({ responseHeaders: details.responseHeaders });
      });

      screenshotWindow.loadURL(`http://localhost:${port}${healthCheckPath}`);

      screenshotWindow.webContents.once('did-finish-load', async () => {
        try {
          // Wait a bit for the page to fully render
          setTimeout(async () => {
            try {
              const image = await screenshotWindow.webContents.capturePage();
              fs.writeFileSync(screenshotPath, image.toPNG());
              screenshotWindow.close();
              
              // Clean up old screenshots (keep only last 10)
              this.cleanupOldScreenshots(instanceType);
              
              resolve(screenshotPath);
            } catch (error) {
              screenshotWindow.close();
              reject(error);
            }
          }, 2000);
        } catch (error) {
          screenshotWindow.close();
          reject(error);
        }
      });

      screenshotWindow.webContents.once('did-fail-load', () => {
        screenshotWindow.close();
        reject(new Error('Failed to load page for screenshot'));
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!screenshotWindow.isDestroyed()) {
          screenshotWindow.close();
          reject(new Error('Screenshot timeout'));
        }
      }, 30000);
    });
  }

  private cleanupOldScreenshots(instanceType: 'author' | 'publisher' | 'dispatcher') {
    try {
      const screenshotsDir = path.join(this.project.folderPath, 'screenshots');
      if (!fs.existsSync(screenshotsDir)) return;

      const files = fs.readdirSync(screenshotsDir)
        .filter(file => file.startsWith(`${instanceType}-`) && file.endsWith('.png'))
        .map(file => ({
          name: file,
          path: path.join(screenshotsDir, file),
          mtime: fs.statSync(path.join(screenshotsDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the 10 most recent screenshots
      const filesToDelete = files.slice(10);
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.warn(`Failed to delete old screenshot ${file.name}:`, error);
        }
      });
    } catch (error) {
      console.warn(`Failed to cleanup old screenshots for ${instanceType}:`, error);
    }
  }

  private adjustHealthCheckInterval(instanceType: 'author' | 'publisher' | 'dispatcher', port: number, status: HealthStatus) {
    const currentConfig = this.currentIntervals.get(instanceType);
    if (!currentConfig) return;

    // Determine the appropriate interval based on health status
    const isHealthy = status.status === 'healthy' && status.statusCode === 200;
    const fastInterval = 5000; // 5 seconds for unhealthy instances
    const normalInterval = 30000; // 30 seconds for healthy instances
    
    const desiredInterval = isHealthy ? normalInterval : fastInterval;
    
    // Only restart the interval if it needs to change
    if (currentConfig.intervalMs !== desiredInterval) {
      console.log(`[AemHealthChecker] Adjusting health check interval for ${instanceType} from ${currentConfig.intervalMs}ms to ${desiredInterval}ms (status: ${status.status}, statusCode: ${status.statusCode})`);
      
      // Stop current interval
      const interval = this.healthCheckIntervals.get(instanceType);
      if (interval) {
        clearInterval(interval);
      }
      
      // Start new interval with adjusted timing
      const newInterval = setInterval(() => {
        this.checkHealth(instanceType, port);
      }, desiredInterval);
      
      this.healthCheckIntervals.set(instanceType, newInterval);
      this.currentIntervals.set(instanceType, { intervalMs: desiredInterval, port });
    }
  }

  startHealthChecking(instanceType: 'author' | 'publisher' | 'dispatcher', port: number, intervalMs = 30000) {
    // Stop any existing health check
    this.stopHealthChecking(instanceType);
    
    // Store the current configuration
    this.currentIntervals.set(instanceType, { intervalMs, port });
    
    // Initial check
    this.checkHealth(instanceType, port);

    // Set up periodic checks - start with the provided interval
    const interval = setInterval(() => {
      this.checkHealth(instanceType, port);
    }, intervalMs);

    this.healthCheckIntervals.set(instanceType, interval);
  }

  stopHealthChecking(instanceType: 'author' | 'publisher' | 'dispatcher') {
    const interval = this.healthCheckIntervals.get(instanceType);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(instanceType);
      this.currentIntervals.delete(instanceType);
      console.log(`[AemHealthChecker] Stopped health checks for ${instanceType}`);
    }
  }

  getLastHealthStatus(instanceType: 'author' | 'publisher' | 'dispatcher'): HealthStatus | null {
    return this.lastHealthStatus.get(instanceType) || null;
  }

  private sendHealthUpdate(instanceType: string, status: HealthStatus) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send('aem-health-status', {
        projectId: this.project.id,
        instanceType,
        status
      });
    });
  }

  cleanup() {
    // Stop all health checks
    for (const instanceType of this.healthCheckIntervals.keys()) {
      this.stopHealthChecking(instanceType as 'author' | 'publisher' | 'dispatcher');
    }
    this.lastHealthStatus.clear();
    this.currentIntervals.clear();
  }
} 