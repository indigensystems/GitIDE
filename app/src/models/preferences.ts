export enum PreferencesTab {
  Accounts,
  Integrations,
  Git,
  Appearance,
  Editor,
  Actions,
  Notifications,
  Prompts,
  Advanced,
  Accessibility,
}

/** Color theme for action buttons */
export enum ActionButtonTheme {
  Default = 'default',
  Dark = 'dark',
  Custom = 'custom',
}

/** Configuration for a custom action button */
export interface ICustomActionButton {
  /** Unique identifier */
  readonly id: string
  /** File name to watch for (e.g., 'build.sh', 'deploy.sh') */
  readonly file: string
  /** Display label for the button */
  readonly label: string
  /** Custom color (hex) - only used when theme is Custom */
  readonly color?: string
}

/** Action buttons settings configuration */
export interface IActionButtonsSettings {
  /** Color theme for buttons */
  readonly theme: ActionButtonTheme
  /** Custom colors per button ID (only used when theme is Custom) */
  readonly customColors: { readonly [buttonId: string]: string }
  /** User-defined action buttons (file patterns to watch) */
  readonly customButtons: ReadonlyArray<ICustomActionButton>
}

/** Core scripts that are always watched for (non-configurable) */
export const CoreActionScripts: ReadonlyArray<{ id: string; file: string; label: string }> = [
  { id: 'run', file: 'run.sh', label: 'Run' },
  { id: 'start-dev', file: 'start-dev.sh', label: 'Start Dev' },
  { id: 'stop-dev', file: 'stop-dev.sh', label: 'Stop Dev' },
  { id: 'restart-dev', file: 'restart-dev.sh', label: 'Restart Dev' },
  { id: 'claude', file: 'claude.md', label: 'Claude' },
]

/** UI action buttons (always visible in file tree footer) */
export const UIActionButtons: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'new-file', label: 'New File' },
  { id: 'new-folder', label: 'New Folder' },
  { id: 'terminal', label: 'Terminal' },
]

/** Default custom buttons (the utility scripts from before) */
export const DefaultCustomButtons: ReadonlyArray<ICustomActionButton> = [
  { id: 'build', file: 'build.sh', label: 'Build' },
  { id: 'dev', file: 'dev.sh', label: 'Dev' },
  { id: 'serve', file: 'serve.sh', label: 'Serve' },
  { id: 'watch', file: 'watch.sh', label: 'Watch' },
  { id: 'test', file: 'test.sh', label: 'Test' },
  { id: 'lint', file: 'lint.sh', label: 'Lint' },
  { id: 'setup', file: 'setup.sh', label: 'Setup' },
  { id: 'install', file: 'install.sh', label: 'Install' },
  { id: 'bootstrap', file: 'bootstrap.sh', label: 'Bootstrap' },
  { id: 'migrate', file: 'migrate.sh', label: 'Migrate' },
  { id: 'seed', file: 'seed.sh', label: 'Seed' },
  { id: 'deploy', file: 'deploy.sh', label: 'Deploy' },
  { id: 'release', file: 'release.sh', label: 'Release' },
  { id: 'clean', file: 'clean.sh', label: 'Clean' },
  { id: 'docker-up', file: 'docker-up.sh', label: 'Docker Up' },
  { id: 'docker-down', file: 'docker-down.sh', label: 'Docker Down' },
]

/** Default action buttons settings */
export const defaultActionButtonsSettings: IActionButtonsSettings = {
  theme: ActionButtonTheme.Default,
  customColors: {},
  customButtons: DefaultCustomButtons,
}

/** Available color themes for the code editor */
export enum EditorTheme {
  GitHubDark = 'github-dark',
  GitHubLight = 'github-light',
  Monokai = 'monokai',
  Dracula = 'dracula',
  OneDark = 'one-dark',
  SolarizedDark = 'solarized-dark',
  SolarizedLight = 'solarized-light',
  Nord = 'nord',
}

/** Default mode when opening files in the editor */
export enum EditorDefaultMode {
  ReadOnly = 'read-only',
  Edit = 'edit',
}

/** Mode lock behavior */
export enum EditorModeLock {
  None = 'none',
  ReadOnly = 'read-only',
  Edit = 'edit',
}

/** Editor settings configuration */
export interface IEditorSettings {
  /** Color theme for syntax highlighting */
  readonly theme: EditorTheme
  /** Font size in pixels */
  readonly fontSize: number
  /** Font family */
  readonly fontFamily: string
  /** Line height multiplier */
  readonly lineHeight: number
  /** Show line numbers */
  readonly showLineNumbers: boolean
  /** Show fold gutters */
  readonly showFoldGutters: boolean
  /** Default mode when opening files */
  readonly defaultMode: EditorDefaultMode
  /** Lock to a specific mode */
  readonly modeLock: EditorModeLock
  /** Tab size (number of spaces) */
  readonly tabSize: number
  /** Use spaces instead of tabs */
  readonly insertSpaces: boolean
  /** Enable word wrap */
  readonly wordWrap: boolean
  /** Auto-save delay in ms (0 to disable) */
  readonly autoSaveDelay: number
  /** Highlight active line */
  readonly highlightActiveLine: boolean
  /** Enable bracket matching */
  readonly bracketMatching: boolean
  /** Auto-close brackets */
  readonly autoCloseBrackets: boolean
  /** Enable search panel */
  readonly enableSearch: boolean
}

/** Default editor settings */
export const defaultEditorSettings: IEditorSettings = {
  theme: EditorTheme.GitHubDark,
  fontSize: 13,
  fontFamily: 'var(--font-family-monospace)',
  lineHeight: 1.5,
  showLineNumbers: true,
  showFoldGutters: true,
  defaultMode: EditorDefaultMode.ReadOnly,
  modeLock: EditorModeLock.None,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: false,
  autoSaveDelay: 1500,
  highlightActiveLine: true,
  bracketMatching: true,
  autoCloseBrackets: true,
  enableSearch: true,
}
