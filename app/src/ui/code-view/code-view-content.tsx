import * as React from 'react'
import * as Path from 'path'
import * as FSE from 'fs-extra'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { SandboxedMarkdown } from '../lib/sandboxed-markdown'
import { Emoji } from '../../lib/emoji'
import { shell } from 'electron'

interface IOpenTab {
  readonly filePath: string
  readonly hasUnsavedChanges: boolean
}

interface ICodeViewContentProps {
  readonly openTabs: ReadonlyArray<IOpenTab>
  readonly activeTab: string | null
  readonly repositoryPath: string
  readonly emoji: Map<string, Emoji>
  readonly onTabSelect: (filePath: string) => void
  readonly onTabClose: (filePath: string) => void
  readonly onTabUnsavedChange: (filePath: string, hasUnsavedChanges: boolean) => void
}

interface ICodeViewContentState {
  readonly content: string | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly isBinary: boolean
  readonly isEditing: boolean
  readonly editedContent: string
  readonly isSaving: boolean
}

export class CodeViewContent extends React.Component<
  ICodeViewContentProps,
  ICodeViewContentState
> {
  private textareaRef = React.createRef<HTMLTextAreaElement>()
  private contentCache = new Map<string, { content: string | null; isBinary: boolean; error: string | null }>()
  private _isMounted = false
  private _currentLoadingPath: string | null = null

  public constructor(props: ICodeViewContentProps) {
    super(props)
    this.state = {
      content: null,
      isLoading: false,
      error: null,
      isBinary: false,
      isEditing: false,
      editedContent: '',
      isSaving: false,
    }
  }

  public componentDidMount() {
    this._isMounted = true
    if (this.props.activeTab) {
      this.loadFileContent(this.props.activeTab)
    }
  }

  public componentWillUnmount() {
    this._isMounted = false
    this._currentLoadingPath = null
  }

  public componentDidUpdate(prevProps: ICodeViewContentProps) {
    if (prevProps.activeTab !== this.props.activeTab) {
      // Cancel any pending load for the old tab
      this._currentLoadingPath = null

      // Load the new tab's content if there is one
      if (this.props.activeTab) {
        this.loadFileContent(this.props.activeTab)
      } else {
        // No active tab, reset to empty state
        this.setState({
          content: null,
          isLoading: false,
          error: null,
          isBinary: false,
          isEditing: false,
          editedContent: '',
        })
      }
    }
  }

  private isBinaryFile(filePath: string): boolean {
    const ext = Path.extname(filePath).toLowerCase()
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
      '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
      '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.wav', '.avi', '.mov',
      '.ttf', '.otf', '.woff', '.woff2', '.eot',
      '.node', '.crx',
    ]
    return binaryExtensions.includes(ext)
  }

  private isImageFile(filePath: string): boolean {
    const ext = Path.extname(filePath).toLowerCase()
    return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico'].includes(ext)
  }

  private isMarkdownFile(filePath: string): boolean {
    const ext = Path.extname(filePath).toLowerCase()
    return ['.md', '.markdown', '.mdx'].includes(ext)
  }

  private async loadFileContent(filePath: string) {
    // Track which file we're loading to handle race conditions
    this._currentLoadingPath = filePath

    this.setState({
      isLoading: true,
      error: null,
      content: null,
      isBinary: false,
      isEditing: false,
      editedContent: '',
    })

    try {
      const stat = await FSE.stat(filePath)

      // Check if we're still supposed to be loading this file
      if (!this._isMounted || this._currentLoadingPath !== filePath) {
        return
      }

      // Don't try to load very large files
      if (stat.size > 1024 * 1024) { // 1MB limit
        const cacheEntry = { content: null, isBinary: true, error: 'File is too large to display (> 1MB)' }
        this.contentCache.set(filePath, cacheEntry)
        this.setState({
          isLoading: false,
          error: cacheEntry.error,
          isBinary: true,
        })
        return
      }

      if (this.isBinaryFile(filePath) && !this.isImageFile(filePath)) {
        const cacheEntry = { content: null, isBinary: true, error: null }
        this.contentCache.set(filePath, cacheEntry)
        this.setState({
          isLoading: false,
          error: null,
          isBinary: true,
        })
        return
      }

      if (this.isImageFile(filePath)) {
        // For images, we'll display them directly
        const cacheEntry = { content: filePath, isBinary: true, error: null }
        this.contentCache.set(filePath, cacheEntry)
        this.setState({
          isLoading: false,
          content: filePath,
          isBinary: true,
        })
        return
      }

      const content = await FSE.readFile(filePath, 'utf8')

      // Check again after async operation
      if (!this._isMounted || this._currentLoadingPath !== filePath) {
        return
      }

      const cacheEntry = { content, isBinary: false, error: null }
      this.contentCache.set(filePath, cacheEntry)
      this.setState({ content, isLoading: false, editedContent: content })
    } catch (error) {
      // Check if we're still supposed to be loading this file
      if (!this._isMounted || this._currentLoadingPath !== filePath) {
        return
      }

      const cacheEntry = { content: null, isBinary: false, error: `Failed to load file: ${error}` }
      this.contentCache.set(filePath, cacheEntry)
      this.setState({
        isLoading: false,
        error: cacheEntry.error,
      })
    }
  }

  private onEditClick = () => {
    this.setState({
      isEditing: true,
      editedContent: this.state.content || ''
    }, () => {
      // Focus the textarea after entering edit mode
      this.textareaRef.current?.focus()
    })
  }

  private onCancelEdit = () => {
    const { activeTab } = this.props
    this.setState({
      isEditing: false,
      editedContent: this.state.content || '',
    })
    if (activeTab) {
      this.props.onTabUnsavedChange(activeTab, false)
    }
  }

  private onSaveClick = async () => {
    const { activeTab } = this.props
    const { editedContent } = this.state

    if (!activeTab) return

    this.setState({ isSaving: true })

    try {
      await FSE.writeFile(activeTab, editedContent, 'utf8')
      // Update cache
      this.contentCache.set(activeTab, { content: editedContent, isBinary: false, error: null })
      this.setState({
        content: editedContent,
        isEditing: false,
        isSaving: false,
      })
      this.props.onTabUnsavedChange(activeTab, false)
    } catch (error) {
      this.setState({
        error: `Failed to save file: ${error}`,
        isSaving: false,
      })
    }
  }

  private onContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const editedContent = event.target.value
    const hasUnsavedChanges = editedContent !== this.state.content
    this.setState({ editedContent })
    if (this.props.activeTab) {
      this.props.onTabUnsavedChange(this.props.activeTab, hasUnsavedChanges)
    }
  }

  private onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Save with Cmd/Ctrl + S
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault()
      this.onSaveClick()
    }
    // Cancel with Escape
    if (event.key === 'Escape') {
      this.onCancelEdit()
    }
    // Handle Tab key for indentation
    if (event.key === 'Tab') {
      event.preventDefault()
      const textarea = event.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const value = textarea.value

      // Insert tab at cursor position
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      this.setState({ editedContent: newValue }, () => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      })
      if (this.props.activeTab) {
        this.props.onTabUnsavedChange(this.props.activeTab, true)
      }
    }
  }

  private onTabClick = (filePath: string) => {
    this.props.onTabSelect(filePath)
  }

  private onTabCloseClick = (event: React.MouseEvent, filePath: string) => {
    event.stopPropagation()
    this.contentCache.delete(filePath)
    this.props.onTabClose(filePath)
  }

  private getFileIcon(filePath: string): typeof octicons.file {
    const ext = Path.extname(filePath).toLowerCase()
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

  private renderTabBar() {
    const { openTabs, activeTab, repositoryPath } = this.props

    if (openTabs.length === 0) {
      return null
    }

    return (
      <div className="file-tabs">
        {openTabs.map(tab => {
          const fileName = Path.basename(tab.filePath)
          const isActive = tab.filePath === activeTab
          const icon = this.getFileIcon(tab.filePath)

          return (
            <div
              key={tab.filePath}
              className={`file-tab ${isActive ? 'active' : ''}`}
              onClick={() => this.onTabClick(tab.filePath)}
              title={Path.relative(repositoryPath, tab.filePath)}
            >
              <Octicon symbol={icon} className="tab-icon" />
              <span className="tab-name">
                {fileName}
                {tab.hasUnsavedChanges && <span className="unsaved-dot">●</span>}
              </span>
              <button
                className="tab-close"
                onClick={(e) => this.onTabCloseClick(e, tab.filePath)}
                title="Close"
              >
                <Octicon symbol={octicons.x} />
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  private renderEmptyState() {
    return (
      <div className="code-view-content empty">
        <div className="empty-message">
          <Octicon symbol={octicons.file} className="empty-icon" />
          <p>Select a file from the sidebar to view its contents</p>
        </div>
      </div>
    )
  }

  private renderLoading() {
    return (
      <div className="code-view-content loading">
        <div className="loading-message">Loading file...</div>
      </div>
    )
  }

  private renderError() {
    return (
      <div className="code-view-content error">
        <div className="error-message">
          <Octicon symbol={octicons.alert} className="error-icon" />
          <p>{this.state.error}</p>
        </div>
      </div>
    )
  }

  private renderBinaryFile() {
    const { activeTab } = this.props
    const { content } = this.state

    if (activeTab && this.isImageFile(activeTab) && content) {
      return (
        <div className="code-view-content image-preview">
          <img src={`file://${content}`} alt={Path.basename(activeTab)} />
        </div>
      )
    }

    return (
      <div className="code-view-content binary">
        <div className="binary-message">
          <Octicon symbol={octicons.file} className="binary-icon" />
          <p>Binary file - cannot display contents</p>
        </div>
      </div>
    )
  }

  private onMarkdownLinkClicked = (url: string) => {
    shell.openExternal(url)
  }

  private renderMarkdownContent() {
    const { activeTab, emoji, repositoryPath } = this.props
    const { content, isEditing } = this.state

    if (!content || !activeTab) {
      return this.renderEmptyState()
    }

    const relativePath = Path.relative(repositoryPath, activeTab)
    const baseHref = `file://${Path.dirname(activeTab)}/`

    if (isEditing) {
      return this.renderEditor(relativePath, octicons.markdown)
    }

    return (
      <div className="code-view-content markdown-view">
        <div className="file-header">
          <Octicon symbol={octicons.markdown} />
          <span className="file-path">{relativePath}</span>
          <div className="file-actions">
            <button
              className="edit-button"
              onClick={this.onEditClick}
              title="Edit file"
            >
              <Octicon symbol={octicons.pencil} />
              Edit
            </button>
          </div>
        </div>
        <div className="markdown-container">
          <SandboxedMarkdown
            markdown={content}
            emoji={emoji}
            baseHref={baseHref}
            onMarkdownLinkClicked={this.onMarkdownLinkClicked}
            underlineLinks={true}
            ariaLabel={`Markdown content of ${Path.basename(activeTab)}`}
          />
        </div>
      </div>
    )
  }

  private renderEditor(relativePath: string, icon: typeof octicons.file) {
    const { activeTab, openTabs } = this.props
    const { editedContent, isSaving } = this.state
    const lines = editedContent.split('\n')
    const currentTab = openTabs.find(t => t.filePath === activeTab)
    const hasUnsavedChanges = currentTab?.hasUnsavedChanges ?? false

    return (
      <div className="code-view-content editing">
        <div className="file-header">
          <Octicon symbol={icon} />
          <span className="file-path">
            {relativePath}
            {hasUnsavedChanges && <span className="unsaved-indicator">*</span>}
          </span>
          <div className="file-actions">
            <button
              className="cancel-button"
              onClick={this.onCancelEdit}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="save-button"
              onClick={this.onSaveClick}
              disabled={isSaving || !hasUnsavedChanges}
              title="Save (Cmd+S)"
            >
              <Octicon symbol={octicons.check} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <div className="editor-container">
          <div className="line-numbers">
            {lines.map((_, i) => (
              <div key={i} className="line-number">
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            ref={this.textareaRef}
            className="code-editor"
            value={editedContent}
            onChange={this.onContentChange}
            onKeyDown={this.onKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>
      </div>
    )
  }

  private renderFileContent() {
    const { activeTab, repositoryPath } = this.props
    const { content, isEditing } = this.state

    if (!content || !activeTab) {
      return this.renderEmptyState()
    }

    // Check if it's a markdown file
    if (this.isMarkdownFile(activeTab)) {
      return this.renderMarkdownContent()
    }

    const relativePath = Path.relative(repositoryPath, activeTab)

    if (isEditing) {
      return this.renderEditor(relativePath, octicons.file)
    }

    const lines = content.split('\n')

    return (
      <div className="code-view-content">
        <div className="file-header">
          <Octicon symbol={octicons.file} />
          <span className="file-path">{relativePath}</span>
          <span className="line-count">{lines.length} lines</span>
          <div className="file-actions">
            <button
              className="edit-button"
              onClick={this.onEditClick}
              title="Edit file"
            >
              <Octicon symbol={octicons.pencil} />
              Edit
            </button>
          </div>
        </div>
        <div className="code-container">
          <div className="line-numbers">
            {lines.map((_, i) => (
              <div key={i} className="line-number">
                {i + 1}
              </div>
            ))}
          </div>
          <pre className="code-content">
            <code>
              {lines.map((line, i) => (
                <div key={i} className="code-line">
                  {line || ' '}
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    )
  }

  private renderContentArea() {
    const { activeTab, openTabs } = this.props
    const { isLoading, error, isBinary } = this.state

    if (openTabs.length === 0 || !activeTab) {
      return this.renderEmptyState()
    }

    if (isLoading) {
      return this.renderLoading()
    }

    if (error) {
      return this.renderError()
    }

    if (isBinary) {
      return this.renderBinaryFile()
    }

    return this.renderFileContent()
  }

  public render() {
    return (
      <div className="code-view-content-wrapper">
        {this.renderTabBar()}
        {this.renderContentArea()}
      </div>
    )
  }
}

export type { IOpenTab }
