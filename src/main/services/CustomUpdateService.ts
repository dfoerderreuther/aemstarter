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

  constructor() {
    this.setupAutoUpdaterEvents();
  }

  private setupAutoUpdaterEvents() {
    autoUpdater.on('update-available', async () => {
      log.info('Update available - running pre-update hooks');
      await this.executeHooks(this.preUpdateHooks);
    });

    autoUpdater.on('update-downloaded', async () => {
      log.info('Update downloaded - running pre-install hooks');
      await this.executeHooks(this.preInstallHooks);
    });

    autoUpdater.on('before-quit-for-update', async () => {
      log.info('About to quit for update - running before-quit hooks');
      await this.executeHooks(this.beforeQuitHooks);
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

  public initializeUpdateService(repo: string, updateInterval: string = '5 minutes'): void {
    const { updateElectronApp } = require('update-electron-app');
    updateElectronApp({
      repo,
      updateInterval,
      logger: log,
      notifyUser: true
    });
  }
} 