import * as React from 'react'
import { ITask } from '../../lib/databases/tasks-database'
import { DraggableTaskItem } from './draggable-task-item'
import { TaskSortOrder, TaskViewMode } from '../../lib/stores/tasks-store'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import classNames from 'classnames'

interface ITaskListPanelProps {
  /** All tasks to display */
  readonly tasks: ReadonlyArray<ITask>

  /** The currently active task (if any) */
  readonly activeTask: ITask | null

  /** Current view mode */
  readonly viewMode: TaskViewMode

  /** Current sort order */
  readonly sortOrder: TaskSortOrder

  /** Whether tasks are currently loading from the API */
  readonly isLoading: boolean

  /** Whether the add task button should be enabled */
  readonly canCreateTasks: boolean

  /** Called when a task is clicked */
  readonly onTaskClick: (task: ITask) => void

  /** Called when a task's pin status should be toggled */
  readonly onTaskPin: (task: ITask) => void

  /** Called when a task should be activated/deactivated */
  readonly onTaskActivate: (task: ITask) => void

  /** Called when view mode changes */
  readonly onViewModeChange: (mode: TaskViewMode) => void

  /** Called when sort order changes */
  readonly onSortChange: (order: TaskSortOrder) => void

  /** Called when the refresh button is clicked */
  readonly onRefresh: () => void

  /** Called when a task should be opened in the browser */
  readonly onOpenInBrowser: (task: ITask) => void

  /** Called when the add task button is clicked */
  readonly onAddTask: () => void

  /** Called when tasks are reordered via drag-and-drop */
  readonly onTaskReorder: (sourceTask: ITask, targetIndex: number) => void
}

/** Panel displaying the user's assigned tasks */
export class TaskListPanel extends React.Component<ITaskListPanelProps> {
  public render() {
    const { tasks, activeTask, viewMode, sortOrder, isLoading } = this.props

    return (
      <div className="task-list-panel" data-sort={sortOrder}>
        <header className="task-list-header">
          <h2>My Tasks</h2>
          <div className="task-list-controls">
            {this.renderViewTabs()}
            {this.renderSortDropdown()}
            <button
              className="task-refresh-button"
              onClick={this.props.onRefresh}
              disabled={isLoading}
              title="Refresh tasks"
            >
              <Octicon
                symbol={octicons.sync}
                className={classNames({ spinning: isLoading })}
              />
            </button>
            <button
              className="add-task-button"
              onClick={this.props.onAddTask}
              disabled={!this.props.canCreateTasks}
              title="Create new task"
            >
              <Octicon symbol={octicons.plus} />
            </button>
          </div>
        </header>

        {activeTask && (
          <div className="active-task-banner">
            <Octicon symbol={octicons.play} />
            <span className="active-task-label">Working on:</span>
            <strong>#{activeTask.issueNumber}</strong>
            <span className="active-task-title">{activeTask.title}</span>
          </div>
        )}

        <div className="task-list">
          {tasks.length === 0 ? (
            this.renderEmptyState(viewMode, isLoading)
          ) : (
            this.renderTaskList()
          )}
        </div>
      </div>
    )
  }

  private renderTaskList() {
    const { tasks, activeTask, sortOrder } = this.props
    const isDragEnabled = sortOrder === 'custom'

    return tasks.map((task, index) => (
      <DraggableTaskItem
        key={task.id}
        task={task}
        index={index}
        isActive={activeTask?.id === task.id}
        isDragEnabled={isDragEnabled}
        onClick={() => this.props.onTaskClick(task)}
        onPin={() => this.props.onTaskPin(task)}
        onActivate={() => this.props.onTaskActivate(task)}
        onOpenInBrowser={() => this.props.onOpenInBrowser(task)}
        onDrop={this.props.onTaskReorder}
      />
    ))
  }

  private renderEmptyState(viewMode: TaskViewMode, isLoading: boolean) {
    if (isLoading) {
      return (
        <div className="task-list-empty-state">
          <Octicon symbol={octicons.sync} className="spinning" />
          <p>Loading tasks...</p>
        </div>
      )
    }

    let message = 'No tasks found'
    let hint: string | null = null

    switch (viewMode) {
      case 'pinned':
        hint = 'Pin tasks to see them here'
        break
      case 'active':
        hint = 'Start working on a task to see it here'
        break
      case 'repo':
        hint = 'No tasks assigned to you in this repository'
        break
    }

    return (
      <div className="task-list-empty-state">
        <Octicon symbol={octicons.tasklist} />
        <p>{message}</p>
        {hint && <p className="hint">{hint}</p>}
      </div>
    )
  }

  private renderViewTabs() {
    const { viewMode, onViewModeChange } = this.props
    const modes: Array<{ mode: TaskViewMode; label: string; icon: typeof octicons.rows }> = [
      { mode: 'all', label: 'All', icon: octicons.rows },
      { mode: 'repo', label: 'Repo', icon: octicons.repo },
      { mode: 'pinned', label: 'Pinned', icon: octicons.pin },
      { mode: 'active', label: 'Active', icon: octicons.play },
    ]

    return (
      <div className="task-view-tabs">
        {modes.map(({ mode, label, icon }) => (
          <button
            key={mode}
            className={classNames('task-view-tab', { active: viewMode === mode })}
            onClick={() => onViewModeChange(mode)}
            title={label}
          >
            <Octicon symbol={icon} />
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </div>
    )
  }

  private renderSortDropdown() {
    const { sortOrder, onSortChange } = this.props

    return (
      <select
        value={sortOrder}
        onChange={e => onSortChange(e.target.value as TaskSortOrder)}
        className="task-sort-dropdown"
        title="Sort tasks"
      >
        <option value="priority">Priority</option>
        <option value="updated">Recently Updated</option>
        <option value="repository">Repository</option>
        <option value="custom">Custom Order</option>
      </select>
    )
  }
}
