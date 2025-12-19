import * as React from 'react'
import * as Path from 'path'
import { useEffect, useCallback, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react'
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, wrapInHeadingCommand, wrapInBulletListCommand, wrapInOrderedListCommand, wrapInBlockquoteCommand, insertHrCommand, createCodeBlockCommand, toggleLinkCommand, insertImageCommand } from '@milkdown/preset-commonmark'
import { gfm, toggleStrikethroughCommand, insertTableCommand } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { cursor } from '@milkdown/plugin-cursor'
import { indent } from '@milkdown/plugin-indent'
import { trailing } from '@milkdown/plugin-trailing'
import { listItemBlockComponent } from '@milkdown/components/list-item-block'
import { replaceAll, callCommand, $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IMilkdownEditorProps {
  /** Initial markdown content */
  readonly content: string
  /** Called when content changes */
  readonly onChange: (content: string) => void
  /** Called when save is requested (Cmd/Ctrl+S) */
  readonly onSave: () => void
  /** Whether the editor should be read-only */
  readonly readOnly?: boolean
  /** Base directory for resolving relative image paths */
  readonly baseDir?: string
  /** Called when the first H1 heading changes (for Obsidian-like file renaming) */
  readonly onH1Change?: (newH1: string) => void
}

/** Formatting toolbar for the Milkdown editor */
function FormattingToolbar({ readOnly }: { readOnly?: boolean }) {
  const [loading, getInstance] = useInstance()

  const runCommand = useCallback((command: any, payload?: any) => {
    const editor = getInstance()
    if (!loading && editor) {
      // Run the command
      editor.action(callCommand(command.key, payload))
      // Refocus the editor after command completes
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        requestAnimationFrame(() => view.focus())
      })
    }
  }, [loading, getInstance])

  const insertText = useCallback((text: string) => {
    const editor = getInstance()
    if (!loading && editor) {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const { state, dispatch } = view
        const { from, to } = state.selection
        dispatch(state.tr.insertText(text, from, to))
        // Refocus the editor
        requestAnimationFrame(() => view.focus())
      })
    }
  }, [loading, getInstance])

  // Prevent button from stealing focus
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  if (readOnly) {
    return null
  }

  return (
    <div className="milkdown-toolbar">
      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={() => runCommand(toggleStrongCommand)}
          onMouseDown={handleMouseDown}
          title="Bold (Cmd+B)"
        >
          <Octicon symbol={octicons.bold} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(toggleEmphasisCommand)}
          onMouseDown={handleMouseDown}
          title="Italic (Cmd+I)"
        >
          <Octicon symbol={octicons.italic} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(toggleStrikethroughCommand)}
          onMouseDown={handleMouseDown}
          title="Strikethrough"
        >
          <Octicon symbol={octicons.strikethrough} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(toggleInlineCodeCommand)}
          onMouseDown={handleMouseDown}
          title="Inline Code"
        >
          <Octicon symbol={octicons.code} />
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={() => runCommand(wrapInHeadingCommand, 1)}
          onMouseDown={handleMouseDown}
          title="Heading 1"
        >
          H1
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(wrapInHeadingCommand, 2)}
          onMouseDown={handleMouseDown}
          title="Heading 2"
        >
          H2
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(wrapInHeadingCommand, 3)}
          onMouseDown={handleMouseDown}
          title="Heading 3"
        >
          H3
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={() => runCommand(wrapInBulletListCommand)}
          onMouseDown={handleMouseDown}
          title="Bullet List"
        >
          <Octicon symbol={octicons.listUnordered} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(wrapInOrderedListCommand)}
          onMouseDown={handleMouseDown}
          title="Numbered List"
        >
          <Octicon symbol={octicons.listOrdered} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => insertText('- [ ] ')}
          onMouseDown={handleMouseDown}
          title="Task List"
        >
          <Octicon symbol={octicons.tasklist} />
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={() => runCommand(wrapInBlockquoteCommand)}
          onMouseDown={handleMouseDown}
          title="Quote"
        >
          <Octicon symbol={octicons.quote} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(insertHrCommand)}
          onMouseDown={handleMouseDown}
          title="Horizontal Rule"
        >
          <Octicon symbol={octicons.horizontalRule} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(createCodeBlockCommand)}
          onMouseDown={handleMouseDown}
          title="Code Block"
        >
          <Octicon symbol={octicons.codeSquare} />
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={() => runCommand(toggleLinkCommand, { href: '' })}
          onMouseDown={handleMouseDown}
          title="Link"
        >
          <Octicon symbol={octicons.link} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(insertImageCommand, { src: '', alt: 'image' })}
          onMouseDown={handleMouseDown}
          title="Image"
        >
          <Octicon symbol={octicons.image} />
        </button>
        <button
          className="toolbar-button"
          onClick={() => runCommand(insertTableCommand, { row: 3, col: 3 })}
          onMouseDown={handleMouseDown}
          title="Table"
        >
          <Octicon symbol={octicons.table} />
        </button>
      </div>
    </div>
  )
}

