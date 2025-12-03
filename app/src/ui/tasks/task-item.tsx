import * as React from 'react'
import classNames from 'classnames'
import { ITask } from '../../lib/databases/tasks-database'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface ITaskItemProps {
  /** The task to display */
  readonly task: ITask

  /** Whether this is the currently active task */
  readonly isActive: boolean

  /** Called when the task is clicked */
  readonly onClick: () => void

  /** Called when the pin button is clicked */
  readonly onPin: () => void

  /** Called when the start/stop button is clicked */
  readonly onActivate: () => void

  /** Called when the user wants to open the task in browser */
  readonly onOpenInBrowser: () => void
}

/** A single task item in the task list */
export class TaskItem extends React.Component<ITaskItemProps> {
  public render() {
    const { task, isActive } = this.props

    const className = classNames('task-item', {
      active: isActive,
      pinned: task.isPinned,
    })

    return (
      <div className={className} onClick={this.props.onClick}>
        <div className="task-item-header">
          <span className="task-number">#{task.issueNumber}</span>
          <span className="task-repo">{task.repositoryName}</span>
          {task.isPinned && (
            <Octicon symbol={octicons.pin} className="pin-indicator" />
          )}
        </div>

        <div className="task-item-title">{task.title}</div>

        <div className="task-item-meta">
          {task.projectStatus && (
            <span className="project-status" title={task.projectTitle ?? undefined}>
              {task.projectStatus}
            </span>
          )}
          {task.labels.slice(0, 3).map(label => (
            <span
              key={label.name}
              className="label"
              style={{ backgroundColor: `#${label.color}` }}
            >
              {label.name}
            </span>
          ))}
        </div>

        <div className="task-item-actions">
          <button
            className="task-action-button"
            onClick={this.onPinClick}
            title={task.isPinned ? 'Unpin' : 'Pin to top'}
          >
            <Octicon symbol={task.isPinned ? octicons.pinSlash : octicons.pin} />
          </button>
          <button
            className="task-action-button"
            onClick={this.onActivateClick}
            title={isActive ? 'Stop working' : 'Start working'}
          >
            <Octicon symbol={isActive ? octicons.square : octicons.play} />
          </button>
          <button
            className="task-action-button"
            onClick={this.onOpenInBrowserClick}
            title="Open in browser"
          >
            <Octicon symbol={octicons.linkExternal} />
          </button>
        </div>

        {task.notes && (
          <div className="task-notes">
            <em>{task.notes}</em>
          </div>
        )}

        {task.timeSpent > 0 && (
          <div className="time-spent">
            <Octicon symbol={octicons.clock} />
            <span>
              {Math.floor(task.timeSpent / 60)}h {task.timeSpent % 60}m
            </span>
          </div>
        )}
      </div>
    )
  }

  private onPinClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    this.props.onPin()
  }

  private onActivateClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    this.props.onActivate()
  }

  private onOpenInBrowserClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    this.props.onOpenInBrowser()
  }
}
