declare module 'update-electron-app' {
  export interface UpdateOptions {
    repo?: string;
    updateInterval?: string;
    logger?: Console;
    notifyUser?: boolean;
  }

  export function updateElectronApp(options?: UpdateOptions): void;
  
  export enum UpdateSourceType {
    ElectronPublicUpdateService = 0,
    StaticStorage = 1
  }
} 