/** Creates a plugin that resolves relative image paths to absolute file:// URLs */
function createImageResolverPlugin(baseDir: string | undefined) {
  const imageResolverKey = new PluginKey('imageResolver')

  return $prose(() => new Plugin({
    key: imageResolverKey,
    props: {
      nodeViews: {
        image: (node, view, getPos) => {
          const dom = document.createElement('img')
          const src = node.attrs.src as string

          // Resolve relative paths to absolute file:// URLs
          if (baseDir && src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('file://') && !src.startsWith('data:')) {
            const absolutePath = Path.resolve(baseDir, src)
            dom.src = `file://${absolutePath}`
          } else {
            dom.src = src
          }

          if (node.attrs.alt) {
            dom.alt = node.attrs.alt as string
          }
          if (node.attrs.title) {
            dom.title = node.attrs.title as string
          }

          return {
            dom,
            update: (updatedNode) => {
              if (updatedNode.type.name !== 'image') return false
              const updatedSrc = updatedNode.attrs.src as string
              if (baseDir && updatedSrc && !updatedSrc.startsWith('http://') && !updatedSrc.startsWith('https://') && !updatedSrc.startsWith('file://') && !updatedSrc.startsWith('data:')) {
                const absolutePath = Path.resolve(baseDir, updatedSrc)
                dom.src = `file://${absolutePath}`
              } else {
                dom.src = updatedSrc
              }
              if (updatedNode.attrs.alt) {
                dom.alt = updatedNode.attrs.alt as string
              }
              if (updatedNode.attrs.title) {
                dom.title = updatedNode.attrs.title as string
              }
              return true
            },
            destroy: () => {},
          }
        }
      }
    }
  }))
}

/** Extract the first H1 heading text from markdown content */
function extractFirstH1(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}

