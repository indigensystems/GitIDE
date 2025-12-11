import * as React from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { webUtils } from 'electron'
import * as ipcRenderer from '../../lib/ipc-renderer'
import '@xterm/xterm/css/xterm.css'

interface ITerminalProps {
  /** Terminal ID from main process */
  readonly terminalId: string
  /** Working directory for the terminal */
  readonly cwd: string
  /** Whether this terminal tab is active */
  readonly isActive: boolean
  /** Whether this terminal has been activated by user clicking the overlay */
  readonly isActivated: boolean
  /** Callback when user clicks overlay to activate terminal */
  readonly onActivate?: () => void
  /** Callback when terminal exits */
  readonly onExit?: (exitCode: number) => void
}

interface ITerminalState {
  readonly isReady: boolean
  readonly isDragOver: boolean
}

export class Terminal extends React.Component<ITerminalProps, ITerminalState> {
  private containerRef = React.createRef<HTMLDivElement>()
  private xterm: XTerm | null = null
  private fitAddon: FitAddon | null = null
  private resizeObserver: ResizeObserver | null = null
  private dataHandler: ((event: Electron.IpcRendererEvent, id: string, data: string) => void) | null = null
  private exitHandler: ((event: Electron.IpcRendererEvent, id: string, exitCode: number) => void) | null = null

  public constructor(props: ITerminalProps) {
    super(props)
    this.state = { isReady: false, isDragOver: false }
  }

  public componentDidMount() {
    this.initializeTerminal()
  }

  public componentDidUpdate(prevProps: ITerminalProps) {
    if (this.props.isActive && !prevProps.isActive) {
      // Terminal became active, fit to container and scroll to bottom
      this.fitTerminal()
      this.xterm?.scrollToBottom()
      this.xterm?.focus()
    }
  }

  public componentWillUnmount() {
    this.cleanup()
  }

  private async initializeTerminal() {
    console.log('[Terminal] initializeTerminal called, terminalId:', this.props.terminalId)
    if (!this.containerRef.current) {
      console.log('[Terminal] No container ref!')
      return
    }

    // Create xterm instance
    this.xterm = new XTerm({
      cursorBlink: true,
      fontFamily: 'var(--font-family-monospace)',
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 10000, // Large scrollback buffer for long-running tasks like Claude
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    })

    this.fitAddon = new FitAddon()
    this.xterm.loadAddon(this.fitAddon)

    // Open terminal in container
    this.xterm.open(this.containerRef.current)

    // Delay initial fit to allow CSS grid to settle dimensions
    // This is crucial for terminals in grid cells that haven't been sized yet
    requestAnimationFrame(() => {
      this.fitTerminal()
      // Send another fit after a short delay to catch any late layout changes
      setTimeout(() => {
        this.fitTerminal()
        // Force PTY to update with correct dimensions
        ipcRenderer.invoke('terminal-force-redraw', this.props.terminalId)
      }, 150)
    })

    // Set up IPC listeners for terminal data
    this.dataHandler = (_event, id: string, data: string) => {
      console.log('[Terminal] Received data for id:', id, 'my id:', this.props.terminalId, 'data length:', data.length)
      if (id === this.props.terminalId && this.xterm) {
        console.log('[Terminal] Writing data to xterm')
        // Check if user is at (or near) the bottom before writing
        const buffer = this.xterm.buffer.active
        const isAtBottom = buffer.viewportY >= buffer.baseY - 1

        this.xterm.write(data, () => {
          // Only auto-scroll if user was already at the bottom
          if (isAtBottom) {
            this.xterm?.scrollToBottom()
          }
        })
      }
    }

    this.exitHandler = (_event, id: string, exitCode: number) => {
      if (id === this.props.terminalId) {
        this.props.onExit?.(exitCode)
      }
    }

    ipcRenderer.on('terminal-data', this.dataHandler)
    ipcRenderer.on('terminal-exit', this.exitHandler)

    // Send user input to main process - PTY handles echo
    this.xterm.onData(data => {
      ipcRenderer.invoke('terminal-write', this.props.terminalId, data)
    })

    // Handle resize
    this.xterm.onResize(({ cols, rows }) => {
      ipcRenderer.invoke('terminal-resize', this.props.terminalId, cols, rows)
    })

    // Set up resize observer
    this.resizeObserver = new ResizeObserver(() => {
      this.fitTerminal()
    })
    this.resizeObserver.observe(this.containerRef.current)

    this.setState({ isReady: true })
    console.log('[Terminal] Terminal initialized and ready, terminalId:', this.props.terminalId)

    // Replay buffered output from main process (for reconnecting after repo switch)
    this.replayBuffer()

    // Focus if active
    if (this.props.isActive) {
      this.xterm.focus()
    }
  }

