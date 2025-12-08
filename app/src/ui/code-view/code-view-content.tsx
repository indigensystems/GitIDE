import * as React from 'react'
import * as Path from 'path'
import * as FSE from 'fs-extra'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { SandboxedMarkdown } from '../lib/sandboxed-markdown'
import { Emoji } from '../../lib/emoji'
import { shell } from 'electron'
import { Terminal } from './terminal'
import { CodeMirrorEditor } from './codemirror-editor'
import { MilkdownEditor } from './milkdown-editor'

// Prefix for terminal tab identifiers
const TERMINAL_TAB_PREFIX = 'terminal://'

interface IOpenTab {
  readonly filePath: string
  readonly hasUnsavedChanges: boolean
}

/** Check if a tab path represents a terminal */
function isTerminalTab(filePath: string): boolean {
  return filePath.startsWith(TERMINAL_TAB_PREFIX)
}

/** Extract terminal ID from a terminal tab path */
function getTerminalId(filePath: string): string {
  return filePath.slice(TERMINAL_TAB_PREFIX.length)
}

interface ICodeViewContentProps {
  readonly openTabs: ReadonlyArray<IOpenTab>
  readonly activeTab: string | null
  readonly repositoryPath: string
  readonly repositoryName: string
  readonly emoji: Map<string, Emoji>
  readonly onTabSelect: (filePath: string) => void
  readonly onTabClose: (filePath: string) => void
  readonly onTabUnsavedChange: (filePath: string, hasUnsavedChanges: boolean) => void
  readonly onTerminalExit?: (terminalTabPath: string) => void
  /** Callback when a wiki link is clicked. Returns true if navigation was handled. */
  readonly onWikiLinkClick?: (repoName: string | null, filePath: string) => void
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
  private viewLineNumbersRef = React.createRef<HTMLDivElement>()
  private codeContentRef = React.createRef<HTMLPreElement>()
  private contentCache = new Map<string, { content: string | null; isBinary: boolean; error: string | null }>()
  private _isMounted = false
  private _currentLoadingPath: string | null = null
  private autoSaveTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly AUTO_SAVE_DELAY = 1500 // Auto-save after 1.5 seconds of no typing

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
    // Clear any pending auto-save
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout)
      this.autoSaveTimeout = null
    }
  }

  public componentDidUpdate(prevProps: ICodeViewContentProps) {
    if (prevProps.activeTab !== this.props.activeTab) {
      // Cancel any pending auto-save for the old tab
      if (this.autoSaveTimeout) {
        clearTimeout(this.autoSaveTimeout)
        this.autoSaveTimeout = null
      }

      // Auto-save if we were editing and have unsaved changes
      if (this.state.isEditing && prevProps.activeTab) {
        const prevTab = prevProps.openTabs.find(t => t.filePath === prevProps.activeTab)
        if (prevTab?.hasUnsavedChanges) {
          this.saveFileSync(prevProps.activeTab)
        }
      }

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
    })
    // CodeMirror editor auto-focuses when mounted
  }

  private onCancelEdit = () => {
    const { activeTab } = this.props
    // Clear any pending auto-save
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout)
      this.autoSaveTimeout = null
    }
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

    // Clear any pending auto-save since we're saving now
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout)
      this.autoSaveTimeout = null
    }

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

  /** Save the file synchronously (used when switching tabs) */
  private saveFileSync = (filePath: string) => {
    const { editedContent } = this.state
    try {
      FSE.writeFileSync(filePath, editedContent, 'utf8')
      // Update cache
      this.contentCache.set(filePath, { content: editedContent, isBinary: false, error: null })
      this.props.onTabUnsavedChange(filePath, false)
    } catch (error) {
      console.error('Failed to auto-save file:', error)
    }
  }

  /** Schedule an auto-save after a delay (debounced) */
  private scheduleAutoSave = () => {
    // Clear any existing timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout)
    }

    // Schedule a new auto-save
    this.autoSaveTimeout = setTimeout(() => {
      this.performAutoSave()
    }, this.AUTO_SAVE_DELAY)
  }

  /** Perform the auto-save */
  private performAutoSave = async () => {
    const { activeTab } = this.props
    const { editedContent, content, isEditing } = this.state

    // Only auto-save if we're editing and have changes
    if (!activeTab || !isEditing || editedContent === content) {
      return
    }

    try {
      await FSE.writeFile(activeTab, editedContent, 'utf8')
      // Update cache and content state (but stay in edit mode)
      this.contentCache.set(activeTab, { content: editedContent, isBinary: false, error: null })
      if (this._isMounted) {
        this.setState({ content: editedContent })
        this.props.onTabUnsavedChange(activeTab, false)
      }
    } catch (error) {
      console.error('Auto-save failed:', error)
    }
  }

  /** Handler for CodeMirror content changes */
  private onCodeMirrorChange = (content: string) => {
    const hasUnsavedChanges = content !== this.state.content
    this.setState({ editedContent: content })
    if (this.props.activeTab) {
      this.props.onTabUnsavedChange(this.props.activeTab, hasUnsavedChanges)
      // Schedule auto-save when content changes
      if (hasUnsavedChanges) {
        this.scheduleAutoSave()
      }
    }
  }

  private onCodeContentScroll = (event: React.UIEvent<HTMLPreElement>) => {
    // Sync line numbers scroll with code content scroll (view mode)
    if (this.viewLineNumbersRef.current) {
      this.viewLineNumbersRef.current.scrollTop = event.currentTarget.scrollTop
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

  private getTerminalTabName(tabPath: string): string {
    // Extract terminal number from ID or use a generic name
    const terminalId = getTerminalId(tabPath)
    const match = terminalId.match(/terminal-(\d+)/)
    if (match) {
      return `Terminal ${match[1]}`
    }
    return 'Terminal'
  }

  private renderTabBar() {
    const { openTabs, activeTab, repositoryPath } = this.props

    if (openTabs.length === 0) {
      return null
    }

    return (
      <div className="file-tabs">
        {openTabs.map(tab => {
          const isTerminal = isTerminalTab(tab.filePath)
          const fileName = isTerminal
            ? this.getTerminalTabName(tab.filePath)
            : Path.basename(tab.filePath)
          const isActive = tab.filePath === activeTab
          const icon = isTerminal ? octicons.terminal : this.getFileIcon(tab.filePath)
          const tabTitle = isTerminal
            ? 'Terminal'
            : Path.relative(repositoryPath, tab.filePath)

          return (
            <div
              key={tab.filePath}
              className={`file-tab ${isActive ? 'active' : ''}`}
              onClick={() => this.onTabClick(tab.filePath)}
              title={tabTitle}
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
    // Check if it's a wiki link (internal navigation)
    if (url.startsWith('wikilink://')) {
      const linkPath = decodeURIComponent(url.replace('wikilink://', ''))
      this.handleWikiLinkClick(linkPath)
      return
    }
    shell.openExternal(url)
  }

  private handleWikiLinkClick = (linkPath: string) => {
    const { repositoryPath, repositoryName, onWikiLinkClick } = this.props

    // Parse the link: could be "repo:path/to/file.md" or just "path/to/file.md"
    let targetRepo: string | null = null
    let targetPath: string = linkPath

    if (linkPath.includes(':')) {
      const colonIndex = linkPath.indexOf(':')
      targetRepo = linkPath.substring(0, colonIndex)
      targetPath = linkPath.substring(colonIndex + 1)
    }

    // If no repo specified or same repo, open in current repo
    if (!targetRepo || targetRepo === repositoryName) {
      // Resolve relative to repository root
      const fullPath = Path.join(repositoryPath, targetPath)
      // Open the file in a new tab
      this.props.onTabSelect(fullPath)
    } else if (onWikiLinkClick) {
      // Cross-repo link - let parent handle it
      onWikiLinkClick(targetRepo, targetPath)
    }
  }

  private onCheckboxToggle = async (index: number, checked: boolean) => {
    const { activeTab } = this.props
    const { content } = this.state

    if (!activeTab || content === null) {
      return
    }

    // Find all checkbox patterns in the markdown: - [ ] or - [x] or * [ ] or * [x]
    // Also handles numbered lists: 1. [ ] or 1. [x]
    const checkboxPattern = /^(\s*(?:[-*]|\d+\.)\s*)\[([ xX])\]/gm
    let match: RegExpExecArray | null
    let currentIndex = 0
    let newContent = content

    while ((match = checkboxPattern.exec(content)) !== null) {
      if (currentIndex === index) {
        const prefix = match[1]
        const currentState = match[2]
        const newState = checked ? 'x' : ' '

        // Only update if state actually changed
        if ((currentState === ' ' && checked) || (currentState !== ' ' && !checked)) {
          const before = content.slice(0, match.index)
          const after = content.slice(match.index + match[0].length)
          newContent = `${before}${prefix}[${newState}]${after}`

          // Save the file
          try {
            await FSE.writeFile(activeTab, newContent, 'utf8')
            // Update the state with new content
            this.setState({ content: newContent })
            // Update cache
            this.contentCache.set(activeTab, { content: newContent, isBinary: false, error: null })
          } catch (error) {
            console.error('Failed to save checkbox state:', error)
          }
        }
        break
      }
      currentIndex++
    }
  }

  private renderMarkdownContent() {
    const { activeTab, emoji, repositoryPath } = this.props
    const { content, isEditing } = this.state

    if (content === null || !activeTab) {
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
            onCheckboxToggle={this.onCheckboxToggle}
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
    const currentTab = openTabs.find(t => t.filePath === activeTab)
    const hasUnsavedChanges = currentTab?.hasUnsavedChanges ?? false
    const isMarkdown = activeTab ? this.isMarkdownFile(activeTab) : false

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
        {isMarkdown ? (
          <MilkdownEditor
            content={editedContent}
            onChange={this.onCodeMirrorChange}
            onSave={this.onSaveClick}
            onCancel={this.onCancelEdit}
          />
        ) : (
          <div className="editor-container codemirror-wrapper">
            <CodeMirrorEditor
              content={editedContent}
              filePath={activeTab || ''}
              onChange={this.onCodeMirrorChange}
              onSave={this.onSaveClick}
              onCancel={this.onCancelEdit}
            />
          </div>
        )}
      </div>
    )
  }

  private renderFileContent() {
    const { activeTab, repositoryPath } = this.props
    const { content, isEditing } = this.state

    if (content === null || !activeTab) {
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
          <div className="line-numbers" ref={this.viewLineNumbersRef}>
            {lines.map((_, i) => (
              <div key={i} className="line-number">
                {i + 1}
              </div>
            ))}
          </div>
          <pre
            className="code-content"
            ref={this.codeContentRef}
            onScroll={this.onCodeContentScroll}
          >
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

  private onTerminalExit = (terminalTabPath: string) => {
    this.props.onTerminalExit?.(terminalTabPath)
  }

  private renderTerminals() {
    const { openTabs, activeTab, repositoryPath } = this.props

    // Render all terminal tabs (keep them mounted but hidden when not active)
    const terminalTabs = openTabs.filter(tab => isTerminalTab(tab.filePath))

    return terminalTabs.map(tab => {
      const terminalId = getTerminalId(tab.filePath)
      const isActive = tab.filePath === activeTab

      return (
        <Terminal
          key={tab.filePath}
          terminalId={terminalId}
          cwd={repositoryPath}
          isActive={isActive}
          onExit={() => this.onTerminalExit(tab.filePath)}
        />
      )
    })
  }

  private renderContentArea() {
    const { activeTab, openTabs } = this.props
    const { isLoading, error, isBinary } = this.state

    if (openTabs.length === 0 || !activeTab) {
      return this.renderEmptyState()
    }

    // Check if active tab is a terminal
    if (isTerminalTab(activeTab)) {
      return (
        <div className="code-view-content terminal-view">
          {this.renderTerminals()}
        </div>
      )
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
export { TERMINAL_TAB_PREFIX, isTerminalTab, getTerminalId }