/** Inner component that sets up the editor with hooks */
function MilkdownEditorCore(props: IMilkdownEditorProps) {
  const { content, onChange, onSave, readOnly, baseDir, onH1Change } = props

  // Track if this is the initial mount to avoid replacing content on first render
  const isInitialMount = useRef(true)
  // Track the last content we set to avoid feedback loops
  const lastSetContent = useRef(content)
  // Track the last H1 to detect changes
  const lastH1 = useRef<string | null>(extractFirstH1(content))
  // Track if the editor is ready (to avoid firing H1 change during initialization)
  const isEditorReady = useRef(false)
  // Debounce timer for H1 changes
  const h1DebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref for readOnly to use in callbacks without causing re-renders
  const readOnlyRef = useRef(readOnly)
  readOnlyRef.current = readOnly

  // Stable callback refs to avoid recreating the editor
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onH1ChangeRef = useRef(onH1Change)
  onH1ChangeRef.current = onH1Change

  // Ref for baseDir to use in the editor setup
  const baseDirRef = useRef(baseDir)
  baseDirRef.current = baseDir

  // Create image resolver plugin with baseDir
  const imageResolverPlugin = React.useMemo(
    () => createImageResolverPlugin(baseDir),
    [baseDir]
  )

  // Set up the editor
  useEditor((root) => {
    // Ensure we have at least an empty paragraph for the cursor to appear
    // Empty markdown content creates an empty doc with no editable nodes
    const initialContent = content || '\n'

    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, initialContent)

        // Set up change listener
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          // Only fire onChange if not read-only and content actually changed
          if (!readOnlyRef.current && markdown !== lastSetContent.current) {
            lastSetContent.current = markdown
            onChangeRef.current(markdown)

            // Check if H1 changed for Obsidian-like file renaming
            // Only fire after editor is ready to avoid initialization issues
            // Debounce to avoid firing while user is still typing
            if (isEditorReady.current && onH1ChangeRef.current) {
              const currentH1 = extractFirstH1(markdown)
              if (currentH1 !== null && currentH1 !== lastH1.current) {
                // Clear any pending H1 change callback
                if (h1DebounceTimer.current) {
                  clearTimeout(h1DebounceTimer.current)
                }
                // Store the new H1 value for the debounced callback
                const newH1Value = currentH1
                // Debounce H1 changes - wait 2 seconds after user stops typing
                h1DebounceTimer.current = setTimeout(() => {
                  // Check that the value is still different from the last saved H1
                  if (newH1Value !== lastH1.current && onH1ChangeRef.current) {
                    lastH1.current = newH1Value
                    onH1ChangeRef.current(newH1Value)
                  }
                }, 2000)
              }
            }
          }
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(listItemBlockComponent)
      .use(listener)
      .use(history)
      .use(clipboard)
      .use(cursor)
      .use(indent)
      .use(trailing)
      .use(imageResolverPlugin)
  }, [imageResolverPlugin]) // Recreate editor when baseDir changes

  // Get editor instance for dynamic updates
  const [loading, getInstance] = useInstance()

  // Update content when prop changes (but not on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const editor = getInstance()
    if (!loading && editor && content !== lastSetContent.current) {
      lastSetContent.current = content
      // Update lastH1 to match the new content's H1 (prevents false rename triggers when switching files)
      lastH1.current = extractFirstH1(content)
      // Clear any pending H1 rename debounce
      if (h1DebounceTimer.current) {
        clearTimeout(h1DebounceTimer.current)
        h1DebounceTimer.current = null
      }
      editor.action(replaceAll(content))
    }
  }, [content, loading, getInstance])

  // Update editable state when readOnly changes
  useEffect(() => {
    const editor = getInstance()
    if (!loading && editor) {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        // Update the editable prop on the ProseMirror view
        view.setProps({
          ...view.props,
          editable: () => !readOnly
        })
      })
    }
  }, [readOnly, loading, getInstance])

  // Auto-focus the editor when it's ready and not read-only
  useEffect(() => {
    const editor = getInstance()
    if (!loading && editor && !readOnly) {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        // Focus after a brief delay to ensure the DOM is ready
        requestAnimationFrame(() => {
          view.focus()
        })
      })
    }
  }, [loading, getInstance, readOnly])

  // Mark editor as ready after initialization (with a longer delay to ensure stability)
  // The editor needs time to fully initialize all contexts before we can safely call onH1Change
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        isEditorReady.current = true
      }, 500) // Increased from 100ms to 500ms for more stability
      return () => {
        clearTimeout(timer)
        isEditorReady.current = false
        // Also clean up any pending H1 debounce timer
        if (h1DebounceTimer.current) {
          clearTimeout(h1DebounceTimer.current)
          h1DebounceTimer.current = null
        }
      }
    }
    return undefined
  }, [loading])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      onSave()
    }
  }, [onSave])

  return (
    <div
      className="milkdown-editor-wrapper"
      data-readonly={readOnly}
      onKeyDown={handleKeyDown}
    >
      <FormattingToolbar readOnly={readOnly} />
      <div className="milkdown-editor-container">
        <Milkdown />
      </div>
    </div>
  )
}

/** WYSIWYG Markdown editor using Milkdown */
export class MilkdownEditor extends React.Component<IMilkdownEditorProps> {
  public render() {
    return (
      <MilkdownProvider>
        <MilkdownEditorCore {...this.props} />
      </MilkdownProvider>
    )
  }
}
