import * as Fs from 'fs'
import * as Path from 'path'
import { Repository } from '../../../models/repository'

/**
 * Debounce interval in milliseconds to prevent rapid-fire refreshes
 * when multiple file system events occur in quick succession.
 */
const DebounceInterval = 100

/**
 * Polling interval for fs.watchFile. This is more reliable than fs.watch
 * on macOS which can miss events after the first change.
 */
const PollInterval = 500

/**
 * A watcher that monitors the .git/HEAD file for changes to detect
 * when the current branch is changed externally (e.g., via CLI).
 *
 * Uses fs.watchFile (polling) instead of fs.watch because fs.watch
 * is unreliable on macOS and can stop firing events after the first change.
 */
export class GitHeadWatcher {
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null
  private lastContent: string | null = null
  private stopped = false
  private headPath: string

  public constructor(
    private readonly repository: Repository,
    private readonly onHeadChanged: (repository: Repository) => void
  ) {
    this.headPath = Path.join(this.repository.path, '.git', 'HEAD')
  }

  /**
   * Start watching the .git/HEAD file for changes.
   */
  public start(): void {
    if (this.stopped) {
      return
    }

    // Read initial content to compare against
    try {
      this.lastContent = Fs.readFileSync(this.headPath, 'utf8')
    } catch (e) {
      log.warn(`Unable to read initial HEAD content for ${this.repository.name}`, e)
      return
    }

    try {
      // Use watchFile (polling) - more reliable than watch on macOS
      Fs.watchFile(
        this.headPath,
        { persistent: false, interval: PollInterval },
        this.onFileChanged
      )
    } catch (error) {
      log.warn(`Unable to start HEAD watcher for ${this.repository.name}`, error)
    }
  }

  private onFileChanged = (curr: Fs.Stats, prev: Fs.Stats): void => {
    // Check if the file was actually modified
    if (curr.mtimeMs === prev.mtimeMs) {
      return
    }

    // Debounce rapid changes
    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout)
    }

    this.debounceTimeout = setTimeout(() => {
      this.debounceTimeout = null
      this.checkForContentChange()
    }, DebounceInterval)
  }

  private checkForContentChange(): void {
    if (this.stopped) {
      return
    }

    try {
      const currentContent = Fs.readFileSync(this.headPath, 'utf8')

      // Only trigger if content actually changed
      if (currentContent !== this.lastContent) {
        this.lastContent = currentContent
        log.info(`HEAD changed for ${this.repository.name}, triggering refresh`)
        this.onHeadChanged(this.repository)
      }
    } catch (e) {
      // File might be temporarily unavailable during git operations
      log.debug(`Unable to read HEAD file for ${this.repository.name}`, e)
    }
  }

  /**
   * Stop watching the .git/HEAD file.
   */
  public stop(): void {
    this.stopped = true

    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }

    Fs.unwatchFile(this.headPath, this.onFileChanged)
  }
}
