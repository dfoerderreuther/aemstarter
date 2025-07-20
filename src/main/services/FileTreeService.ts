import { Project } from "../../types/Project";
import fs from 'fs';
import path from 'path';

export interface TreeItem {
  index: string;
  isFolder: boolean;
  children?: string[];
  data: {
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
    size?: number;
    updatedAt?: string;
  };
}

export interface TreeData {
  [key: string]: TreeItem;
}

export class FileTreeService {
  private project: Project;

  constructor(project: Project) {
    this.project = project;
  }

  /**
   * Read directory structure and convert to react-complex-tree format
   * Only loads the first level for performance and safety
   */
  async readDirectoryTree(dirPath: string, showHidden = false): Promise<TreeData> {
    const treeData: TreeData = {};
    
    try {
      // Check if path exists and is accessible
      try {
        await fs.promises.access(dirPath, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`Cannot access directory: ${dirPath}`);
      }

      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const children: string[] = [];
      const currentStats = await fs.promises.stat(dirPath);

      // First pass: Create entries for all direct children
      for (const entry of entries) {
        // Skip hidden files if not showing them
        if (!showHidden && entry.name.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(dirPath, entry.name);
        let isDirectory = entry.isDirectory();
        let isFile = entry.isFile();
        
        // Handle symlinks carefully
        if (entry.isSymbolicLink()) {
          try {
            const linkStats = fs.statSync(entryPath);
            isDirectory = linkStats.isDirectory();
            isFile = linkStats.isFile();
          } catch (error) {
            console.warn(`FileTreeService: Could not stat symlink target for ${entryPath}:`, error);
            continue;
          }
        }

        // Get stats for this entry
        let entryStats;
        try {
          entryStats = await fs.promises.stat(entryPath);
        } catch (error) {
          console.warn(`FileTreeService: Could not stat ${entryPath}:`, error);
          continue;
        }
        
        children.push(entryPath);

        // Create tree item for this entry (without children for now)
        treeData[entryPath] = {
          index: entryPath,
          isFolder: isDirectory,
          children: undefined, // Will be set later
          data: {
            name: entry.name,
            path: entryPath,
            isDirectory,
            isFile,
            size: isFile ? entryStats.size : undefined,
            updatedAt: entryStats.mtime.toISOString()
          }
        };
      }

      // Second pass: For each directory, load children and create TreeItem objects for them
      for (const entry of entries) {
        if (!showHidden && entry.name.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(dirPath, entry.name);
        const treeItem = treeData[entryPath];
        
        if (treeItem && treeItem.isFolder) {
          try {
            const subEntries = await fs.promises.readdir(entryPath, { withFileTypes: true });
            const directoryChildren: string[] = [];

            for (const subEntry of subEntries) {
              if (!showHidden && subEntry.name.startsWith('.')) {
                continue;
              }

              const subEntryPath = path.join(entryPath, subEntry.name);
              directoryChildren.push(subEntryPath);

              // Create TreeItem for this child if it doesn't exist
              if (!treeData[subEntryPath]) {
                let subIsDirectory = subEntry.isDirectory();
                let subIsFile = subEntry.isFile();
                
                // Handle symlinks
                if (subEntry.isSymbolicLink()) {
                  try {
                    const linkStats = fs.statSync(subEntryPath);
                    subIsDirectory = linkStats.isDirectory();
                    subIsFile = linkStats.isFile();
                  } catch (error) {
                    console.warn(`FileTreeService: Could not stat symlink target for ${subEntryPath}:`, error);
                    continue;
                  }
                }

                // Get stats for the child
                let subStats;
                try {
                  subStats = await fs.promises.stat(subEntryPath);
                } catch (error) {
                  console.warn(`FileTreeService: Could not stat ${subEntryPath}:`, error);
                  continue;
                }

                treeData[subEntryPath] = {
                  index: subEntryPath,
                  isFolder: subIsDirectory,
                  children: subIsDirectory ? [] : undefined, // Empty for now, will be loaded on-demand
                  data: {
                    name: subEntry.name,
                    path: subEntryPath,
                    isDirectory: subIsDirectory,
                    isFile: subIsFile,
                    size: subIsFile ? subStats.size : undefined,
                    updatedAt: subStats.mtime.toISOString()
                  }
                };
              }
            }

            // Update the parent's children array
            treeItem.children = directoryChildren.sort();
            
          } catch (error) {
            console.warn(`FileTreeService: Could not read subdirectory ${entryPath}:`, error);
            treeItem.children = []; // Empty array for unreadable directories
          }
        }
      }

      // Create the root directory entry
      const rootName = path.basename(dirPath) || 'Root';
      treeData[dirPath] = {
        index: dirPath,
        isFolder: true,
        children: children.sort(),
        data: {
          name: rootName,
          path: dirPath,
          isDirectory: true,
          isFile: false,
          updatedAt: currentStats.mtime.toISOString()
        }
      };
      
    } catch (error) {
      console.error('FileTreeService: Error reading directory tree:', error);
      throw error;
    }

    return treeData;
  }

  // Remove the problematic recursive function
  private async buildTreeRecursively() {
    // This method is no longer used
  }

  /**
   * Check if childPath is a direct child of parentPath
   */
  private isDirectChild(parentPath: string, childPath: string): boolean {
    const normalizedParent = path.normalize(parentPath);
    const normalizedChild = path.normalize(childPath);
    const parentOfChild = path.dirname(normalizedChild);
    return normalizedParent === parentOfChild;
  }

  /**
   * Create a new file
   */
  async createFile(filePath: string, content = ''): Promise<void> {
    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      await fs.promises.mkdir(parentDir, { recursive: true });
      
      // Create file
      await fs.promises.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      console.error('Error creating file:', error);
      throw error;
    }
  }

  /**
   * Create a new directory
   */
  async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error('Error creating directory:', error);
      throw error;
    }
  }

  /**
   * Rename a file or directory
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      // Check if target already exists
      if (await this.exists(newPath)) {
        throw new Error(`Target path already exists: ${newPath}`);
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(newPath);
      await fs.promises.mkdir(parentDir, { recursive: true });

      await fs.promises.rename(oldPath, newPath);
    } catch (error) {
      console.error('Error renaming:', error);
      throw error;
    }
  }

  /**
   * Move a file or directory
   */
  async move(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      // Check if target already exists
      if (await this.exists(destinationPath)) {
        throw new Error(`Target path already exists: ${destinationPath}`);
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(destinationPath);
      await fs.promises.mkdir(parentDir, { recursive: true });

      // Use rename for moving (works across directories on same filesystem)
      await fs.promises.rename(sourcePath, destinationPath);
    } catch (error) {
      console.error('Error moving:', error);
      throw error;
    }
  }

  /**
   * Delete a file or directory
   */
  async delete(targetPath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(targetPath);
      
      if (stats.isDirectory()) {
        // Remove directory recursively
        await fs.promises.rm(targetPath, { recursive: true, force: true });
      } else {
        // Remove file
        await fs.promises.unlink(targetPath);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      throw error;
    }
  }

  /**
   * Check if a path exists
   */
  private async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.promises.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file/directory info
   */
  async getInfo(targetPath: string): Promise<TreeItem['data']> {
    try {
      const stats = await fs.promises.stat(targetPath);
      const name = path.basename(targetPath);
      
      return {
        name,
        path: targetPath,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.isFile() ? stats.size : undefined,
        updatedAt: stats.mtime.toISOString()
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }
}