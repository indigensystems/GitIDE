import * as React from 'react'
import * as Path from 'path'
import * as fs from 'fs'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { showContextualMenu } from '../../lib/menu-item'
import { IMenuItem } from '../../lib/menu-item'

interface IFileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: IFileTreeNode[]
  isExpanded?: boolean
}

interface ICodeViewSidebarProps {
  readonly repositoryPath: string
  readonly selectedFile: string | null
  readonly onFileSelected: (filePath: string) => void
  readonly onFileCreated?: (filePath: string) => void
  readonly onDeleteItem?: (itemPath: string, isDirectory: boolean) => void
  readonly onRenameItem?: (itemPath: string) => void
}

interface ICodeViewSidebarState {
  readonly tree: IFileTreeNode | null
  readonly expandedPaths: Set<string>
  readonly isLoading: boolean
  /** 'file' or 'folder' when creating, null otherwise */
  readonly creatingType: 'file' | 'folder' | null
  /** The input value for the new item name */
  readonly newItemName: string
  /** Path of item being dragged */
  readonly draggingPath: string | null
  /** Path of folder being hovered over during drag */
  readonly dropTargetPath: string | null
}

export class CodeViewSidebar extends React.Component<
  ICodeViewSidebarProps,
  ICodeViewSidebarState
