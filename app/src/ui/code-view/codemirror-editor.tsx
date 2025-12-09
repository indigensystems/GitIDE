import * as React from 'react'
import * as Path from 'path'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view'
import { EditorState, Extension } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, HighlightStyle, bracketMatching, foldGutter, indentOnInput, foldKeymap } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { IEditorSettings, EditorTheme, defaultEditorSettings } from '../../models/preferences'

// Language support
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { python } from '@codemirror/lang-python'
import { yaml } from '@codemirror/lang-yaml'
import { StreamLanguage } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'

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
  /** Editor settings */
  readonly settings?: IEditorSettings
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
    case '.sh':
    case '.bash':
    case '.zsh':
    case '.bashrc':
    case '.zshrc':
    case '.profile':
      return StreamLanguage.define(shell)
    default:
      return null
  }
}

/** Color scheme definitions */
interface ColorScheme {
  background: string
  foreground: string
  selection: string
  activeLine: string
  gutterBg: string
  gutterFg: string
  keyword: string
  string: string
  number: string
  comment: string
  variable: string
  type: string
  property: string
  operator: string
  function: string
  tag: string
  attribute: string
  isDark: boolean
}

const colorSchemes: Record<EditorTheme, ColorScheme> = {
  [EditorTheme.GitHubDark]: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    selection: 'rgba(56, 139, 253, 0.4)',
    activeLine: 'rgba(255, 255, 255, 0.05)',
    gutterBg: '#0d1117',
    gutterFg: '#8b949e',
    keyword: '#ff7b72',
    string: '#a5d6ff',
    number: '#79c0ff',
    comment: '#8b949e',
    variable: '#c9d1d9',
    type: '#ffa657',
    property: '#79c0ff',
    operator: '#ff7b72',
    function: '#d2a8ff',
    tag: '#7ee787',
    attribute: '#79c0ff',
    isDark: true,
  },
  [EditorTheme.GitHubLight]: {
    background: '#ffffff',
    foreground: '#24292f',
    selection: 'rgba(84, 174, 255, 0.4)',
    activeLine: 'rgba(0, 0, 0, 0.04)',
    gutterBg: '#ffffff',
    gutterFg: '#57606a',
    keyword: '#cf222e',
    string: '#0a3069',
    number: '#0550ae',
    comment: '#6e7781',
    variable: '#24292f',
    type: '#953800',
    property: '#0550ae',
    operator: '#cf222e',
    function: '#8250df',
    tag: '#116329',
    attribute: '#0550ae',
    isDark: false,
  },
  [EditorTheme.Monokai]: {
    background: '#272822',
    foreground: '#f8f8f2',
    selection: 'rgba(73, 72, 62, 0.8)',
    activeLine: 'rgba(255, 255, 255, 0.05)',
    gutterBg: '#272822',
    gutterFg: '#90908a',
    keyword: '#f92672',
    string: '#e6db74',
    number: '#ae81ff',
    comment: '#75715e',
    variable: '#f8f8f2',
    type: '#66d9ef',
    property: '#a6e22e',
    operator: '#f92672',
    function: '#a6e22e',
    tag: '#f92672',
    attribute: '#a6e22e',
    isDark: true,
  },
  [EditorTheme.Dracula]: {
    background: '#282a36',
    foreground: '#f8f8f2',
    selection: 'rgba(68, 71, 90, 0.8)',
    activeLine: 'rgba(255, 255, 255, 0.05)',
    gutterBg: '#282a36',
    gutterFg: '#6272a4',
    keyword: '#ff79c6',
    string: '#f1fa8c',
    number: '#bd93f9',
    comment: '#6272a4',
    variable: '#f8f8f2',
    type: '#8be9fd',
    property: '#50fa7b',
    operator: '#ff79c6',
    function: '#50fa7b',
    tag: '#ff79c6',
    attribute: '#50fa7b',
    isDark: true,
  },
  [EditorTheme.OneDark]: {
    background: '#282c34',
    foreground: '#abb2bf',
    selection: 'rgba(62, 68, 81, 0.8)',
    activeLine: 'rgba(255, 255, 255, 0.05)',
    gutterBg: '#282c34',
    gutterFg: '#636d83',
    keyword: '#c678dd',
    string: '#98c379',
    number: '#d19a66',
    comment: '#5c6370',
    variable: '#e06c75',
    type: '#e5c07b',
    property: '#61afef',
    operator: '#56b6c2',
    function: '#61afef',
    tag: '#e06c75',
    attribute: '#d19a66',
    isDark: true,
  },
  [EditorTheme.SolarizedDark]: {
    background: '#002b36',
    foreground: '#839496',
    selection: 'rgba(7, 54, 66, 0.8)',
    activeLine: 'rgba(255, 255, 255, 0.05)',
    gutterBg: '#002b36',
    gutterFg: '#586e75',
    keyword: '#859900',
    string: '#2aa198',
    number: '#d33682',
    comment: '#586e75',
    variable: '#b58900',
    type: '#b58900',
    property: '#268bd2',
    operator: '#859900',
    function: '#268bd2',
    tag: '#268bd2',
    attribute: '#93a1a1',
    isDark: true,
  },
  [EditorTheme.SolarizedLight]: {
    background: '#fdf6e3',
    foreground: '#657b83',
    selection: 'rgba(238, 232, 213, 0.8)',
    activeLine: 'rgba(0, 0, 0, 0.04)',
    gutterBg: '#fdf6e3',
    gutterFg: '#93a1a1',
    keyword: '#859900',
    string: '#2aa198',
    number: '#d33682',
    comment: '#93a1a1',
    variable: '#b58900',
    type: '#b58900',
    property: '#268bd2',
    operator: '#859900',
    function: '#268bd2',
    tag: '#268bd2',
    attribute: '#657b83',
    isDark: false,
  },
  [EditorTheme.Nord]: {
    background: '#2e3440',
    foreground: '#d8dee9',
    selection: 'rgba(67, 76, 94, 0.8)',
    activeLine: 'rgba(255, 255, 255, 0.05)',
    gutterBg: '#2e3440',
    gutterFg: '#4c566a',
    keyword: '#81a1c1',
    string: '#a3be8c',
    number: '#b48ead',
    comment: '#616e88',
    variable: '#d8dee9',
    type: '#8fbcbb',
    property: '#88c0d0',
    operator: '#81a1c1',
    function: '#88c0d0',
    tag: '#81a1c1',
    attribute: '#8fbcbb',
    isDark: true,
  },
}

