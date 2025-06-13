import React, { useState, useRef } from 'react';
import { Grid, ScrollArea, Box, Text } from '@mantine/core';
import { FileTreeView, FileTreeViewRef } from './FileTreeView';
import { EditorView } from './EditorView';
import { isBinaryFileByExtension, isBinaryContent } from '../../utils/fileUtils';

interface FilesViewProps {
  rootPath: string;
}

export const FilesView: React.FC<FilesViewProps> = ({ rootPath }) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isBinaryFile, setIsBinaryFile] = useState<boolean>(false);
  const fileTreeRef = useRef<FileTreeViewRef>(null);

  const readFileContent = async (filePath: string) => {
    try {
      // First check if it's a binary file by extension
      if (isBinaryFileByExtension(filePath)) {
        setIsBinaryFile(true);
        setFileContent(null);
        return;
      }

      const result = await window.electronAPI.readFile(filePath);
      if (result.error) {
        setIsBinaryFile(false);
        setFileContent(`Error reading file: ${result.error}`);
      } else if (result.content) {
        // Check if the content is binary
        if (isBinaryContent(result.content)) {
          setIsBinaryFile(true);
          setFileContent(null);
        } else {
          setIsBinaryFile(false);
          setFileContent(result.content);
        }
      } else {
        setIsBinaryFile(false);
        setFileContent(null);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      setIsBinaryFile(false);
      setFileContent(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleFileSelect = async (filePath: string) => {
    // Always clear the current content first
    setSelectedFile(null);
    setFileContent(null);
    setIsBinaryFile(false);
    
    // Then set the new file and read its content
    setSelectedFile(filePath);
    await readFileContent(filePath);
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFileContent(null);
    setIsBinaryFile(false);
  };

  const handleSave = async (content: string) => {
    if (!selectedFile) return;
    
    try {
      const result = await window.electronAPI.writeFile(selectedFile, content);
      if (result.error) {
        console.error('Error saving file:', result.error);
      }
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  const handleRefresh = async () => {
    if (selectedFile) {
      await readFileContent(selectedFile);
    }
  };

  return (
    <Grid style={{ height: '100%', margin: 0 }}>
      <Grid.Col style={{ height: '100%', padding: 0, width: '400px', maxWidth: '400px', flex: '0 0 400px' }}>
        <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box p="xs" style={{ borderBottom: '1px solid #2C2E33' }}>
            <Text size="xs" fw={700} c="dimmed">FILE TREE</Text>
          </Box>
          <ScrollArea h="100%" scrollbarSize={6}>
            <FileTreeView 
              rootPath={rootPath} 
              onFileSelect={handleFileSelect}
              ref={fileTreeRef}
            />
          </ScrollArea>
        </Box>
      </Grid.Col>
      
      <Grid.Col style={{ height: '100%', padding: 0, borderLeft: '1px solid #2C2E33', flex: 1 }}>
        <EditorView
          selectedFile={selectedFile}
          initialContent={fileContent}
          isBinaryFile={isBinaryFile}
          onSave={handleSave}
          onClose={handleClose}
          onRefresh={handleRefresh}
        />
      </Grid.Col>
    </Grid>
  );
}; 