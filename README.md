# GitIDE

A lightweight IDE built on Electron that combines Git version control with code editing, integrated terminal, and project management — all in one application.

GitIDE started as a fork of GitHub Desktop and evolved into a full development environment where you can edit code, run terminals, manage tasks, and handle Git operations without switching between applications.

## Key Features

### Code Editor

* **Multi-file editing** with tabs and unsaved changes tracking

* **Syntax highlighting** for JavaScript, TypeScript, Python, HTML, CSS, JSON, YAML, shell, and more (powered by CodeMirror 6)

* **Markdown editing** with rich formatting toolbar using Milkdown

* **File explorer** with create, delete, rename, and drag-and-drop support

* **Editor settings** including theme, font size, line height, and auto-save

### Integrated Terminal

* **Up to 4 terminals** per repository running simultaneously

* **Flexible layouts** — single, split columns, split rows, or grid

* **Persistent state** across repository switches

* **Large scrollback buffer** (10,000 lines) for long-running tasks

* **Terminal indicators** showing which repositories have active sessions

* **Quit confirmation** when terminals are running

### Task & Issue Management

* **GitHub Projects V2 integration** for task tracking

* **Issues panel** with filtering by state (open/closed/all)

* **Task pinning** and active task designation

* **Issue detail view** with labels and project status

### Git Operations

* Branch management and switching

* Commit creation with staging

* Push, pull, and fetch

* Stash management

* Merge and rebase

* History visualization with diffs

### Developer Workflow

* **Dev script buttons** — auto-detects `run.sh`, `start-dev.sh`, `stop-dev.sh`, `restart-dev.sh`

* **Wiki links** — navigate between repositories with `[[repo-name/file-path]]` syntax in markdown (broken lol)

* **Custom action buttons** — configurable buttons for your workflow

## Tabs

GitIDE organizes your workflow into five main tabs:

| Tab         | Purpose                             |
| ----------- | ----------------------------------- |
| **Code**    | File explorer, editor, and terminal |
| **Changes** | Git staging and commit              |
| **History** | Commit log and diffs                |
| **Issues**  | Repository issues from GitHub       |
| **Tasks**   | GitHub Projects V2 tasks            |

## Building & Running

```bash
# Build and run production version
./run.sh

# Development mode (alternative)
yarn
yarn build:dev
yarn start
```

**Requirements:** Node.js 20+

## Tech Stack

* **Electron** — desktop application framework

* **React** — UI components

* **TypeScript** — type-safe codebase

* **CodeMirror 6** — code editor

* **Milkdown** — markdown editor

* **xterm.js** — terminal emulator

* **node-pty** — terminal backend

## License

[MIT](LICENSE)