/** Create a syntax highlight style based on color scheme */
function createHighlightStyle(scheme: ColorScheme): HighlightStyle {
  return HighlightStyle.define([
    { tag: t.keyword, color: scheme.keyword },
    { tag: t.controlKeyword, color: scheme.keyword },
    { tag: t.operatorKeyword, color: scheme.keyword },
    { tag: t.definitionKeyword, color: scheme.keyword },
    { tag: t.moduleKeyword, color: scheme.keyword },
    { tag: t.string, color: scheme.string },
    { tag: t.special(t.string), color: scheme.string },
    { tag: t.number, color: scheme.number },
    { tag: t.integer, color: scheme.number },
    { tag: t.float, color: scheme.number },
    { tag: t.bool, color: scheme.number },
    { tag: t.null, color: scheme.number },
    { tag: t.comment, color: scheme.comment, fontStyle: 'italic' },
    { tag: t.lineComment, color: scheme.comment, fontStyle: 'italic' },
    { tag: t.blockComment, color: scheme.comment, fontStyle: 'italic' },
    { tag: t.docComment, color: scheme.comment, fontStyle: 'italic' },
    { tag: t.variableName, color: scheme.variable },
    { tag: t.definition(t.variableName), color: scheme.function },
    { tag: t.typeName, color: scheme.type },
    { tag: t.className, color: scheme.type },
    { tag: t.namespace, color: scheme.type },
    { tag: t.propertyName, color: scheme.property },
    { tag: t.definition(t.propertyName), color: scheme.property },
    { tag: t.function(t.variableName), color: scheme.function },
    { tag: t.function(t.propertyName), color: scheme.function },
    { tag: t.operator, color: scheme.operator },
    { tag: t.punctuation, color: scheme.foreground },
    { tag: t.bracket, color: scheme.foreground },
    { tag: t.paren, color: scheme.foreground },
    { tag: t.squareBracket, color: scheme.foreground },
    { tag: t.brace, color: scheme.foreground },
    { tag: t.tagName, color: scheme.tag },
    { tag: t.attributeName, color: scheme.attribute },
    { tag: t.attributeValue, color: scheme.string },
    { tag: t.labelName, color: scheme.variable },
    { tag: t.macroName, color: scheme.function },
    { tag: t.meta, color: scheme.comment },
    { tag: t.atom, color: scheme.number },
    { tag: t.self, color: scheme.keyword },
    { tag: t.regexp, color: scheme.string },
    { tag: t.escape, color: scheme.operator },
    { tag: t.link, color: scheme.property, textDecoration: 'underline' },
    { tag: t.url, color: scheme.property, textDecoration: 'underline' },
    { tag: t.heading, color: scheme.keyword, fontWeight: 'bold' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strong, fontWeight: 'bold' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
  ])
}

/** Create a theme extension based on settings */
function createTheme(settings: IEditorSettings): Extension {
  const scheme = colorSchemes[settings.theme]

  return EditorView.theme({
    '&': {
      backgroundColor: scheme.background,
      color: scheme.foreground,
      fontSize: `${settings.fontSize}px`,
      fontFamily: settings.fontFamily,
      height: '100%',
    },
    '.cm-content': {
      caretColor: scheme.foreground,
      padding: '8px 0',
      lineHeight: settings.lineHeight.toString(),
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: scheme.foreground,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: scheme.selection,
    },
    '.cm-activeLine': {
      backgroundColor: settings.highlightActiveLine ? scheme.activeLine : 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: settings.highlightActiveLine ? scheme.activeLine : 'transparent',
    },
    '.cm-gutters': {
      backgroundColor: scheme.gutterBg,
      color: scheme.gutterFg,
      borderRight: `1px solid ${scheme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
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
      fontFamily: settings.fontFamily,
    },
    '.cm-matchingBracket': {
      backgroundColor: scheme.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
      outline: `1px solid ${scheme.isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)'}`,
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(255, 200, 0, 0.3)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(255, 200, 0, 0.5)',
    },
    '.cm-selectionMatch': {
      backgroundColor: scheme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
  }, { dark: scheme.isDark })
}

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
    // If file path, readOnly, or settings changed, reinitialize editor
    if (
      prevProps.filePath !== this.props.filePath ||
      prevProps.readOnly !== this.props.readOnly ||
      prevProps.settings !== this.props.settings
    ) {
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

    const { content, filePath, readOnly, onSave, onCancel, onChange, settings } = this.props

    // Use default settings if not provided
    const effectiveSettings = settings || defaultEditorSettings

    // Get color scheme and create highlight style
    const scheme = colorSchemes[effectiveSettings.theme]
    const highlightStyle = createHighlightStyle(scheme)

    // Build extensions list
    const extensions: Extension[] = [
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(highlightStyle),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      // Tab size and insert spaces
      EditorState.tabSize.of(effectiveSettings.tabSize),
    ]

    // Add line numbers if enabled
    if (effectiveSettings.showLineNumbers) {
      extensions.push(lineNumbers())
      extensions.push(highlightActiveLineGutter())
    }

    // Add fold gutters if enabled
    if (effectiveSettings.showFoldGutters) {
      extensions.push(foldGutter())
    }

    // Add active line highlighting if enabled
    if (effectiveSettings.highlightActiveLine) {
      extensions.push(highlightActiveLine())
    }

    // Add bracket matching if enabled
    if (effectiveSettings.bracketMatching) {
      extensions.push(bracketMatching())
    }

    // Add auto-close brackets if enabled
    if (effectiveSettings.autoCloseBrackets) {
      extensions.push(closeBrackets())
    }

    // Add word wrap if enabled
    if (effectiveSettings.wordWrap) {
      extensions.push(EditorView.lineWrapping)
    }

    // Build keymap
    const keymaps = [
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      indentWithTab,
    ]

    // Add search keymap if enabled
    if (effectiveSettings.enableSearch) {
      keymaps.push(...searchKeymap)
      extensions.push(search())
    }

    // Add auto-close brackets keymap
    if (effectiveSettings.autoCloseBrackets) {
      keymaps.push(...closeBracketsKeymap)
    }

    // Add save and cancel commands
    keymaps.push(
      {
        key: 'Mod-s',
        run: () => {
          onSave()
          return true
        },
      },
      {
        key: 'Escape',
        run: () => {
          onCancel()
          return true
        },
      }
    )

    extensions.push(keymap.of(keymaps))

    // Add theme
    extensions.push(createTheme(effectiveSettings))

    // Update listener for content changes
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      })
    )

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

    // Focus the editor if not read-only
    if (!readOnly) {
      this.editorView.focus()
    }
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
        data-readonly={this.props.readOnly}
      />
    )
  }
}
