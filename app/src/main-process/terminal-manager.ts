import { BrowserWindow } from 'electron'
import { v4 as uuid } from 'uuid'
import * as ipcWebContents from './ipc-webcontents'
import * as os from 'os'
import * as pty from 'node-pty'

// Buffer size for terminal output (in characters) - enough for scrollback
// 10000 lines * ~150 chars avg = ~1.5MB max buffer per terminal
const OUTPUT_BUFFER_SIZE = 1500000

/**
 * Get the default shell for the current platform.
 * - Windows: PowerShell if available, otherwise cmd.exe
 * - macOS/Linux: Uses SHELL environment variable or falls back to /bin/bash
 */
function getDefaultShell(): string {
  if (__WIN32__) {
    // Use Windows PowerShell which is available on all modern Windows versions
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    return `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  }

  // macOS and Linux
  return process.env.SHELL || '/bin/bash'
}

interface ITerminalInstance {
  id: string
  window: BrowserWindow
  cwd: string
  ptyProcess: pty.IPty | null
  outputBuffer: string // Stores recent output for replay on reconnect
}

const terminals = new Map<string, ITerminalInstance>()

/**
 * Create a new terminal instance using node-pty
 */
export function createTerminal(window: BrowserWindow, cwd: string): string {
  const id = uuid()

  const shell = getDefaultShell()

  console.log(`[Terminal] Creating terminal ${id}, shell: ${shell}, cwd: ${cwd}`)

  // Build environment variables based on platform
  const baseEnv: { [key: string]: string } = {
    ...process.env,
    TERM: 'xterm-256color',
    TERM_PROGRAM: 'GitHubDesktop',
    TERM_PROGRAM_VERSION: '1.0.0',
  } as { [key: string]: string }

  if (__WIN32__) {
    // Windows-specific environment
    baseEnv.COMSPEC = process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe'
    baseEnv.USERPROFILE = os.homedir()
  } else {
    // macOS/Linux environment
    baseEnv.SHELL = shell
    baseEnv.HOME = os.homedir()
    baseEnv.LANG = process.env.LANG || 'en_US.UTF-8'
    // Prevent any shell integration scripts from triggering external apps (macOS-specific)
    if (__DARWIN__) {
      baseEnv.__CFBundleIdentifier = 'com.github.GitHubClient'
    }
  }

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: baseEnv,
  })

  const instance: ITerminalInstance = {
    id,
    window,
    cwd,
    ptyProcess,
    outputBuffer: '',
  }

  terminals.set(id, instance)

  ptyProcess.onData((data: string) => {
    // Buffer the output for replay on reconnect
    instance.outputBuffer += data
    // Trim buffer if it gets too large
    if (instance.outputBuffer.length > OUTPUT_BUFFER_SIZE) {
      instance.outputBuffer = instance.outputBuffer.slice(-OUTPUT_BUFFER_SIZE)
    }

    if (!window.isDestroyed()) {
      ipcWebContents.send(window.webContents, 'terminal-data', id, data)
    }
  })

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[Terminal ${id}] Process exited with code:`, exitCode)
    if (!window.isDestroyed()) {
      ipcWebContents.send(window.webContents, 'terminal-exit', id, exitCode)
    }
    terminals.delete(id)
  })

  console.log(`[Terminal] Created terminal ${id}`)

  return id
}

/**
 * Write data to a terminal
 */
export function writeToTerminal(id: string, data: string): void {
  const instance = terminals.get(id)
  if (!instance || !instance.ptyProcess) {
    return
  }
  instance.ptyProcess.write(data)
}

/**
 * Resize a terminal
 */
export function resizeTerminal(id: string, cols: number, rows: number): void {
  const instance = terminals.get(id)
  if (!instance || !instance.ptyProcess) {
    return
  }
  instance.ptyProcess.resize(cols, rows)
}

/**
 * Kill a terminal
 */
export function killTerminal(id: string): void {
  const instance = terminals.get(id)
  if (instance?.ptyProcess) {
    instance.ptyProcess.kill()
  }
  terminals.delete(id)
}

/**
 * Kill all terminals for a window
 */
export function killAllTerminalsForWindow(window: BrowserWindow): void {
  for (const [id, instance] of terminals) {
    if (instance.window === window) {
      if (instance.ptyProcess) {
        instance.ptyProcess.kill()
      }
      terminals.delete(id)
    }
  }
}

/**
 * Get the buffered output for a terminal (for replay on reconnect)
 */
export function getTerminalBuffer(id: string): string {
  const instance = terminals.get(id)
  return instance?.outputBuffer || ''
}

/**
 * Check if a terminal exists
 */
export function terminalExists(id: string): boolean {
  return terminals.has(id)
}

/**
 * Get the count of active terminals (for quit warning)
 */
export function getActiveTerminalCount(): number {
  return terminals.size
}

/**
 * Check if there are any active terminals
 */
export function hasActiveTerminals(): boolean {
  return terminals.size > 0
}

/**
 * Force a terminal to redraw by triggering a resize.
 * This sends SIGWINCH to the PTY process, causing TUI apps to redraw.
 */
export function forceRedraw(id: string): void {
  const instance = terminals.get(id)
  if (!instance || !instance.ptyProcess) {
    return
  }

  // Get current size and trigger a resize to the same dimensions.
  // node-pty's resize() will send SIGWINCH to the process.
  const cols = instance.ptyProcess.cols
  const rows = instance.ptyProcess.rows

  // Resize to slightly different size then back to force SIGWINCH
  instance.ptyProcess.resize(cols, rows + 1)
  instance.ptyProcess.resize(cols, rows)
}
