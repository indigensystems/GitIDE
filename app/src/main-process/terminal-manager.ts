import { BrowserWindow } from 'electron'
import { v4 as uuid } from 'uuid'
import * as ipcWebContents from './ipc-webcontents'
import * as os from 'os'
import * as pty from 'node-pty'

interface ITerminalInstance {
  id: string
  window: BrowserWindow
  cwd: string
  ptyProcess: pty.IPty | null
}

const terminals = new Map<string, ITerminalInstance>()

/**
 * Create a new terminal instance using node-pty
 */
export function createTerminal(window: BrowserWindow, cwd: string): string {
  const id = uuid()

  const shell = process.env.SHELL || '/bin/bash'

  console.log(`[Terminal] Creating terminal ${id}, shell: ${shell}, cwd: ${cwd}`)

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      SHELL: shell,
      HOME: os.homedir(),
      LANG: process.env.LANG || 'en_US.UTF-8',
    } as { [key: string]: string },
  })

  const instance: ITerminalInstance = {
    id,
    window,
    cwd,
    ptyProcess,
  }

  terminals.set(id, instance)

  ptyProcess.onData((data: string) => {
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
