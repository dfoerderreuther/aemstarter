import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Group, Text, Box, Loader, ActionIcon, Divider, Menu, Modal, TextInput, Button } from '@mantine/core';
import { IconFolder, IconRefresh, IconEye, IconEyeOff, IconCode, IconPlus, IconEdit, IconTrash, IconFile, IconFolderPlus, IconCut, IconClipboard } from '@tabler/icons-react';
import { 
  UncontrolledTreeEnvironment, 
  Tree, 
  StaticTreeDataProvider,
  TreeItem,
  TreeItemIndex,
  TreeDataProvider
} from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
// import './FileTreeView.css';
import { Project } from '../../../types/Project';

export interface FileTreeState {
  selectedFile: string | null;
  expandedDirectories: Set<string>;
  treeData: any;
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

interface TreeItemData {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size?: number;
  updatedAt?: string;
}


export const FileTreeView = forwardRef<FileTreeViewRef, FileTreeViewProps>(({ rootPath, onFileSelect, project }, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [treeData, setTreeData] = useState<Record<TreeItemIndex, TreeItem<TreeItemData>>>({});
  const [dataProvider, setDataProvider] = useState<StaticTreeDataProvider<TreeItemData>>(new StaticTreeDataProvider({}));
  const [contextMenuItem, setContextMenuItem] = useState<TreeItem<TreeItemData> | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  
  // Modal states for input dialogs
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showCreateFileModal, setShowCreateFileModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [createParentPath, setCreateParentPath] = useState<string | null>(null);
  const [renameItem, setRenameItem] = useState<TreeItem<TreeItemData> | null>(null);

  // Cut/paste functionality
  const [cutItem, setCutItem] = useState<TreeItem<TreeItemData> | null>(null);

  const convertBackendDataToTreeFormat = useCallback((backendData: any): Record<TreeItemIndex, TreeItem<TreeItemData>> => {
    console.log('Converting backend data:', backendData);
    const convertedData: Record<TreeItemIndex, TreeItem<TreeItemData>> = {};
    
    Object.entries(backendData).forEach(([key, value]: [string, any]) => {
      convertedData[key] = {
        index: key,
        children: value.isFolder ? value.children : undefined,
        data: value.data,
        isFolder: value.isFolder,
        canMove: true,
        canRename: true,
      };
    });

    return convertedData;
  }, []);

  const loadTreeData = useCallback(async () => {
    if (!rootPath || rootPath.trim() === '' || !project) {
      console.log('Missing required data:', { rootPath, project: !!project });
      setIsLoading(false);
      return;
    }

    console.log('Loading tree data for:', rootPath);
    setIsLoading(true);
    
    try {
      const result = await window.electronAPI.fileTreeRead(project, rootPath, showHidden);
      console.log('Backend result:', result);
      
      if ('error' in result) {
        console.error('Failed to load directory tree:', result.error);
        setIsLoading(false);
        return;
      }

      const convertedData = convertBackendDataToTreeFormat(result);
      console.log('Setting tree data with keys:', Object.keys(convertedData));
      setTreeData(convertedData);
      
      // Use standard StaticTreeDataProvider 
      setDataProvider(new StaticTreeDataProvider(convertedData));
      
    } catch (error) {
      console.error('Error loading tree data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [rootPath, showHidden, project, convertBackendDataToTreeFormat]);

  useEffect(() => {
    loadTreeData();
  }, [loadTreeData]);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setShowContextMenu(false);
    };
    
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  const handleItemClick = useCallback((items: TreeItemIndex[]) => {
    const itemId = items[0];
    if (itemId && treeData[itemId]) {
      const item = treeData[itemId];
      console.log('Item clicked:', item);
      if (item.isFolder) {
        console.log('Folder clicked - children:', item.children);
      } else if (onFileSelect) {
        onFileSelect(item.data.path);
      }
    }
  }, [treeData, onFileSelect]);

  const startRename = useCallback((item: TreeItem<TreeItemData>) => {
    setRenameItem(item);
    setInputValue(item.data.name);
    setShowRenameModal(true);
  }, []);

  const handleRename = useCallback(async (item: TreeItem<TreeItemData>, name: string) => {
    if (!project) return;

    console.log('Renaming item:', item.data.path, 'to', name);
    try {
      const oldPath = item.data.path;
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = `${parentPath}/${name}`;

      const result = await window.electronAPI.fileTreeRename(project, oldPath, newPath);
      
      if ('error' in result) {
        console.error('Rename failed:', result.error);
        alert(`Rename failed: ${result.error}`);
        return;
      }

      console.log('Rename successful, refreshing tree');
      await loadTreeData(); // Refresh the tree
      
    } catch (error) {
      console.error('Error renaming item:', error);
      alert(`Error renaming: ${error}`);
    }
  }, [project, loadTreeData]);

  const confirmRename = useCallback(async () => {
    if (!project || !inputValue.trim() || !renameItem) return;

    await handleRename(renameItem, inputValue);
    setShowRenameModal(false);
  }, [project, inputValue, renameItem, handleRename]);

  const handleCut = useCallback((item: TreeItem<TreeItemData>) => {
    setCutItem(item);
    console.log('Cut item:', item.data.path);
  }, []);

  const handlePaste = useCallback(async (targetItem: TreeItem<TreeItemData>) => {
    if (!project || !cutItem || !targetItem.isFolder) return;

    const sourcePath = cutItem.data.path;
    const targetPath = targetItem.data.path;
    const fileName = cutItem.data.name;
    const destinationPath = `${targetPath}/${fileName}`;

    console.log(`Pasting ${sourcePath} to ${destinationPath}`);

    try {
      const result = await window.electronAPI.fileTreeMove(project, sourcePath, destinationPath);
      
      if ('error' in result) {
        console.error('Move failed:', result.error);
        alert(`Move failed: ${result.error}`);
        return;
      }

      console.log('Move successful, refreshing tree');
      setCutItem(null); // Clear cut item
      await loadTreeData(); // Refresh the tree
      
    } catch (error) {
      console.error('Error moving item:', error);
      alert(`Error moving item: ${error}`);
    }
  }, [project, cutItem, loadTreeData]);



  const handleDelete = useCallback(async (itemPath: string) => {
    if (!project || !itemPath) return;

    if (!confirm(`Are you sure you want to delete ${itemPath.split('/').pop()}?`)) {
      return;
    }

    console.log('Deleting item:', itemPath);
    try {
      const result = await window.electronAPI.fileTreeDelete(project, itemPath);
      
      if ('error' in result) {
        console.error('Delete failed:', result.error);
        alert(`Delete failed: ${result.error}`);
        return;
      }

      console.log('Delete successful, refreshing tree');
      await loadTreeData(); // Refresh the tree
      
    } catch (error) {
      console.error('Error deleting item:', error);
      alert(`Error deleting: ${error}`);
    }
  }, [project, loadTreeData]);

  const handleCreateFolder = useCallback((parentPath?: string) => {
    if (!project) return;
    
    setCreateParentPath(parentPath || rootPath);
    setInputValue('');
    setShowCreateFolderModal(true);
  }, [project, rootPath]);

  const confirmCreateFolder = useCallback(async () => {
    if (!project || !inputValue.trim() || !createParentPath) return;

    console.log('Creating folder:', inputValue, 'in', createParentPath);
    try {
      const newPath = `${createParentPath}/${inputValue}`;
      const result = await window.electronAPI.fileTreeCreateDirectory(project, newPath);
      
      if ('error' in result) {
        console.error('Create folder failed:', result.error);
        alert(`Create folder failed: ${result.error}`);
        return;
      }

      console.log('Create folder successful, refreshing tree');
      setShowCreateFolderModal(false);
      await loadTreeData(); // Refresh the tree
      
    } catch (error) {
      console.error('Error creating folder:', error);
      alert(`Error creating folder: ${error}`);
    }
  }, [project, inputValue, createParentPath, loadTreeData]);

  const handleCreateFile = useCallback((parentPath?: string) => {
    if (!project) return;
    
    setCreateParentPath(parentPath || rootPath);
    setInputValue('');
    setShowCreateFileModal(true);
  }, [project, rootPath]);

  const confirmCreateFile = useCallback(async () => {
    if (!project || !inputValue.trim() || !createParentPath) return;

    console.log('Creating file:', inputValue, 'in', createParentPath);
    try {
      const newPath = `${createParentPath}/${inputValue}`;
      const result = await window.electronAPI.fileTreeCreateFile(project, newPath);
      
      if ('error' in result) {
        console.error('Create file failed:', result.error);
        alert(`Create file failed: ${result.error}`);
        return;
      }

      console.log('Create file successful, refreshing tree');
      setShowCreateFileModal(false);
      await loadTreeData(); // Refresh the tree
      
    } catch (error) {
      console.error('Error creating file:', error);
      alert(`Error creating file: ${error}`);
    }
  }, [project, inputValue, createParentPath, loadTreeData]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: TreeItem<TreeItemData>) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Context menu for:', item.data.path);
    setContextMenuItem(item);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!project) return;

    switch (e.key) {
      case 'F2':
        e.preventDefault();
        if (contextMenuItem) {
          startRename(contextMenuItem);
        }
        break;
      case 'Delete':
        e.preventDefault();
        if (contextMenuItem) {
          handleDelete(contextMenuItem.data.path);
        }
        break;
      case 'n':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const parentPath = contextMenuItem?.isFolder ? contextMenuItem.data.path : rootPath;
          handleCreateFile(parentPath);
        }
        break;
      case 'N':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const parentPath = contextMenuItem?.isFolder ? contextMenuItem.data.path : rootPath;
          handleCreateFolder(parentPath);
        }
        break;
    }
  }, [project, contextMenuItem, startRename, handleDelete, handleCreateFile, handleCreateFolder, rootPath]);

