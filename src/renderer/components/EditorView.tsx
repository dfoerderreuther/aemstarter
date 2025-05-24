import React, { useCallback, useEffect, useState } from 'react';
import { Box, Group, Text, ActionIcon, Tooltip } from '@mantine/core';
import { IconDeviceFloppy, IconX, IconRefresh } from '@tabler/icons-react';
import Editor, { useMonaco, loader } from "@monaco-editor/react";

// Configure Monaco Editor to use local files
loader.config({
  paths: {
    vs: '/monaco-editor/vs'
  }
});

interface EditorViewProps {
  selectedFile: string | null;
  initialContent: string | null;
  onSave: (content: string) => Promise<void>;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}

export const EditorView: React.FC<EditorViewProps> = ({ 
  selectedFile, 
  initialContent,
  onSave,
  onClose,
  onRefresh
}) => {
  const [fileContent, setFileContent] = useState<string | null>(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const monaco = useMonaco();

  const getFileLanguage = useCallback((filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'xml': 'xml',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'cpp',
      'hpp': 'cpp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'sh': 'shell',
      'yaml': 'yaml',
      'yml': 'yaml',
      'properties': 'properties'
    };
    return ext ? languageMap[ext] || 'plaintext' : 'plaintext';
  }, []);

  const handleSave = async () => {
    if (!fileContent) return;
    
    try {
      setIsSaving(true);
      await onSave(fileContent);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Set up Monaco Editor keyboard shortcuts
  useEffect(() => {
    if (monaco) {
      monaco.editor.addKeybindingRule({
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        command: 'editor.action.customSave',
        when: 'editorTextFocus'
      });

      // Register the command
      monaco.editor.addEditorAction({
        id: 'editor.action.customSave',
        label: 'Save',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: handleSave
      });
    }
  }, [monaco, handleSave]);

  // Update content when initialContent changes
  useEffect(() => {
    setFileContent(initialContent);
  }, [initialContent]);

  const getBasename = (path: string): string => {
    return path.split(/[\\/]/).pop() || '';
  };

  return (
    <>
      <Box p="xs" style={{ borderBottom: '1px solid #2C2E33' }}>
        <Group justify="space-between" align="center">
          <Text size="xs" fw={700} c="dimmed">FILE CONTENT</Text>
          <Group gap="xs" align="center" style={{ height: '24px', overflow: 'hidden', margin: '-4px 0' }}>
            {selectedFile && (
              <>
                <Text size="xs" fw={500}>
                  {getBasename(selectedFile)}
                </Text>
                <Tooltip 
                  label="Refresh file" 
                  withArrow 
                  withinPortal
                  position="bottom"
                >
                  <ActionIcon 
                    variant="subtle" 
                    color="blue"
                    onClick={handleRefresh}
                    loading={isRefreshing}
                    size="sm"
                  >
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip 
                  label="Save (⌘S)" 
                  withArrow 
                  withinPortal
                  position="bottom"
                >
                  <ActionIcon 
                    variant="subtle" 
                    color="blue"
                    onClick={handleSave}
                    loading={isSaving}
                    disabled={!fileContent}
                    size="sm"
                  >
                    <IconDeviceFloppy size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip 
                  label="Close file" 
                  withArrow 
                  withinPortal
                  position="bottom"
                >
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={onClose}
                    size="sm"
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
          </Group>
        </Group>
      </Box>
      <Box style={{ height: 'calc(100vh - 197px)' }}>
        {fileContent ? (
          <Editor
            height="100%"
            className="monaco-editor-container"
            language={selectedFile ? getFileLanguage(selectedFile) : 'plaintext'}
            value={fileContent}
            onChange={(value) => setFileContent(value || null)}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 10 },
              renderWhitespace: 'selection',
              rulers: [80, 120],
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
              formatOnType: true,
              tabSize: 2,
              autoIndent: 'full',
              renderLineHighlight: 'all'
            }}
            path={selectedFile || undefined}
          />
        ) : (
          <Text p="md" size="sm" c="dimmed">
            Select a file to view its content
          </Text>
        )}
      </Box>
    </>
  );
}; 