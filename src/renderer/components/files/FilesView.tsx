import React, { useState, useRef, useEffect } from 'react';
import { Grid } from '@mantine/core';
import { FileTreeView, FileTreeViewRef } from './FileTreeView';
import { EditorView } from './EditorView';
import { isBinaryFileByExtension, isBinaryContent } from '../../utils/fileUtils';
import { Project } from '../../../types/Project';

interface FilesViewProps {
  rootPath: string;
  project?: Project;
  visible?: boolean;
}

export const FilesView: React.FC<FilesViewProps> = ({ rootPath, project, visible }) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isBinaryFile, setIsBinaryFile] = useState<boolean>(false);
  const fileTreeRef = useRef<FileTreeViewRef>(null);

  const readFileContent = async (filePath: string) => {
    try {
      console.log('📁 Reading file:', filePath); // Debug log
      
      // First check if it's a binary file by extension
      if (isBinaryFileByExtension(filePath)) {
        console.log('🔢 File detected as binary by extension:', filePath); // Debug log
        setIsBinaryFile(true);
        setFileContent(null);
        return;
      }

      const result = await window.electronAPI.readFile(filePath);
      console.log('📄 File read result:', { 
        hasError: !!result.error, 
        contentLength: result.content?.length,
        error: result.error 
      }); // Debug log
      
      if (result.error) {
        console.error('❌ Error reading file:', result.error);
        setIsBinaryFile(false);
        setFileContent(`Error reading file: ${result.error}`);
      } else if (result.content) {
        // Check if the content is binary
        if (isBinaryContent(result.content)) {
          console.log('🔢 File detected as binary by content analysis:', filePath); // Debug log
          setIsBinaryFile(true);
          setFileContent(null);
        } else {
          console.log('✅ File loaded successfully:', filePath, 'Content length:', result.content.length); // Debug log
          setIsBinaryFile(false);
          setFileContent(result.content);
        }
      } else {
        console.log('⚠️ File read returned no content:', filePath); // Debug log
        setIsBinaryFile(false);
        setFileContent(null);
      }
    } catch (error) {
      console.error('💥 Exception reading file:', error);
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

  useEffect(() => {
    if (visible) {
      fileTreeRef.current?.refresh();
    }
  }, [visible]);

  return (
    <Grid style={{ height: '100%', margin: 0 }}>
      <Grid.Col style={{ height: '100%', padding: 0, width: '400px', maxWidth: '400px', flex: '0 0 400px' }}>
          <FileTreeView 
            rootPath={rootPath} 
            onFileSelect={handleFileSelect}
            project={project}
            ref={fileTreeRef}
          />
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