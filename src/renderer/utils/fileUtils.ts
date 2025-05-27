// File utility functions

/**
 * Common binary file extensions
 */
const BINARY_EXTENSIONS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'svg', 'ico', 'icns',
  // Videos
  'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp',
  // Audio
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'jar', 'war', 'ear',
  // Executables
  'exe', 'dll', 'so', 'dylib', 'app', 'deb', 'rpm', 'msi', 'dmg',
  // Documents (binary formats)
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  // Fonts
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  // Database
  'db', 'sqlite', 'sqlite3', 'mdb',
  // Other binary formats
  'bin', 'dat', 'class', 'pyc', 'o', 'obj', 'lib', 'a'
]);

/**
 * Check if a file is likely binary based on its extension
 */
export function isBinaryFileByExtension(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext ? BINARY_EXTENSIONS.has(ext) : false;
}

/**
 * Check if content contains binary data by looking for null bytes and non-printable characters
 */
export function isBinaryContent(content: string): boolean {
  // Check for null bytes (common in binary files)
  if (content.includes('\0')) {
    return true;
  }
  
  // Check for high percentage of non-printable characters
  let nonPrintableCount = 0;
  const sampleSize = Math.min(content.length, 8192); // Check first 8KB
  
  for (let i = 0; i < sampleSize; i++) {
    const charCode = content.charCodeAt(i);
    // Consider characters outside printable ASCII range (except common whitespace)
    if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
      nonPrintableCount++;
    } else if (charCode > 126 && charCode < 160) {
      nonPrintableCount++;
    }
  }
  
  // If more than 30% of characters are non-printable, consider it binary
  return (nonPrintableCount / sampleSize) > 0.3;
}

/**
 * Get a human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file extension from path
 */
export function getFileExtension(filePath: string): string {
  return filePath.split('.').pop()?.toLowerCase() || '';
}

/**
 * Get filename from path
 */
export function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || '';
} 