  const saveState = useCallback((): FileTreeState => {
    return {
      selectedFile: null,
      expandedDirectories: new Set(),
      treeData: treeData
    };
  }, [treeData]);

  const restoreState = useCallback((state: FileTreeState) => {
    if (state.treeData) {
      setTreeData(state.treeData);
      setDataProvider(new StaticTreeDataProvider(state.treeData));
    }
  }, []);

  useImperativeHandle(ref, () => ({
    refresh: loadTreeData,
    saveState,
    restoreState
  }));

  if (isLoading) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed" mb="xs">Loading file tree...</Text>
        <Loader size="sm" />
      </Box>
    );
  }

  const hasData = Object.keys(treeData).length > 0;
  const rootItem = treeData[rootPath];

  console.log('Render state:', { hasData, rootItem: !!rootItem, rootPath, treeDataKeys: Object.keys(treeData) });

  return (
    <>
      <Box p="xs" style={{ borderBottom: '1px solid #2C2E33' }}>
        <Group justify="space-between" align="center">
          <Text size="xs" fw={700} c="dimmed">FILE TREE</Text>
          <Group gap="xs" align="center" style={{ height: '24px', overflow: 'hidden', margin: '-4px 0' }}>
            <ActionIcon 
              variant="subtle" 
              onClick={loadTreeData}
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

            <ActionIcon 
              variant="subtle"
              onClick={() => handleCreateFolder()}
              title="Create new folder"
            >
              <IconFolderPlus size={16} />
            </ActionIcon>

            <ActionIcon 
              variant="subtle"
              onClick={() => handleCreateFile()}
              title="Create new file"
            >
              <IconPlus size={16} />
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

      <Box 
        style={{ height: 'calc(100vh - 235px)', overflowY: 'auto', position: 'relative' }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {!hasData ? (
          <Box p="md">
            <Text size="sm" c="dimmed">No files found</Text>
          </Box>
        ) : !rootItem ? (
          <Box p="md">
            <Text size="sm" c="red">Root directory not found in data</Text>
            <Text size="xs" c="dimmed">Root path: {rootPath}</Text>
            <Text size="xs" c="dimmed">Available keys: {Object.keys(treeData).join(', ')}</Text>
          </Box>
        ) : (
          <UncontrolledTreeEnvironment
            dataProvider={dataProvider}
            getItemTitle={(item) => item.data.name}
            viewState={{
              'file-tree': {
                
              }
            }}
            onSelectItems={handleItemClick}
            onFocusItem={(item: TreeItem<TreeItemData>) => {
              setContextMenuItem(item);
            }}
            onExpandItem={(item) => {
              console.log('Item expanded:', item.data.name, 'with', item.children?.length || 0, 'children');
            }}
            onCollapseItem={(item) => {
              console.log('Item collapsed:', item.data.name);
            }}
            canDragAndDrop={true}
            canDropOnFolder={true}
            canReorderItems={true}
            onRenameItem={handleRename}
            onDrop={async (items, target) => {
              if (!project) return;
              
              console.log('Drag and drop:', items, 'to', target);
              
              let targetPath: string;
              if (target.targetType === 'item') {
                const targetItem = treeData[target.targetItem];
                if (!targetItem?.isFolder) return;
                targetPath = targetItem.data.path;
              } else if (target.targetType === 'between-items') {
                const parentItem = treeData[target.parentItem];
                if (!parentItem?.isFolder) return;
                targetPath = parentItem.data.path;
              } else {
                targetPath = rootPath;
              }

              for (const draggedItem of items) {
                const sourcePath = draggedItem.data.path;
                const fileName = draggedItem.data.name;
                const destinationPath = `${targetPath}/${fileName}`;

                console.log(`Moving: ${fileName} → ${targetPath}`);

                try {
                  const result = await window.electronAPI.fileTreeMove(project, sourcePath, destinationPath);
                  
                  if ('error' in result) {
                    console.error('File system move failed:', result.error);
                    alert(`Move failed: ${result.error}`);
                    return;
                  }
                } catch (error) {
                  console.error('Error during file system move:', error);
                  alert(`Error moving item: ${error}`);
                  return;
                }
              }

              await loadTreeData();
            }}
            renderItemTitle={({ title, item }) => (
              <div 
                style={{ opacity: cutItem?.data.path === item.data.path ? 0.5 : 1 }}
                onContextMenu={(e) => handleContextMenu(e, item)}
              >
                {title}
              </div>
            )}
          >
            <Tree treeId="file-tree" rootItem={rootPath} treeLabel="File Tree" />
          </UncontrolledTreeEnvironment>
        )}

        {/* Context Menu */}
        {showContextMenu && contextMenuItem && contextMenuPosition && (
          <Box
            style={{
              position: 'fixed',
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
              zIndex: 1000,
              background: '#2C2E33',
              border: '1px solid #495057',
              borderRadius: '6px',
              minWidth: '160px',
              boxShadow: '0 10px 38px -10px rgba(22, 23, 24, 0.35), 0 10px 20px -15px rgba(22, 23, 24, 0.2)',
              padding: '4px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenuItem.isFolder && (
              <>
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#c9c9c9',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3B5BBC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => {
                    handleCreateFolder(contextMenuItem.data.path);
                    setShowContextMenu(false);
                  }}
                >
                  <IconFolderPlus size={16} />
                  New Folder
                </Box>
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#c9c9c9',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3B5BBC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => {
                    handleCreateFile(contextMenuItem.data.path);
                    setShowContextMenu(false);
                  }}
                >
                  <IconPlus size={16} />
                  New File
                </Box>
                <div style={{ height: '1px', background: '#495057', margin: '4px 0' }} />
                {cutItem && (
                  <Box
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#51cf66',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#51cf66'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onClick={() => {
                      handlePaste(contextMenuItem);
                      setShowContextMenu(false);
                    }}
                  >
                    <IconClipboard size={16} />
                    Paste "{cutItem.data.name}"
                  </Box>
                )}
              </>
            )}
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#c9c9c9',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3B5BBC'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => {
                startRename(contextMenuItem);
                setShowContextMenu(false);
              }}
            >
              <IconEdit size={16} />
              Rename
            </Box>
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#ffd43b',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffd43b'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => {
                handleCut(contextMenuItem);
                setShowContextMenu(false);
              }}
            >
              <IconCut size={16} />
              Cut
            </Box>
            <div style={{ height: '1px', background: '#495057', margin: '4px 0' }} />
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#fa5252',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fa5252'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => {
                handleDelete(contextMenuItem.data.path);
                setShowContextMenu(false);
              }}
            >
              <IconTrash size={16} />
              Delete
            </Box>
          </Box>
        )}

        {/* Create Folder Modal */}
        <Modal
          opened={showCreateFolderModal}
          onClose={() => setShowCreateFolderModal(false)}
          title="Create New Folder"
          size="sm"
        >
          <TextInput
            label="Folder name"
            placeholder="Enter folder name"
            value={inputValue}
            onChange={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmCreateFolder();
              }
            }}
            data-autofocus
          />
          <Group mt="md" justify="flex-end">
            <Button variant="subtle" onClick={() => setShowCreateFolderModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCreateFolder} disabled={!inputValue.trim()}>
              Create
            </Button>
          </Group>
        </Modal>

        {/* Create File Modal */}
        <Modal
          opened={showCreateFileModal}
          onClose={() => setShowCreateFileModal(false)}
          title="Create New File"
          size="sm"
        >
          <TextInput
            label="File name"
            placeholder="Enter file name"
            value={inputValue}
            onChange={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmCreateFile();
              }
            }}
            data-autofocus
          />
          <Group mt="md" justify="flex-end">
            <Button variant="subtle" onClick={() => setShowCreateFileModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCreateFile} disabled={!inputValue.trim()}>
              Create
            </Button>
          </Group>
        </Modal>

        {/* Rename Modal */}
        <Modal
          opened={showRenameModal}
          onClose={() => setShowRenameModal(false)}
          title="Rename Item"
          size="sm"
        >
          <TextInput
            label="New name"
            placeholder="Enter new name"
            value={inputValue}
            onChange={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmRename();
              }
            }}
            data-autofocus
          />
          <Group mt="md" justify="flex-end">
            <Button variant="subtle" onClick={() => setShowRenameModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRename} disabled={!inputValue.trim()}>
              Rename
            </Button>
          </Group>
        </Modal>
      </Box>
    </>
  );
}); 