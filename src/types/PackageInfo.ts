export interface PackageInfo {
    name: string;
    createdDate: Date;
    paths: string[];
    hasAuthor: boolean;
    hasPublisher: boolean;
    authorSize?: number;
    publisherSize?: number;
    authorAemPath?: string;  // Actual AEM package path for author instance
    publisherAemPath?: string;  // Actual AEM package path for publisher instance
} 