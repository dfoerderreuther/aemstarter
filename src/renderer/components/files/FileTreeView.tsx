import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Group, Text, Box, Loader, ActionIcon, Divider, Menu, Modal, TextInput, Button } from '@mantine/core';
import { IconFolder, IconRefresh, IconEye, IconEyeOff, IconCode, IconPlus, IconEdit, IconTrash, IconFile, IconFolderPlus, IconCut, IconClipboard } from '@tabler/icons-react';
import { Tree, TreeApi, NodeApi } from 'react-arborist';
import './FileTreeView.css';
import { Project } from '../../../types/Project';

export interface FileTreeState {
  selectedFile: string | null;
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

interface NodeData {
  id: string;
  name: string;
  path: string;
  children?: NodeData[];
}

export const FileTreeView = forwardRef<FileTreeViewRef, FileTreeViewProps>(({ rootPath, onFileSelect, project }, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [treeData, setTreeData] = useState<NodeData[]>([]);
  const treeApi = React.useRef<TreeApi<NodeData>>(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showCreateFileModal, setShowCreateFileModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [createParentNode, setCreateParentNode] = useState<NodeApi<NodeData> | null>(null);
  const [renameNode, setRenameNode] = useState<NodeApi<NodeData> | null>(null);
  const [contextMenuNode, setContextMenuNode] = useState<NodeApi<NodeData> | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const loadTreeData = useCallback(async () => {
    if (!rootPath || !project) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Only load the root level initially
      const result = await window.electronAPI.readDirectory(rootPath, showHidden);
      
      if ('error' in result) {
        console.error('Failed to load root directory:', result.error);
        setTreeData([]);
        return;
      }

      // Convert flat directory listing to tree nodes
      const treeNodes: NodeData[] = result.map(item => ({
        id: item.path,
        name: item.name,
        path: item.path,
        children: item.isDirectory ? [] : undefined, // Empty array for directories, undefined for files
      }));

      setTreeData(treeNodes);
    } catch (error) {
      console.error('Error loading tree data:', error);
      setTreeData([]);
    } finally {
      setIsLoading(false);
    }
  }, [rootPath, showHidden, project]);

  // Load children for a specific directory
  const loadChildren = useCallback(async (node: NodeApi<NodeData>) => {
    if (!project || node.isLeaf) return;
    
    try {
      const result = await window.electronAPI.readDirectory(node.data.path, showHidden);
      
      if ('error' in result) {
        console.error('Failed to load directory children:', result.error);
        return;
      }

      // Convert to tree nodes
      const childNodes: NodeData[] = result.map(item => ({
        id: item.path,
        name: item.name,
        path: item.path,
        children: item.isDirectory ? [] : undefined,
      }));

      // Update the tree data by replacing this node's children
      setTreeData(prevData => {
        const updateNodeChildren = (nodes: NodeData[]): NodeData[] => {
          return nodes.map(n => {
            if (n.id === node.data.id) {
              return { ...n, children: childNodes };
            }
            if (n.children) {
              return { ...n, children: updateNodeChildren(n.children) };
            }
            return n;
          });
        };
        return updateNodeChildren(prevData);
      });
    } catch (error) {
      console.error('Error loading children:', error);
    }
  }, [project, showHidden]);

  useEffect(() => {
    loadTreeData();
  }, [loadTreeData]);

  useImperativeHandle(ref, () => ({
    refresh: loadTreeData,
    saveState: () => ({ selectedFile: treeApi.current?.focusedNode?.data.path || null }),
    restoreState: (state: FileTreeState) => {
      if (state.selectedFile) {
        treeApi.current?.focus(state.selectedFile);
      }
    }
  }));

  const handleContextMenu = useCallback((event: React.MouseEvent, node: NodeApi<NodeData>) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuNode(node);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setContextMenuNode(null);
    if (contextMenuNode) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuNode]);

  const handleCreateFolder = useCallback(async () => {
    if (!project || !inputValue.trim() || !createParentNode) return;
    const newPath = `${createParentNode.data.path}/${inputValue}`;
    const result = await window.electronAPI.fileTreeCreateDirectory(project, newPath);
    if ('error' in result) {
      console.error('Create folder failed:', result.error);
      alert(`Create folder failed: ${result.error}`);
    } else {
      loadTreeData();
    }
    setShowCreateFolderModal(false);
  }, [project, inputValue, createParentNode, loadTreeData]);

  const handleCreateFile = useCallback(async () => {
    if (!project || !inputValue.trim() || !createParentNode) return;
    const newPath = `${createParentNode.data.path}/${inputValue}`;
    const result = await window.electronAPI.fileTreeCreateFile(project, newPath);
    if ('error' in result) {
      console.error('Create file failed:', result.error);
      alert(`Create file failed: ${result.error}`);
    } else {
      loadTreeData();
    }
    setShowCreateFileModal(false);
  }, [project, inputValue, createParentNode, loadTreeData]);

  const handleRename = useCallback(async () => {
    if (!project || !inputValue.trim() || !renameNode) return;
    const oldPath = renameNode.data.path;
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parentPath}/${inputValue}`;
    const result = await window.electronAPI.fileTreeRename(project, oldPath, newPath);
    if ('error' in result) {
      console.error('Rename failed:', result.error);
      alert(`Rename failed: ${result.error}`);
    } else {
      loadTreeData();
    }
    setShowRenameModal(false);
  }, [project, inputValue, renameNode, loadTreeData]);

  const handleDelete = useCallback(async (node: NodeApi<NodeData>) => {
    if (!project) return;
    if (confirm(`Are you sure you want to delete ${node.data.name}?`)) {
      const result = await window.electronAPI.fileTreeDelete(project, node.data.path);
      if ('error' in result) {
        console.error('Delete failed:', result.error);
        alert(`Delete failed: ${result.error}`);
      } else {
        loadTreeData();
      }
    }
  }, [project, loadTreeData]);

  if (isLoading) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed" mb="xs">Loading file tree...</Text>
        <Loader size="sm" />
      </Box>
    );
  }

  return (
    <Box>
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
              onClick={() => treeApi.current?.create({ parentId: null, type: "internal" })}
              title="Create new folder"
            >
              <IconFolderPlus size={16} />
            </ActionIcon>

            <ActionIcon 
              variant="subtle"
              onClick={() => treeApi.current?.create({ parentId: null, type: "leaf" })}
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
        <Tree
            ref={treeApi}
            data={treeData}
            openByDefault={false}
            width={600}
            height={1000}
            indent={24}
            rowHeight={32}
            disableEdit={true}
            disableDrop={false}
            onActivate={async (node) => {
                console.log('Node activated:', node.data.name, 'Level:', node.level, 'IsLeaf:', node.isLeaf);
                if (node.isLeaf) {
                    onFileSelect && onFileSelect(node.data.path);
                } else {
                    // For directories, toggle and load children if needed
                    if (!node.isOpen) {
                        // Load children before opening if they haven't been loaded yet
                        if (node.data.children && node.data.children.length === 0) {
                            console.log('Loading children for:', node.data.name);
                            await loadChildren(node);
                        }
                    }
                    node.toggle();
                    node.select();
                }
            }}
            onToggle={async (id: string) => {
                // Load children when a directory is opened for the first time
                const node = treeApi.current?.get(id);
                if (node && node.isInternal && node.isOpen && node.data.children && node.data.children.length === 0) {
                    await loadChildren(node);
                }
            }}
            onMove={async ({ dragIds, parentId, index }) => {
                if (!project) return;
                const parentNode = treeApi.current?.get(parentId);
                if (!parentNode) return;

                for (const id of dragIds) {
                    const node = treeApi.current?.get(id);
                    if (!node) continue;

                    const sourcePath = node.data.path;
                    const destinationPath = `${parentNode.data.path}/${node.data.name}`;

                    console.log(`Moving ${sourcePath} to ${destinationPath}`);
                    
                    const result = await window.electronAPI.fileTreeMove(project, sourcePath, destinationPath);

                    if ('error' in result) {
                        console.error('Move failed:', result.error);
                        alert(`Move failed: ${result.error}`);
                        loadTreeData();
                        break; 
                    }
                }
                loadTreeData();
            }}
        >
            {({ node, style, dragHandle }) => (
                <div
                    ref={dragHandle}
                    style={{
                        ...style,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        backgroundColor: node.isSelected ? '#3b5bdb' : 'transparent',
                        transition: 'background-color 0.1s ease-in-out',
                        // Don't override positioning - let react-arborist handle indentation
                        position: style.position,
                        left: style.left,
                        top: style.top,
                        width: style.width,
                        height: style.height,
                    }}
                    onMouseEnter={(e) => {
                        if (!node.isSelected) {
                            e.currentTarget.style.backgroundColor = '#2c2e33';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!node.isSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, node)}
                >
                    <Group gap="xs" style={{ width: '100%', paddingLeft: node.level * 24 }}>
                        {node.isLeaf ? <IconFile size={16} /> : <IconFolder size={16} />}
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {node.data.name}
                        </span>
                        <span style={{ fontSize: '10px', color: '#666', marginLeft: 'auto' }}>
                            L{node.level}
                        </span>
                    </Group>
                </div>
            )}
        </Tree>
        <Menu opened={!!contextMenuNode} onClose={() => setContextMenuNode(null)} shadow="md" width={200}>
            {contextMenuNode && contextMenuPosition && (
                <Menu.Dropdown
                    style={{
                        position: 'absolute',
                        left: contextMenuPosition.x,
                        top: contextMenuPosition.y,
                    }}
                >
                    <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => {
                        setRenameNode(contextMenuNode);
                        setInputValue(contextMenuNode.data.name);
                        setShowRenameModal(true);
                    }}>
                    Rename
                    </Menu.Item>
                    <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => handleDelete(contextMenuNode)}>
                    Delete
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item leftSection={<IconFolderPlus size={14} />} onClick={() => {
                        setCreateParentNode(contextMenuNode.isLeaf ? contextMenuNode.parent : contextMenuNode);
                        setShowCreateFolderModal(true);
                    }}>
                    New Folder
                    </Menu.Item>
                    <Menu.Item leftSection={<IconPlus size={14} />} onClick={() => {
                        setCreateParentNode(contextMenuNode.isLeaf ? contextMenuNode.parent : contextMenuNode);
                        setShowCreateFileModal(true);
                    }}>
                    New File
                    </Menu.Item>
                </Menu.Dropdown>
            )}
        </Menu>
        <Modal opened={showCreateFolderModal} onClose={() => setShowCreateFolderModal(false)} title="Create New Folder">
            <TextInput label="Folder Name" value={inputValue} onChange={(e) => setInputValue(e.currentTarget.value)} />
            <Button mt="md" onClick={handleCreateFolder}>Create</Button>
        </Modal>
        <Modal opened={showCreateFileModal} onClose={() => setShowCreateFileModal(false)} title="Create New File">
            <TextInput label="File Name" value={inputValue} onChange={(e) => setInputValue(e.currentTarget.value)} />
            <Button mt="md" onClick={handleCreateFile}>Create</Button>
        </Modal>
        <Modal opened={showRenameModal} onClose={() => setShowRenameModal(false)} title="Rename Item">
            <TextInput label="New Name" value={inputValue} onChange={(e) => setInputValue(e.currentTarget.value)} />
            <Button mt="md" onClick={handleRename}>Rename</Button>
        </Modal>
    </Box>
  );
}); 