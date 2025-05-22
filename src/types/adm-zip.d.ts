declare module 'adm-zip' {
  export default class AdmZip {
    constructor(filename?: string);
    addFile(filename: string, data: Buffer): void;
    addLocalFile(filename: string, zipPath?: string): void;
    addLocalFolder(folderPath: string, zipPath?: string): void;
    extractAllTo(targetPath: string, overwrite?: boolean): void;
    getEntries(): Array<{
      entryName: string;
      rawEntryName: Buffer;
      name: string;
      comment: string;
      isDirectory: boolean;
      header: any;
      data: Buffer;
    }>;
    readFile(entryName: string): Buffer;
    writeZip(filename?: string): void;
  }
} 