> {
  private newItemInputRef = React.createRef<HTMLInputElement>()

  public constructor(props: ICodeViewSidebarProps) {
    super(props)
    this.state = {
      tree: null,
      expandedPaths: new Set([props.repositoryPath]),
      isLoading: true,
      creatingType: null,
      newItemName: '',
      draggingPath: null,
      dropTargetPath: null,
    }
  }

  public componentDidMount() {
    this.loadFileTree()
  }

  public componentDidUpdate(prevProps: ICodeViewSidebarProps) {
    if (prevProps.repositoryPath !== this.props.repositoryPath) {
      this.loadFileTree()
    }
  }

  /** Refresh the file tree (call after creating/deleting files) */
  public refreshFileTree() {
    this.loadFileTree()
  }

  private async loadFileTree() {
    this.setState({ isLoading: true })
    try {
      const tree = await this.buildFileTree(this.props.repositoryPath)
      this.setState({ tree, isLoading: false })
    } catch (error) {
      console.error('Failed to load file tree:', error)
      this.setState({ isLoading: false })
    }
  }

  private async buildFileTree(dirPath: string): Promise<IFileTreeNode> {
    const name = Path.basename(dirPath) || dirPath
    const node: IFileTreeNode = {
      name,
      path: dirPath,
      isDirectory: true,
      children: [],
    }

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const children: IFileTreeNode[] = []

      for (const entry of entries) {
        // Skip hidden files and .git directory
        if (entry.name.startsWith('.')) {
          continue
        }
        // Skip node_modules for performance
        if (entry.name === 'node_modules') {
          continue
        }

        const childPath = Path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          children.push({
            name: entry.name,
            path: childPath,
            isDirectory: true,
            children: undefined, // Lazy load
          })
        } else {
          children.push({
            name: entry.name,
            path: childPath,
            isDirectory: false,
          })
        }
      }

      // Sort: directories first, then alphabetically
      children.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })

      node.children = children
    } catch (error) {
      console.error(`Failed to read directory ${dirPath}:`, error)
    }

    return node
  }

  private async expandDirectory(node: IFileTreeNode): Promise<IFileTreeNode[]> {
    if (!node.isDirectory) return []

    try {
      const entries = await fs.promises.readdir(node.path, { withFileTypes: true })
      const children: IFileTreeNode[] = []

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        if (entry.name === 'node_modules') continue

        const childPath = Path.join(node.path, entry.name)
        children.push({
          name: entry.name,
          path: childPath,
          isDirectory: entry.isDirectory(),
          children: entry.isDirectory() ? undefined : undefined,
        })
      }

      children.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })

      return children
    } catch (error) {
      console.error(`Failed to expand directory ${node.path}:`, error)
      return []
    }
  }

  private onNodeClick = async (node: IFileTreeNode) => {
    if (node.isDirectory) {
      const { expandedPaths } = this.state
      const newExpanded = new Set(expandedPaths)

      if (newExpanded.has(node.path)) {
        newExpanded.delete(node.path)
      } else {
        newExpanded.add(node.path)
        // Lazy load children if needed
        if (node.children === undefined) {
          const children = await this.expandDirectory(node)
          this.updateNodeChildren(node.path, children)
        }
      }

      this.setState({ expandedPaths: newExpanded })
    } else {
      this.props.onFileSelected(node.path)
    }
  }

  private updateNodeChildren(path: string, children: IFileTreeNode[]) {
    const { tree } = this.state
    if (!tree) return

    const updateNode = (node: IFileTreeNode): IFileTreeNode => {
      if (node.path === path) {
        return { ...node, children }
      }
      if (node.children) {
        return { ...node, children: node.children.map(updateNode) }
      }
      return node
    }

    this.setState({ tree: updateNode(tree) })
  }

  private getFileIcon(node: IFileTreeNode): typeof octicons.file {
    if (node.isDirectory) {
      return this.state.expandedPaths.has(node.path)
        ? octicons.fileDirectoryOpenFill
        : octicons.fileDirectoryFill
    }

    const ext = Path.extname(node.name).toLowerCase()
    switch (ext) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
        return octicons.fileCode
      case '.json':
      case '.yml':
      case '.yaml':
        return octicons.fileCode
      case '.md':
      case '.mdx':
        return octicons.markdown
      case '.css':
      case '.scss':
      case '.less':
        return octicons.paintbrush
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.gif':
      case '.svg':
        return octicons.image
      default:
        return octicons.file
    }
  }

  // Drag and drop handlers
  private onDragStart = (node: IFileTreeNode, e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
    this.setState({ draggingPath: node.path })
  }

  private onDragEnd = () => {
    this.setState({ draggingPath: null, dropTargetPath: null })
  }

  private onDragOver = (node: IFileTreeNode, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Only allow dropping on directories
    if (!node.isDirectory) {
      e.dataTransfer.dropEffect = 'none'
      return
    }

    // Don't allow dropping on itself or its children
    const { draggingPath } = this.state
    if (draggingPath && (node.path === draggingPath || node.path.startsWith(draggingPath + Path.sep))) {
      e.dataTransfer.dropEffect = 'none'
      return
    }

    e.dataTransfer.dropEffect = 'move'
    if (this.state.dropTargetPath !== node.path) {
      this.setState({ dropTargetPath: node.path })
    }
  }

  private onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    // Only clear if we're leaving the drop target (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      this.setState({ dropTargetPath: null })
    }
  }

  private onDrop = async (targetNode: IFileTreeNode, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const sourcePath = e.dataTransfer.getData('text/plain')
    if (!sourcePath || !targetNode.isDirectory) {
      this.setState({ draggingPath: null, dropTargetPath: null })
      return
    }

    // Don't drop on itself or parent
    if (sourcePath === targetNode.path || Path.dirname(sourcePath) === targetNode.path) {
      this.setState({ draggingPath: null, dropTargetPath: null })
      return
    }

    const fileName = Path.basename(sourcePath)
    const destPath = Path.join(targetNode.path, fileName)

    try {
      await fs.promises.rename(sourcePath, destPath)
      this.refreshFileTree()
    } catch (err) {
      console.error('Failed to move file:', err)
    }

    this.setState({ draggingPath: null, dropTargetPath: null })
  }

  // Delete handler
  private onDeleteNode = async (node: IFileTreeNode) => {
    const confirmMessage = node.isDirectory
      ? `Are you sure you want to delete the folder "${node.name}" and all its contents?`
      : `Are you sure you want to delete "${node.name}"?`

    // Use confirm dialog - in Electron this works
    const confirmed = window.confirm(confirmMessage)
    if (!confirmed) return

    try {
      if (node.isDirectory) {
        await fs.promises.rm(node.path, { recursive: true, force: true })
      } else {
        await fs.promises.unlink(node.path)
      }
      this.refreshFileTree()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  private onNodeContextMenu = (
    node: IFileTreeNode,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const items: IMenuItem[] = []

    // For directories, show "New File" and "New Folder" options
    items.push({
      label: 'New File…',
      action: () => this.onNewFileButtonClick(),
    })
    items.push({
      label: 'New Folder…',
      action: () => this.onNewFolderButtonClick(),
    })

    // Add separator
    items.push({ type: 'separator' })

    // Delete option
    items.push({
      label: node.isDirectory ? 'Delete Folder' : 'Delete',
      action: () => this.onDeleteNode(node),
    })

    showContextualMenu(items)
  }

  private onSidebarContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const items: IMenuItem[] = [
      {
        label: 'New File…',
        action: () => this.onNewFileButtonClick(),
      },
      {
        label: 'New Folder…',
        action: () => this.onNewFolderButtonClick(),
      },
    ]

    showContextualMenu(items)
  }

  private renderNode(node: IFileTreeNode, depth: number = 0): JSX.Element {
    const isExpanded = this.state.expandedPaths.has(node.path)
    const isSelected = this.props.selectedFile === node.path
    const isDragging = this.state.draggingPath === node.path
    const isDropTarget = this.state.dropTargetPath === node.path
    const paddingLeft = depth * 16 + 8

    const className = [
      'file-tree-item',
      isSelected ? 'selected' : '',
      isDragging ? 'dragging' : '',
      isDropTarget ? 'drop-target' : '',
    ].filter(Boolean).join(' ')

    return (
      <div key={node.path} className="file-tree-node">
        <div
          className={className}
          style={{ paddingLeft }}
          onClick={() => this.onNodeClick(node)}
          onContextMenu={e => this.onNodeContextMenu(node, e)}
          draggable
          onDragStart={e => this.onDragStart(node, e)}
          onDragEnd={this.onDragEnd}
          onDragOver={e => this.onDragOver(node, e)}
          onDragLeave={this.onDragLeave}
          onDrop={e => this.onDrop(node, e)}
        >
          {node.isDirectory && (
            <span className="expand-icon">
              <Octicon
                symbol={isExpanded ? octicons.chevronDown : octicons.chevronRight}
              />
            </span>
          )}
          <Octicon symbol={this.getFileIcon(node)} className="file-icon" />
          <span className="file-name">{node.name}</span>
        </div>
        {node.isDirectory && isExpanded && node.children && (
          <div className="file-tree-children">
            {node.children.map(child => this.renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  private onNewFileButtonClick = () => {
    this.setState({ creatingType: 'file', newItemName: '' }, () => {
      this.newItemInputRef.current?.focus()
    })
  }

  private onNewFolderButtonClick = () => {
    this.setState({ creatingType: 'folder', newItemName: '' }, () => {
      this.newItemInputRef.current?.focus()
    })
  }

  private onNewItemNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ newItemName: e.target.value })
  }

  private onNewItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      this.confirmCreate()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this.cancelCreate()
    }
  }

  private onNewItemBlur = () => {
    // Small delay to allow click on confirm button to register
    setTimeout(() => {
      if (this.state.creatingType !== null && !this.state.newItemName.trim()) {
        this.cancelCreate()
      }
    }, 150)
  }

  private cancelCreate = () => {
    this.setState({ creatingType: null, newItemName: '' })
  }

  private confirmCreate = async () => {
    const { creatingType, newItemName } = this.state
    if (!creatingType || !newItemName.trim()) {
      this.cancelCreate()
      return
    }

    const itemPath = Path.join(this.props.repositoryPath, newItemName.trim())

    try {
      if (creatingType === 'file') {
        await fs.promises.writeFile(itemPath, '')
        this.refreshFileTree()
        this.props.onFileCreated?.(itemPath)
      } else {
        await fs.promises.mkdir(itemPath, { recursive: true })
        this.refreshFileTree()
      }
    } catch (e) {
      console.error(`Failed to create ${creatingType}:`, e)
    }

    this.setState({ creatingType: null, newItemName: '' })
  }

  private renderNewItemInput(): JSX.Element | null {
    const { creatingType, newItemName } = this.state
    if (!creatingType) return null

    const icon = creatingType === 'file' ? octicons.file : octicons.fileDirectoryFill
    const placeholder = creatingType === 'file' ? 'filename.ts' : 'folder-name'

    return (
      <div className="new-item-input-row">
        <Octicon symbol={icon} className="file-icon" />
        <input
          ref={this.newItemInputRef}
          type="text"
          className="new-item-input"
          value={newItemName}
          onChange={this.onNewItemNameChange}
          onKeyDown={this.onNewItemKeyDown}
          onBlur={this.onNewItemBlur}
          placeholder={placeholder}
          autoFocus
        />
        <button
          className="new-item-confirm"
          onClick={this.confirmCreate}
          title="Create"
        >
          <Octicon symbol={octicons.check} />
        </button>
        <button
          className="new-item-cancel"
          onClick={this.cancelCreate}
          title="Cancel"
        >
          <Octicon symbol={octicons.x} />
        </button>
      </div>
    )
  }

  public render() {
    const { tree, isLoading, creatingType } = this.state

    if (isLoading) {
      return (
        <div className="code-view-sidebar">
          <div className="loading">Loading files...</div>
        </div>
      )
    }

    if (!tree) {
      return (
        <div className="code-view-sidebar">
          <div className="no-files">Unable to load files</div>
        </div>
      )
    }

    return (
      <div className="code-view-sidebar" onContextMenu={this.onSidebarContextMenu}>
        <div className="file-tree">
          {this.renderNewItemInput()}
          {tree.children?.map(child => this.renderNode(child, 0))}
        </div>
        {!creatingType && (
          <div className="file-tree-actions">
            <button
              className="file-tree-action-button"
              onClick={this.onNewFileButtonClick}
              title="New File"
            >
              <Octicon symbol={octicons.plus} />
              <span>New File</span>
            </button>
            <button
              className="file-tree-action-button"
              onClick={this.onNewFolderButtonClick}
              title="New Folder"
            >
              <Octicon symbol={octicons.fileDirectoryFill} />
              <span>New Folder</span>
            </button>
          </div>
        )}
      </div>
    )
  }
}
