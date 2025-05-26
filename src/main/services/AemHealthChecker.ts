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

  constructor(project: Project) {
    this.project = project;
  }

  async checkHealth(instanceType: 'author' | 'publisher', port: number): Promise<HealthStatus> {
    // Read configuration on every health check run
    const settings = ProjectSettings.getSettings(this.project);
    const instanceSettings = settings[instanceType];
    
    // Skip health check if disabled in configuration
    if (!instanceSettings?.healthCheck) {
      console.log(`[AemHealthChecker] Health check disabled for ${instanceType}, skipping`);
      return {
        status: 'unknown',
        timestamp: Date.now()
      };
    }

    const startTime = Date.now();
    const url = `http://localhost:${port}/system/console/bundles.json`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      const status: HealthStatus = {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime,
        statusCode: response.status,
        timestamp: Date.now()
      };

      // If healthy, take a screenshot
      if (response.ok) {
        try {
          status.screenshotPath = await this.takeScreenshot(instanceType, port);
        } catch (screenshotError) {
          console.warn(`Failed to take screenshot for ${instanceType}:`, screenshotError);
        }
      }

      this.lastHealthStatus.set(instanceType, status);
      this.sendHealthUpdate(instanceType, status);
      
      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const status: HealthStatus = {
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };

      this.lastHealthStatus.set(instanceType, status);
      this.sendHealthUpdate(instanceType, status);
      
      return status;
    }
  }

  async takeScreenshot(instanceType: 'author' | 'publisher', port: number): Promise<string> {
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
          contextIsolation: true
        }
      });

      screenshotWindow.loadURL(`http://localhost:${port}/`);

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
        reject(new Error('Failed to load AEM page for screenshot'));
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

  private cleanupOldScreenshots(instanceType: 'author' | 'publisher') {
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

  startHealthChecking(instanceType: 'author' | 'publisher', port: number, intervalMs: number = 30000) {
    // Stop any existing health check
    this.stopHealthChecking(instanceType);

    console.log(`[AemHealthChecker] Starting health checks for ${instanceType} on port ${port} (will check config on each run)`);
    
    // Initial check
    this.checkHealth(instanceType, port);

    // Set up periodic checks - always start regardless of current config
    const interval = setInterval(() => {
      this.checkHealth(instanceType, port);
    }, intervalMs);

    this.healthCheckIntervals.set(instanceType, interval);
  }

  stopHealthChecking(instanceType: 'author' | 'publisher') {
    const interval = this.healthCheckIntervals.get(instanceType);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(instanceType);
      console.log(`[AemHealthChecker] Stopped health checks for ${instanceType}`);
    }
  }

  getLastHealthStatus(instanceType: 'author' | 'publisher'): HealthStatus | null {
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
      this.stopHealthChecking(instanceType as 'author' | 'publisher');
    }
    this.lastHealthStatus.clear();
  }
} 