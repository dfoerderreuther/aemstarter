import React, { useState, useRef } from 'react';
import { Grid, ScrollArea, Box, Text } from '@mantine/core';
import { FileTreeView, FileTreeViewRef } from './FileTreeView';
import { EditorView } from './EditorView';

interface FilesViewProps {
  rootPath: string;
}

export const FilesView: React.FC<FilesViewProps> = ({ rootPath }) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const fileTreeRef = useRef<FileTreeViewRef>(null);

  const handleFileSelect = async (filePath: string) => {
    try {
      setSelectedFile(filePath);
      const result = await window.electronAPI.readFile(filePath);
      if (result.error) {
        setFileContent(`Error reading file: ${result.error}`);
      } else {
        setFileContent(result.content || null);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      setFileContent(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setFileContent(null);
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

  return (
    <Grid grow style={{ height: '100%', margin: 0 }}>
      <Grid.Col span={4} style={{ height: '100%', padding: 0 }}>
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
      
      <Grid.Col span={8} style={{ height: '100%', padding: 0, borderLeft: '1px solid #2C2E33' }}>
        <EditorView
          selectedFile={selectedFile}
          initialContent={fileContent}
          onSave={handleSave}
          onClose={handleClose}
        />
      </Grid.Col>
    </Grid>
  );
}; 