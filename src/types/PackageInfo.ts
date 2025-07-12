export interface PackageInfo {
    name: string;
    createdDate: Date;
    paths: string[];
    hasAuthor: boolean;
    hasPublisher: boolean;
    authorSize?: number;
    publisherSize?: number;
} 