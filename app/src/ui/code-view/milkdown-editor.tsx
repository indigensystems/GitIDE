import * as React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { history } from '@milkdown/plugin-history'
import { clipboard } from '@milkdown/plugin-clipboard'
import { cursor } from '@milkdown/plugin-cursor'
import { indent } from '@milkdown/plugin-indent'
import { trailing } from '@milkdown/plugin-trailing'
import { listItemBlockComponent } from '@milkdown/components/list-item-block'

interface IMilkdownEditorProps {
  /** Initial markdown content */
  readonly content: string
  /** Called when content changes */
  readonly onChange: (content: string) => void
  /** Called when save is requested (Cmd/Ctrl+S) */
  readonly onSave: () => void
  /** Whether the editor should be read-only */
  readonly readOnly?: boolean
}

/** WYSIWYG Markdown editor using Milkdown */
export class MilkdownEditor extends React.Component<IMilkdownEditorProps> {
  public render() {
    return (
      <MilkdownEditorInner {...this.props} />
    )
  }
}

/** Inner functional component that uses hooks */
function MilkdownEditorInner(props: IMilkdownEditorProps) {
  const { content, onChange, onSave, readOnly } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const contentRef = useRef(content)
  const readOnlyRef = useRef(readOnly)

  // Keep refs updated
  contentRef.current = content
  readOnlyRef.current = readOnly

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl+S to save (only in edit mode)
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && !readOnlyRef.current) {
      e.preventDefault()
      onSave()
    }
  }, [onSave])

  // Recreate editor when readOnly changes
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // Clear previous content
    container.innerHTML = ''

    // Add keyboard listener
    container.addEventListener('keydown', handleKeyDown)

    // Create editor
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container)
        ctx.set(defaultValueCtx, contentRef.current)

        // Set editable based on readOnly prop
        ctx.set(editorViewOptionsCtx, {
          editable: () => !readOnly
        })

        // Set up change listener (only fires when editable)
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          if (!readOnlyRef.current) {
            onChange(markdown)
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
      .create()
      .then((editor) => {
        editorRef.current = editor
      })

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      editorRef.current?.destroy()
    }
  }, [handleKeyDown, onChange, readOnly])

  return (
    <div
      ref={containerRef}
      className="milkdown-editor-container"
      data-readonly={readOnly}
    />
  )
}
