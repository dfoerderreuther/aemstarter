export interface BackupInfo {
    name: string;
    createdDate: Date;
    fileSize: number;
    compressed: boolean;
    description?: string;
    selectedInstances?: {
        author: boolean;
        publisher: boolean;
        dispatcher: boolean;
    };
} 