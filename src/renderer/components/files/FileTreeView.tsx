import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Collapse, Group, Text, Box, Stack, Loader, UnstyledButton, ActionIcon, Divider } from '@mantine/core';
import { IconFolder, IconFolderOpen, IconFile, IconChevronRight, IconChevronDown, IconRefresh, IconEye, IconEyeOff, IconPhoto, IconFileZip, IconMusic, IconVideo, IconFileText, IconCode } from '@tabler/icons-react';
import { isBinaryFileByExtension, getFileExtension } from '../../utils/fileUtils';
import { Project } from '../../../types/Project';

export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
}

// Add interface for saving/restoring state
export interface FileTreeState {
  selectedFile: string | null;
  expandedDirectories: Set<string>;
  directoryContents: Map<string, FileSystemEntry[]>;
}

interface FileTreeEntryProps {
  entry: FileSystemEntry;
  level: number;
  showHidden: boolean;
  selectedFile: string | null;
  expandedDirectories: Set<string>;
  directoryContents: Map<string, FileSystemEntry[]>;
  onSelect: (path: string) => void;
  onToggleDirectory: (path: string, isExpanded: boolean) => void;
  onDirectoryLoaded: (path: string, contents: FileSystemEntry[]) => void;
}

interface FileTreeViewProps {
  rootPath: string;
  onFileSelect?: (filePath: string) => void;
  project?: Project;
}

export interface FileTreeViewRef {
  refresh: () => Promise<void>;
  saveState: () => FileTreeState;
  restoreState: (state: FileTreeState) => void;
}

