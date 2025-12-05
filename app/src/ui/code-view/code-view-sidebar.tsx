import * as React from 'react'
import * as Path from 'path'
import * as fs from 'fs'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

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
}

interface ICodeViewSidebarState {
  readonly tree: IFileTreeNode | null
  readonly expandedPaths: Set<string>
  readonly isLoading: boolean
}

export class CodeViewSidebar extends React.Component<
  ICodeViewSidebarProps,
  ICodeViewSidebarState
> {
  public constructor(props: ICodeViewSidebarProps) {
    super(props)
    this.state = {
      tree: null,
      expandedPaths: new Set([props.repositoryPath]),
      isLoading: true,
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

  private renderNode(node: IFileTreeNode, depth: number = 0): JSX.Element {
    const isExpanded = this.state.expandedPaths.has(node.path)
    const isSelected = this.props.selectedFile === node.path
    const paddingLeft = depth * 16 + 8

    return (
      <div key={node.path} className="file-tree-node">
        <div
          className={`file-tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft }}
          onClick={() => this.onNodeClick(node)}
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

  public render() {
    const { tree, isLoading } = this.state

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
      <div className="code-view-sidebar">
        <div className="file-tree">
          {tree.children?.map(child => this.renderNode(child, 0))}
        </div>
      </div>
    )
  }
}
