import * as React from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
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
  /** Called when cancel/escape is pressed */
  readonly onCancel: () => void
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
  const { content, onChange, onSave, onCancel, readOnly } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const contentRef = useRef(content)

  // Keep content ref updated
  contentRef.current = content

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      onSave()
    }
    // Escape to cancel
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }, [onSave, onCancel])

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // Add keyboard listener
    container.addEventListener('keydown', handleKeyDown)

    // Create editor
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container)
        ctx.set(defaultValueCtx, contentRef.current)

        // Set up change listener
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onChange(markdown)
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
  }, [handleKeyDown, onChange])

  return (
    <div
      ref={containerRef}
      className="milkdown-editor-container"
      data-readonly={readOnly}
    />
  )
}