const FileTreeEntry: React.FC<FileTreeEntryProps> = ({ 
  entry, 
  level, 
  showHidden, 
  selectedFile, 
  expandedDirectories,
  directoryContents,
  onSelect,
  onToggleDirectory,
  onDirectoryLoaded
}) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const indent = level * 16;
  const isOpen = expandedDirectories.has(entry.path);
  const children = directoryContents.get(entry.path) || [];
  
  const toggleDirectory = async () => {
    if (!entry.isDirectory) {
      onSelect(entry.path);
      return;
    }
    
    if (!isOpen) {
      // Load directory contents if not already loaded
      if (!directoryContents.has(entry.path)) {
        setIsLoading(true);
        try {
          const entries = await window.electronAPI.readDirectory(entry.path, showHidden);
          // Sort directories first, then files alphabetically
          entries.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });
          onDirectoryLoaded(entry.path, entries);
        } catch (error) {
          console.error('Error reading directory:', error);
        } finally {
          setIsLoading(false);
        }
      }
    }
    
    onToggleDirectory(entry.path, !isOpen);
  };
  
  const isHiddenFile = entry.name.startsWith('.');
  const isSelected = selectedFile === entry.path;
  const isBinary = !entry.isDirectory && isBinaryFileByExtension(entry.path);
  
  const getFileIcon = () => {
    if (entry.isDirectory) {
      return isOpen ? <IconFolderOpen size={18} /> : <IconFolder size={18} />;
    }
    
    // Return different icons based on file type
    if (isBinary) {
      const ext = getFileExtension(entry.path);
      
      // Images
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'svg', 'ico', 'icns'].includes(ext)) {
        return <IconPhoto size={18} />;
      }
      
      // Archives
      if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'jar', 'war', 'ear'].includes(ext)) {
        return <IconFileZip size={18} />;
      }
      
      // Audio
      if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'].includes(ext)) {
        return <IconMusic size={18} />;
      }
      
      // Video
      if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp'].includes(ext)) {
        return <IconVideo size={18} />;
      }
      
      // Default binary file icon
      return <IconFile size={18} style={{ opacity: 0.6 }} />;
    }
    
    // Text files
    return <IconFileText size={18} />;
  };
  
  return (
    <>
      <UnstyledButton 
        onClick={toggleDirectory}
        style={{ 
          width: '100%',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: isSelected ? '#3B5BBC' : 'transparent',
          ':hover': {
            backgroundColor: isSelected ? '#3B5BBC' : '#2C2E33'
          }
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <Box style={{ width: indent }} />
          <Box style={{ width: 20 }}>
            {entry.isDirectory && (
              isOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />
            )}
          </Box>
          {getFileIcon()}
          <Text size="sm" style={{ 
            opacity: isHiddenFile ? 0.6 : isBinary ? 0.8 : 1,
            fontStyle: isHiddenFile ? 'italic' : 'normal',
            color: isBinary ? '#868e96' : undefined
          }}>
            {entry.name}
          </Text>
          {isLoading && <Loader size="xs" />}
        </Group>
      </UnstyledButton>
      
      {entry.isDirectory && (
        <Collapse in={isOpen}>
          <Box pl={indent}>
            {children.map((child) => (
              <FileTreeEntry 
                key={child.path} 
                entry={child} 
                level={level + 1} 
                showHidden={showHidden}
                selectedFile={selectedFile}
                expandedDirectories={expandedDirectories}
                directoryContents={directoryContents}
                onSelect={onSelect}
                onToggleDirectory={onToggleDirectory}
                onDirectoryLoaded={onDirectoryLoaded}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </>
  );
};

export const FileTreeView = forwardRef<FileTreeViewRef, FileTreeViewProps>(({ rootPath, onFileSelect, project }, ref) => {
  const [rootEntries, setRootEntries] = useState<FileSystemEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set());
  const [directoryContents, setDirectoryContents] = useState<Map<string, FileSystemEntry[]>>(new Map());
  
  // Custom sorting function for root level entries
  const sortRootEntries = (entries: FileSystemEntry[]) => {
    const priorityFolders = ['author', 'publisher', 'dispatcher', 'install'];
    
    return entries.sort((a, b) => {
      // First, separate directories from files
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      
      // If both are directories, apply priority ordering
      if (a.isDirectory && b.isDirectory) {
        const aPriority = priorityFolders.indexOf(a.name);
        const bPriority = priorityFolders.indexOf(b.name);
        
        // If both have priority, sort by priority order
        if (aPriority !== -1 && bPriority !== -1) {
          return aPriority - bPriority;
        }
        
        // If only one has priority, it comes first
        if (aPriority !== -1 && bPriority === -1) return -1;
        if (aPriority === -1 && bPriority !== -1) return 1;
        
        // If neither has priority, sort alphabetically
        return a.name.localeCompare(b.name);
      }
      
      // If both are files, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  };
  
  const loadRootEntries = async () => {
    if (!rootPath || rootPath.trim() === '') {
      setRootEntries([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const entries = await window.electronAPI.readDirectory(rootPath, showHidden);
      // Apply custom sorting for root level
      const sortedEntries = sortRootEntries(entries);
      setRootEntries(sortedEntries);
      // Store root entries in directory contents
      setDirectoryContents(prev => new Map(prev).set(rootPath, sortedEntries));
    } catch (error) {
      console.error('Error reading root directory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDirectory = (path: string, isExpanded: boolean) => {
    setExpandedDirectories(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.add(path);
      } else {
        newSet.delete(path);
      }
      return newSet;
    });
  };

  const handleDirectoryLoaded = (path: string, contents: FileSystemEntry[]) => {
    setDirectoryContents(prev => new Map(prev).set(path, contents));
  };

  const saveState = (): FileTreeState => {
    return {
      selectedFile,
      expandedDirectories: new Set(expandedDirectories),
      directoryContents: new Map(directoryContents)
    };
  };

  const restoreState = (state: FileTreeState) => {
    setSelectedFile(state.selectedFile);
    setExpandedDirectories(new Set(state.expandedDirectories));
    setDirectoryContents(new Map(state.directoryContents));
  };

  useImperativeHandle(ref, () => ({
    refresh: loadRootEntries,
    saveState,
    restoreState
  }));
  
  useEffect(() => {
    loadRootEntries();
  }, [rootPath, showHidden]);
  
  const handleFileSelect = (filePath: string) => {
    // Always update selected file and trigger callback, even if it's the same file
    setSelectedFile(filePath);
    if (onFileSelect) {
      onFileSelect(filePath);
    }
  };
  
  if (isLoading) {
    return (
      <Box p="md">
        <Loader size="sm" />
      </Box>
    );
  }
  
  return (
    <>
    <Box p="xs" style={{ borderBottom: '1px solid #2C2E33' }}>
      <Group justify="space-between" align="center">
        <Text size="xs" fw={700} c="dimmed">FILE TREE</Text>
        <Group gap="xs" align="center" style={{ height: '24px', overflow: 'hidden', margin: '-4px 0' }}>
        <ActionIcon 
            variant="subtle" 
            onClick={loadRootEntries}
            title="Refresh directory"
          >
            <IconRefresh size={16} />
          </ActionIcon>

          <ActionIcon 
              variant="subtle"
              onClick={() => setShowHidden(!showHidden)}
              title={showHidden ? "Hide hidden files" : "Show hidden files"}
            >
              {showHidden ? <IconEye size={16} /> : <IconEyeOff size={16} />}
          </ActionIcon>

          <Divider orientation='vertical' />

          <ActionIcon 
            variant="subtle"
            onClick={() => rootPath && rootPath.trim() !== '' && window.electronAPI.openInFinder(rootPath)}
            title="Open in Finder"
            disabled={!rootPath || rootPath.trim() === ''}
          >
            <IconFolder size={16} />
          </ActionIcon>

          {project && project.settings?.dev?.editor && (
            <ActionIcon 
              variant="subtle"
              onClick={() => rootPath && rootPath.trim() !== '' && window.electronAPI.openInEditor(rootPath, project)}
              title={`Open in ${project.settings.dev.editor === 'code' ? 'VS Code' : project.settings.dev.editor === 'cursor' ? 'Cursor' : project.settings.dev.editor === 'idea' ? 'IntelliJ IDEA' : 'Editor'}`}
              disabled={!rootPath || rootPath.trim() === ''}
            >
              <IconCode size={16} />
            </ActionIcon>
          )}
        </Group>
      </Group>
      </Box>
      <Stack gap={0} style={{ height: 'calc(100vh - 235px)', overflowY: 'scroll' }}>
      {rootEntries.map((entry) => (
        <FileTreeEntry 
          key={entry.path} 
          entry={entry} 
          level={0} 
          showHidden={showHidden}
          selectedFile={selectedFile}
          expandedDirectories={expandedDirectories}
          directoryContents={directoryContents}
          onSelect={handleFileSelect}
          onToggleDirectory={handleToggleDirectory}
          onDirectoryLoaded={handleDirectoryLoaded}
        />
      ))}
    </Stack>
    </>
  );
}); 