  private async replayBuffer() {
    if (!this.xterm) return

    try {
      const buffer = await ipcRenderer.invoke('terminal-get-buffer', this.props.terminalId)
      if (buffer && buffer.length > 0) {
        console.log('[Terminal] Replaying buffer, length:', buffer.length)
        this.xterm.write(buffer, () => {
          // Scroll to bottom after buffer replay completes
          this.xterm?.scrollToBottom()
        })

        // After replaying buffer, force a redraw by sending SIGWINCH.
        // This helps TUI apps (like Claude) redraw correctly.
        // Small delay to ensure xterm has processed the buffer first.
        setTimeout(async () => {
          try {
            await ipcRenderer.invoke('terminal-force-redraw', this.props.terminalId)
            console.log('[Terminal] Sent force redraw signal')
            // Scroll to bottom again after redraw
            this.xterm?.scrollToBottom()
          } catch (e) {
            console.error('[Terminal] Failed to send force redraw:', e)
          }
        }, 100)
      }
    } catch (e) {
      console.error('[Terminal] Failed to replay buffer:', e)
    }
  }

  private fitTerminal() {
    if (this.fitAddon && this.xterm && this.containerRef.current) {
      try {
        // Only fit if container has valid dimensions
        const rect = this.containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          this.fitAddon.fit()
        } else {
          // Retry fit after a short delay if container isn't ready
          setTimeout(() => this.fitTerminal(), 50)
        }
      } catch (e) {
        // Ignore fit errors when container is not visible
      }
    }
  }

  private cleanup() {
    console.log('[Terminal] cleanup called for terminalId:', this.props.terminalId)
    if (this.dataHandler) {
      ipcRenderer.removeListener('terminal-data', this.dataHandler)
    }
    if (this.exitHandler) {
      ipcRenderer.removeListener('terminal-exit', this.exitHandler)
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    if (this.xterm) {
      this.xterm.dispose()
    }

    // Note: We do NOT kill the terminal process here.
    // The PTY should persist so we can reconnect when switching back.
    // Terminal is only killed when explicitly closed or app exits.
  }

  private onOverlayClick = () => {
    this.props.onActivate?.()
  }

  /**
   * Escape a file path for use in shell commands.
   * Wraps in single quotes and escapes any existing single quotes.
   */
  private escapePathForShell(filePath: string): string {
    // Escape single quotes by ending quote, adding escaped quote, starting new quote
    // e.g., "file's name" -> 'file'\''s name'
    const escaped = filePath.replace(/'/g, "'\\''")
    return `'${escaped}'`
  }

  private onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  private onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Only show drag indicator if files are being dragged
    if (e.dataTransfer.types.includes('Files')) {
      this.setState({ isDragOver: true })
    }
  }

  private onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Only hide if we're leaving the terminal wrapper entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      this.setState({ isDragOver: false })
    }
  }

  private onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    console.log('[Terminal] onDrop called')
    e.preventDefault()
    e.stopPropagation()
    this.setState({ isDragOver: false })

    // Get dropped files
    const files = e.dataTransfer.files
    console.log('[Terminal] Dropped files count:', files.length)
    if (files.length === 0) {
      return
    }

    // Build escaped path string for all dropped files
    const paths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      // Use webUtils.getPathForFile for Electron with context isolation
      const filePath = webUtils.getPathForFile(file)
      console.log('[Terminal] File path:', filePath)
      if (filePath) {
        paths.push(this.escapePathForShell(filePath))
      }
    }

    if (paths.length > 0) {
      // Write paths to terminal, separated by spaces
      const pathString = paths.join(' ')
      console.log('[Terminal] Writing to terminal:', pathString)
      ipcRenderer.invoke('terminal-write', this.props.terminalId, pathString)
    }
  }

  private renderActivationOverlay() {
    if (this.props.isActivated) {
      return null
    }

    return (
      <div className="terminal-activation-overlay" onClick={this.onOverlayClick}>
        <div className="terminal-activation-content">
          <div className="terminal-activation-icon">▶</div>
          <div className="terminal-activation-text">Click to activate terminal</div>
        </div>
      </div>
    )
  }

  public render() {
    const { isActive, isActivated } = this.props
    const { isDragOver } = this.state

    return (
      <div
        className="terminal-wrapper"
        style={{
          width: '100%',
          height: '100%',
          display: isActive ? 'flex' : 'none',
          flexDirection: 'column',
          position: 'relative',
        }}
        onDragOver={this.onDragOver}
        onDragEnter={this.onDragEnter}
        onDragLeave={this.onDragLeave}
        onDrop={this.onDrop}
      >
        {this.renderActivationOverlay()}
        {isDragOver && (
          <div className="terminal-drop-overlay">
            <div className="terminal-drop-content">
              <div className="terminal-drop-icon">📁</div>
              <div className="terminal-drop-text">Drop to insert file path</div>
            </div>
          </div>
        )}
        <div
          className="terminal-container"
          ref={this.containerRef}
          style={{
            width: '100%',
            height: '100%',
            opacity: isActivated ? 1 : 0.3,
            pointerEvents: isActivated ? 'auto' : 'none',
          }}
        />
      </div>
    )
  }
}
