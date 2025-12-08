import * as React from 'react'
import * as Path from 'path'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput, foldKeymap } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'

// Language support
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { python } from '@codemirror/lang-python'
import { yaml } from '@codemirror/lang-yaml'

interface ICodeMirrorEditorProps {
  /** Initial content of the editor */
  readonly content: string
  /** File path (used to determine language) */
  readonly filePath: string
  /** Called when content changes */
  readonly onChange: (content: string) => void
  /** Called when save is requested (Cmd/Ctrl+S) */
  readonly onSave: () => void
  /** Called when cancel/escape is pressed */
  readonly onCancel: () => void
  /** Whether the editor should be read-only */
  readonly readOnly?: boolean
}

/** Get the appropriate language extension based on file extension */
function getLanguageExtension(filePath: string): Extension | null {
  const ext = Path.extname(filePath).toLowerCase()

  switch (ext) {
    case '.js':
    case '.jsx':
      return javascript({ jsx: true })
    case '.ts':
    case '.tsx':
      return javascript({ jsx: true, typescript: true })
    case '.md':
    case '.markdown':
    case '.mdx':
      return markdown()
    case '.css':
      return css()
    case '.scss':
    case '.sass':
    case '.less':
      return css() // Basic CSS highlighting for SCSS/LESS
    case '.json':
      return json()
    case '.html':
    case '.htm':
      return html()
    case '.py':
    case '.pyw':
      return python()
    case '.yml':
    case '.yaml':
      return yaml()
    default:
      return null
  }
}

/** Dark theme for CodeMirror matching the app's dark UI */
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--box-background-color)',
    color: 'var(--text-color)',
    fontSize: '13px',
    fontFamily: 'var(--font-family-monospace)',
    height: '100%',
  },
  '.cm-content': {
    caretColor: 'var(--text-color)',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--text-color)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--box-selected-active-background-color)',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--box-background-color)',
    color: 'var(--text-secondary-color)',
    borderRight: '1px solid var(--box-border-color)',
    minWidth: '40px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 4px',
    minWidth: '32px',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    cursor: 'pointer',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-family-monospace)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    outline: '1px solid rgba(255, 255, 255, 0.3)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(255, 200, 0, 0.3)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(255, 200, 0, 0.5)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  // Syntax highlighting - GitHub Dark theme
  '.cm-keyword': { color: '#ff7b72' },
  '.cm-string': { color: '#a5d6ff' },
  '.cm-number': { color: '#79c0ff' },
  '.cm-comment': { color: '#8b949e', fontStyle: 'italic' },
  '.cm-variableName': { color: '#c9d1d9' },
  '.cm-typeName': { color: '#ffa657' },
  '.cm-propertyName': { color: '#79c0ff' },
  '.cm-operator': { color: '#ff7b72' },
  '.cm-punctuation': { color: '#c9d1d9' },
  '.cm-definition': { color: '#d2a8ff' },
  '.cm-function': { color: '#d2a8ff' },
  '.cm-bool': { color: '#79c0ff' },
  '.cm-null': { color: '#79c0ff' },
  '.cm-className': { color: '#ffa657' },
  '.cm-tagName': { color: '#7ee787' },
  '.cm-attributeName': { color: '#79c0ff' },
}, { dark: true })

export class CodeMirrorEditor extends React.Component<ICodeMirrorEditorProps> {
  private containerRef = React.createRef<HTMLDivElement>()
  private editorView: EditorView | null = null

  public componentDidMount() {
    this.initEditor()
  }

  public componentWillUnmount() {
    this.editorView?.destroy()
  }

  public componentDidUpdate(prevProps: ICodeMirrorEditorProps) {
    // If file path changed, reinitialize with new language
    if (prevProps.filePath !== this.props.filePath) {
      this.editorView?.destroy()
      this.initEditor()
    }
    // If content changed externally (e.g., file reload), update editor
    else if (prevProps.content !== this.props.content && this.editorView) {
      const currentContent = this.editorView.state.doc.toString()
      if (currentContent !== this.props.content) {
        this.editorView.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: this.props.content,
          },
        })
      }
    }
  }

  private initEditor() {
    if (!this.containerRef.current) return

    const { content, filePath, readOnly, onSave, onCancel, onChange } = this.props

    // Build extensions list
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
        // Save command
        {
          key: 'Mod-s',
          run: () => {
            onSave()
            return true
          },
        },
        // Cancel/escape
        {
          key: 'Escape',
          run: () => {
            onCancel()
            return true
          },
        },
      ]),
      darkTheme,
      // Update listener for content changes
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
    ]

    // Add language extension if available
    const langExtension = getLanguageExtension(filePath)
    if (langExtension) {
      extensions.push(langExtension)
    }

    // Add read-only extension if needed
    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true))
    }

    // Create editor state
    const state = EditorState.create({
      doc: content,
      extensions,
    })

    // Create editor view
    this.editorView = new EditorView({
      state,
      parent: this.containerRef.current,
    })

    // Focus the editor
    this.editorView.focus()
  }

  /** Get the current editor content */
  public getContent(): string {
    return this.editorView?.state.doc.toString() || ''
  }

  /** Focus the editor */
  public focus() {
    this.editorView?.focus()
  }

  public render() {
    return (
      <div
        ref={this.containerRef}
        className="codemirror-editor-container"
      />
    )
  }
}
