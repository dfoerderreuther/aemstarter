import log from 'electron-log';
import { autoUpdater } from 'electron';

export interface PreUpdateHook {
  name: string;
  execute: () => Promise<void>;
}

export class CustomUpdateService {
  private preUpdateHooks: PreUpdateHook[] = [];
  private preInstallHooks: PreUpdateHook[] = [];
  private beforeQuitHooks: PreUpdateHook[] = [];
  private autoUpdatesEnabled: boolean = true; // Default to enabled for backward compatibility

  constructor() {
    this.setupAutoUpdaterEvents();
  }

  private setupAutoUpdaterEvents() {
    autoUpdater.on('update-available', async () => {
      if (this.autoUpdatesEnabled) {
        log.info('Update available - running pre-update hooks');
        await this.executeHooks(this.preUpdateHooks);
      } else {
        log.info('Update available but auto-updates are disabled');
      }
    });

    autoUpdater.on('update-downloaded', async () => {
      if (this.autoUpdatesEnabled) {
        log.info('Update downloaded - running pre-install hooks');
        await this.executeHooks(this.preInstallHooks);
      } else {
        log.info('Update downloaded but auto-updates are disabled');
      }
    });

    autoUpdater.on('before-quit-for-update', async () => {
      if (this.autoUpdatesEnabled) {
        log.info('About to quit for update - running before-quit hooks');
        await this.executeHooks(this.beforeQuitHooks);
      } else {
        log.info('About to quit for update but auto-updates are disabled');
      }
    });
  }

  private async executeHooks(hooks: PreUpdateHook[]): Promise<void> {
    for (const hook of hooks) {
      try {
        log.info(`Executing pre-update hook: ${hook.name}`);
        await hook.execute();
        log.info(`Successfully executed hook: ${hook.name}`);
      } catch (error) {
        log.error(`Failed to execute hook ${hook.name}:`, error);
      }
    }
  }

  public addPreUpdateHook(hook: PreUpdateHook): void {
    this.preUpdateHooks.push(hook);
  }

  public addPreInstallHook(hook: PreUpdateHook): void {
    this.preInstallHooks.push(hook);
  }

  public addBeforeQuitHook(hook: PreUpdateHook): void {
    this.beforeQuitHooks.push(hook);
  }

  public setAutoUpdatesEnabled(enabled: boolean): void {
    this.autoUpdatesEnabled = enabled;
    log.info(`Auto-updates ${enabled ? 'enabled' : 'disabled'}`);
  }

  public getAutoUpdatesEnabled(): boolean {
    return this.autoUpdatesEnabled;
  }

  public initializeUpdateService(repo: string, updateInterval: string = '5 minutes', autoUpdatesEnabled: boolean = true): void {
    this.autoUpdatesEnabled = autoUpdatesEnabled;

    if (this.autoUpdatesEnabled) {
      const { updateElectronApp } = require('update-electron-app');
      updateElectronApp({
        repo,
        updateInterval,
        logger: log,
        notifyUser: true
      });
      log.info('Auto-updates initialized and enabled');
    } else {
      log.info('Auto-updates disabled, skipping initialization');
    }
  }
} 