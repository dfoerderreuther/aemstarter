import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import { Group, Text, Box, Loader, ActionIcon, Divider, Menu, Modal, TextInput, Button } from '@mantine/core';
import { IconFolder, IconRefresh, IconEye, IconEyeOff, IconCode, IconPlus, IconEdit, IconTrash, IconFile, IconFolderPlus } from '@tabler/icons-react';
import { Tree, TreeApi, NodeApi } from 'react-arborist';
import './FileTreeView.css';
import { Project } from '../../../types/Project';
import { useElementSize, useMergedRef } from '@mantine/hooks';

export interface FileTreeState {
  selectedFile: string | null;
  expandedDirectories: Set<string>;
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
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set());

  const treeApi = useRef<TreeApi<NodeData>>(null);
  const treeContainerRef = useRef<HTMLDivElement | null>(null);
  const { ref: elementSizeRef, width: containerWidth, height: containerHeight } = useElementSize<HTMLDivElement>();
  const treeContainerMergedRef = useMergedRef<HTMLDivElement>(treeContainerRef, elementSizeRef);
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

      // After updating tree data, restore expanded state for child directories
      setTimeout(() => {
        if (treeApi.current) {
          childNodes.forEach(childNode => {
            if (childNode.children) {
              setExpandedDirectories(currentExpanded => {
                if (currentExpanded.has(childNode.path)) {
                  const treeNode = treeApi.current?.get(childNode.path);
                  if (treeNode && !treeNode.isOpen) {
                    treeNode.open();
                  }
                }
                return currentExpanded;
              });
            }
          });
        }
      }, 50);

      return true; // Return success
    } catch (error) {
      console.error('Error loading children:', error);
      return false;
    }
  }, [project, showHidden]);

  // Recursively restore expanded directories with lazy loading
  const restoreExpandedDirectories = useCallback(async (expandedPaths: Set<string>) => {
    if (!treeApi.current || expandedPaths.size === 0) {
      console.log('🔄 No tree API or no expanded paths to restore');
      return;
    }

    console.log('🔄 Restoring expanded directories:', Array.from(expandedPaths));

    // Sort paths by depth (shorter paths first) to ensure parents are expanded before children
    const sortedPaths = Array.from(expandedPaths).sort((a, b) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      return depthA - depthB;
    });

    console.log('🔄 Sorted paths by depth:', sortedPaths);

    for (const dirPath of sortedPaths) {
      console.log(`🔄 Processing directory: ${dirPath}`);
      
      // Get the node - it should be immediately available for local file system
      const node = treeApi.current.get(dirPath);
      
      if (!node) {
        console.log(`🔄 Node not found for path: ${dirPath}`);
        continue;
      }
      
      console.log(`🔄 Found node: ${node.data.name}, isInternal: ${node.isInternal}, isOpen: ${node.isOpen}`);
      
      if (node.isInternal && !node.isOpen) {
        // Load children if not loaded yet
        if (node.data.children && node.data.children.length === 0) {
          console.log(`🔄 Loading children for: ${node.data.name}`);
          const loaded = await loadChildren(node);
          console.log(`🔄 Children loaded successfully: ${loaded}`);
          
          if (!loaded) {
            console.log(`🔄 Failed to load children for: ${node.data.name}`);
            continue; // Skip if loading failed
          }
          
          // Small delay to allow React to re-render after loading children
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        console.log(`🔄 Opening directory: ${node.data.name}`);
        // Open the directory - should be immediate for local file system
        node.open();
      }
    }
    
    console.log('🔄 Finished processing all directories');
  }, [loadChildren]);

  useEffect(() => {
    loadTreeData();
  }, [loadTreeData]);

  // Restore expanded state after full tree reloads
  useEffect(() => {
    if (treeData.length > 0 && treeApi.current && expandedDirectories.size > 0) {
      setTimeout(() => {
        if (treeApi.current) {
          expandedDirectories.forEach(dirPath => {
            const node = treeApi.current?.get(dirPath);
            if (node && node.isInternal && !node.isOpen) {
              node.open();
            }
          });
        }
      }, 100);
    }
  }, [treeData]);

  useImperativeHandle(ref, () => ({
    refresh: loadTreeData,
    saveState: () => ({ 
      selectedFile: treeApi.current?.focusedNode?.data.path || null,
      expandedDirectories: new Set(expandedDirectories)
    }),
    restoreState: async (state: FileTreeState) => {
      console.log('🔄 Restoring file tree state:', state);
      console.log('🔄 Expanded directories:', state.expandedDirectories);
      
      if (state.expandedDirectories && state.expandedDirectories.size > 0) {
        setExpandedDirectories(new Set(state.expandedDirectories));
        console.log('🔄 Set expanded directories, starting restoration...');
        
        if (treeApi.current && treeData.length > 0) {
          console.log('🔄 Tree is loaded, proceeding with restoration');
          await restoreExpandedDirectories(state.expandedDirectories);
          
          // Restore selected file after tree is fully expanded
          if (state.selectedFile && treeApi.current) {
            console.log('🔄 Restoring selected file:', state.selectedFile);
            treeApi.current.focus(state.selectedFile);
          }
        } else {
          console.log('🔄 Tree not yet loaded, will restore when loaded');
          // Note: We'll just set the expanded directories and let the tree expand naturally
          // when nodes are accessed, since we no longer do full reloads
        }
      } else if (state.selectedFile && treeApi.current) {
        console.log('🔄 Only restoring selected file:', state.selectedFile);
        treeApi.current.focus(state.selectedFile);
      }
    }
  }), [loadTreeData, expandedDirectories, restoreExpandedDirectories, treeData]);

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
      // Instead of reloading entire tree, just refresh the parent node
      if (createParentNode.data.path === rootPath) {
        // If creating in root, reload the tree
        await loadTreeData();
      } else {
        // Find the parent node and reload its children
        const parentNode = treeApi.current?.get(createParentNode.data.path);
        if (parentNode) {
          await loadChildren(parentNode);
        }
      }
    }
    setShowCreateFolderModal(false);
  }, [project, inputValue, createParentNode, loadTreeData, loadChildren, rootPath]);

  const handleCreateFile = useCallback(async () => {
    if (!project || !inputValue.trim() || !createParentNode) return;
    
    const newPath = `${createParentNode.data.path}/${inputValue}`;
    const result = await window.electronAPI.fileTreeCreateFile(project, newPath);
    
    if ('error' in result) {
      console.error('Create file failed:', result.error);
      alert(`Create file failed: ${result.error}`);
    } else {
      // Instead of reloading entire tree, just refresh the parent node
      if (createParentNode.data.path === rootPath) {
        // If creating in root, reload the tree
        await loadTreeData();
      } else {
        // Find the parent node and reload its children
        const parentNode = treeApi.current?.get(createParentNode.data.path);
        if (parentNode) {
          await loadChildren(parentNode);
        }
      }
    }
    setShowCreateFileModal(false);
  }, [project, inputValue, createParentNode, loadTreeData, loadChildren, rootPath]);

  const handleRename = useCallback(async () => {
    if (!project || !inputValue.trim() || !renameNode) return;
    
    const oldPath = renameNode.data.path;
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parentPath}/${inputValue}`;
    
    // If renaming changed the path of an expanded directory, update the expanded state
    const updatedExpandedDirs = new Set(expandedDirectories);
    if (updatedExpandedDirs.has(oldPath)) {
      updatedExpandedDirs.delete(oldPath);
      updatedExpandedDirs.add(newPath);
    }
    
    const result = await window.electronAPI.fileTreeRename(project, oldPath, newPath);
    
    if ('error' in result) {
      console.error('Rename failed:', result.error);
      alert(`Rename failed: ${result.error}`);
    } else {
      // Update expanded directories if needed
      if (updatedExpandedDirs !== expandedDirectories) {
        setExpandedDirectories(updatedExpandedDirs);
      }
      
      // Instead of reloading entire tree, just refresh the parent node
      if (parentPath === rootPath) {
        // If parent is root, reload the tree
        await loadTreeData();
      } else {
        // Find the parent node and reload its children
        const parentNode = treeApi.current?.get(parentPath);
        if (parentNode) {
          await loadChildren(parentNode);
        }
      }
    }
    setShowRenameModal(false);
  }, [project, inputValue, renameNode, loadTreeData, loadChildren, rootPath, expandedDirectories]);

  const handleDelete = useCallback(async (node: NodeApi<NodeData>) => {
    if (!project) return;
    if (confirm(`Are you sure you want to delete ${node.data.name}?`)) {
      const deletePath = node.data.path;
      const parentPath = deletePath.substring(0, deletePath.lastIndexOf('/'));
      
      // Remove the deleted path and any child paths from expanded directories
      const updatedExpandedDirs = new Set(expandedDirectories);
      Array.from(updatedExpandedDirs).forEach(path => {
        if (path === deletePath || path.startsWith(deletePath + '/')) {
          updatedExpandedDirs.delete(path);
        }
      });
      
      const result = await window.electronAPI.fileTreeDelete(project, deletePath);
      
      if ('error' in result) {
        console.error('Delete failed:', result.error);
        alert(`Delete failed: ${result.error}`);
      } else {
        // Update expanded directories
        if (updatedExpandedDirs.size !== expandedDirectories.size) {
          setExpandedDirectories(updatedExpandedDirs);
        }
        
        // Instead of reloading entire tree, just refresh the parent node
        if (parentPath === rootPath || parentPath === '') {
          // If parent is root, reload the tree
          await loadTreeData();
        } else {
          // Find the parent node and reload its children
          const parentNode = treeApi.current?.get(parentPath);
          if (parentNode) {
            await loadChildren(parentNode);
          }
        }
      }
    }
  }, [project, loadTreeData, loadChildren, rootPath, expandedDirectories]);

  if (isLoading) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed" mb="xs">Loading file tree...</Text>
        <Loader size="sm" />
      </Box>
    );
  }

  const fallbackWidth = treeContainerRef.current?.clientWidth || treeContainerRef.current?.offsetWidth || 0;
  const fallbackHeight = treeContainerRef.current?.clientHeight || treeContainerRef.current?.offsetHeight || 0;
  const treeWidth = Math.max(containerWidth, fallbackWidth, 1);
  const treeHeight = Math.max(containerHeight, fallbackHeight, 1);

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 195px)', minHeight: 0 }}>
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
              onClick={() => {
                // Create folder in root directory - use a virtual root node
                const virtualRootNode = {
                  data: {
                    path: rootPath,
                    name: 'root'
                  }
                } as NodeApi<NodeData>;
                
                setCreateParentNode(virtualRootNode);
                setInputValue('');
                setShowCreateFolderModal(true);
              }}
              title="Create new folder"
            >
              <IconFolderPlus size={16} />
            </ActionIcon>

            <ActionIcon 
              variant="subtle"
              onClick={() => {
                // Create file in root directory - use a virtual root node
                const virtualRootNode = {
                  data: {
                    path: rootPath,
                    name: 'root'
                  }
                } as NodeApi<NodeData>;
                
                setCreateParentNode(virtualRootNode);
                setInputValue('');
                setShowCreateFileModal(true);
              }}
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
        ref={treeContainerMergedRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          position: 'relative',
          height: '100%',
        }}
      >
        <Tree
            ref={treeApi}
            data={treeData}
            openByDefault={false}
            width={treeWidth}
            height={treeHeight}
            indent={24}
            rowHeight={32}
            disableEdit={true}
            disableDrop={false}
            onActivate={async (node) => {
                if (node.isLeaf) {
                    onFileSelect && onFileSelect(node.data.path);
                } else {
                    // For directories, toggle and load children if needed
                    if (!node.isOpen) {
                        // Load children before opening if they haven't been loaded yet
                        if (node.data.children && node.data.children.length === 0) {
                            await loadChildren(node);
                        }
                        // Add to expanded directories
                        setExpandedDirectories(prev => new Set(prev).add(node.data.path));
                    } else {
                        // Remove from expanded directories
                        setExpandedDirectories(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(node.data.path);
                            return newSet;
                        });
                    }
                    node.toggle();
                    node.select();
                }
            }}
            onToggle={async (id: string) => {
                const node = treeApi.current?.get(id);
                if (node && node.isInternal) {
                  // Update expanded directories state
                  setExpandedDirectories(prev => {
                    const newSet = new Set(prev);
                    if (node.isOpen) {
                      newSet.add(node.data.path);
                      // Load children when a directory is opened for the first time
                      if (node.data.children && node.data.children.length === 0) {
                        loadChildren(node);
                      }
                    } else {
                      newSet.delete(node.data.path);
                    }
                    return newSet;
                  });
                }
            }}
            onMove={async ({ dragIds, parentId }) => {
                if (!project) return;
                const parentNode = treeApi.current?.get(parentId);
                if (!parentNode) return;

                const updatedExpandedDirs = new Set(expandedDirectories);
                const parentsToRefresh = new Set<string>();

                for (const id of dragIds) {
                    const node = treeApi.current?.get(id);
                    if (!node) continue;

                    const sourcePath = node.data.path;
                    const sourceParentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
                    const destinationPath = `${parentNode.data.path}/${node.data.name}`;
                    
                    // Update expanded directories if the moved item was expanded
                    if (updatedExpandedDirs.has(sourcePath)) {
                        updatedExpandedDirs.delete(sourcePath);
                        updatedExpandedDirs.add(destinationPath);
                    }
                    
                    const result = await window.electronAPI.fileTreeMove(project, sourcePath, destinationPath);

                    if ('error' in result) {
                        console.error('Move failed:', result.error);
                        alert(`Move failed: ${result.error}`);
                        // On failure, just reload everything
                        await loadTreeData();
                        return;
                    }
                    
                    // Track which parent directories need refreshing
                    parentsToRefresh.add(sourceParentPath);
                    parentsToRefresh.add(parentNode.data.path);
                }
                
                // Update expanded directories
                if (updatedExpandedDirs.size !== expandedDirectories.size) {
                    setExpandedDirectories(updatedExpandedDirs);
                }
                
                // Refresh all affected parent directories
                for (const parentPath of parentsToRefresh) {
                    if (parentPath === rootPath || parentPath === '') {
                        await loadTreeData();
                    } else {
                        const parent = treeApi.current?.get(parentPath);
                        if (parent) {
                            await loadChildren(parent);
                        }
                    }
                }
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
                    </Group>
                </div>
            )}
        </Tree>
      </Box>
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
                        setInputValue('');
                        setShowCreateFolderModal(true);
                    }}>
                    New Folder
                    </Menu.Item>
                    <Menu.Item leftSection={<IconPlus size={14} />} onClick={() => {
                        setCreateParentNode(contextMenuNode.isLeaf ? contextMenuNode.parent : contextMenuNode);
                        setInputValue('');
                        setShowCreateFileModal(true);
                    }}>
                    New File
                    </Menu.Item>
                </Menu.Dropdown>
            )}
        </Menu>
        <Modal opened={showCreateFolderModal} onClose={() => setShowCreateFolderModal(false)} title="Create New Folder">
            <TextInput 
              label="Folder Name" 
              value={inputValue} 
              onChange={(e) => setInputValue(e.currentTarget.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  handleCreateFolder();
                }
              }}
              data-autofocus 
            />
            <Button mt="md" onClick={handleCreateFolder}>Create</Button>
        </Modal>
        <Modal opened={showCreateFileModal} onClose={() => setShowCreateFileModal(false)} title="Create New File">
            <TextInput 
              label="File Name" 
              value={inputValue} 
              onChange={(e) => setInputValue(e.currentTarget.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  handleCreateFile();
                }
              }}
              data-autofocus 
            />
            <Button mt="md" onClick={handleCreateFile}>Create</Button>
        </Modal>
        <Modal opened={showRenameModal} onClose={() => setShowRenameModal(false)} title="Rename Item">
            <TextInput 
              label="New Name" 
              value={inputValue} 
              onChange={(e) => setInputValue(e.currentTarget.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  handleRename();
                }
              }}
              data-autofocus 
            />
            <Button mt="md" onClick={handleRename}>Rename</Button>
        </Modal>
    </Box>
  );
}); 