import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Collapse, Group, Text, Box, Stack, Loader, UnstyledButton, ActionIcon } from '@mantine/core';
import { IconFolder, IconFolderOpen, IconFile, IconChevronRight, IconChevronDown, IconRefresh, IconEye, IconEyeOff, IconPhoto, IconFileZip, IconMusic, IconVideo, IconFileText } from '@tabler/icons-react';
import { isBinaryFileByExtension, getFileExtension } from '../utils/fileUtils';

export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
}

interface FileTreeEntryProps {
  entry: FileSystemEntry;
  level: number;
  showHidden: boolean;
  selectedFile: string | null;
  onSelect: (path: string) => void;
}

interface FileTreeViewProps {
  rootPath: string;
  onFileSelect?: (filePath: string) => void;
}

export interface FileTreeViewRef {
  refresh: () => Promise<void>;
}

const FileTreeEntry: React.FC<FileTreeEntryProps> = ({ 
  entry, 
  level, 
  showHidden, 
  selectedFile, 
  onSelect 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileSystemEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const indent = level * 16;
  
  const toggleDirectory = async () => {
    if (!entry.isDirectory) {
      onSelect(entry.path);
      return;
    }
    
    if (!isOpen) {
      setIsLoading(true);
      try {
        const entries = await window.electronAPI.readDirectory(entry.path, showHidden);
        // Sort directories first, then files alphabetically
        entries.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        setChildren(entries);
      } catch (error) {
        console.error('Error reading directory:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    setIsOpen(!isOpen);
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
                onSelect={onSelect}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </>
  );
};

export const FileTreeView = forwardRef<FileTreeViewRef, FileTreeViewProps>(({ rootPath, onFileSelect }, ref) => {
  const [rootEntries, setRootEntries] = useState<FileSystemEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const loadRootEntries = async () => {
    setIsLoading(true);
    try {
      const entries = await window.electronAPI.readDirectory(rootPath, showHidden);
      // Sort directories first, then files alphabetically
      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      setRootEntries(entries);
    } catch (error) {
      console.error('Error reading root directory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: loadRootEntries
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
    <Stack gap={0}>
      <Group p="xs" justify="space-between">
        <Group gap="xs">
          <IconFolder size={16} />
          <Text size="sm" fw={500}>Project Files</Text>
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
        </Group>
      </Group>
      {rootEntries.map((entry) => (
        <FileTreeEntry 
          key={entry.path} 
          entry={entry} 
          level={0} 
          showHidden={showHidden}
          selectedFile={selectedFile}
          onSelect={handleFileSelect}
        />
      ))}
    </Stack>
  );
}); 