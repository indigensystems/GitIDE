import * as React from 'react'
import { ITask } from '../../lib/databases/tasks-database'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import classNames from 'classnames'
import {
  IAPIIdentity,
  IAPILabel,
  IAPIMilestone,
  IAPIProjectV2,
} from '../../lib/api'

/** Comment from GitHub API */
export interface IIssueComment {
  readonly id: number
  readonly body: string
  readonly user: IAPIIdentity
  readonly createdAt: string
}

/** Project info for the issue detail panel */
export interface IProjectInfo {
  /** The project item ID (links issue to project) */
  readonly itemId: string
  /** The project ID */
  readonly projectId: string
  /** The project title */
  readonly projectTitle: string
  /** The status field ID */
  readonly statusFieldId: string
  /** Current status option ID */
  readonly currentStatusOptionId: string | null
  /** Current status name */
  readonly currentStatusName: string | null
  /** Available status options */
  readonly statusOptions: ReadonlyArray<{ id: string; name: string }>
}

/** Full issue details for display */
export interface IIssueDetails {
  readonly comments: ReadonlyArray<IIssueComment>
  readonly assignees: ReadonlyArray<IAPIIdentity>
  readonly availableAssignees: ReadonlyArray<IAPIIdentity>
  readonly availableLabels: ReadonlyArray<IAPILabel>
  readonly availableMilestones: ReadonlyArray<IAPIMilestone>
  readonly milestone: IAPIMilestone | null
  /** Project info (if issue is in a project) */
  readonly projectInfo: IProjectInfo | null
}

interface ITaskDetailPanelProps {
  /** The task to display details for */
  readonly task: ITask

  /** Whether this is the currently active task */
  readonly isActive: boolean

  /** Full issue details (loaded async) */
  readonly issueDetails: IIssueDetails | null

  /** Whether issue details are being loaded */
  readonly isLoadingDetails: boolean

  /** Called when the back button is clicked */
  readonly onBack: () => void

  /** Called when the pin button is clicked */
  readonly onPin: () => void

  /** Called when the start/stop button is clicked */
  readonly onActivate: () => void

  /** Called when the user wants to open the task in browser */
  readonly onOpenInBrowser: () => void

  /** Called when the user submits a new comment */
  readonly onAddComment: (body: string) => void

  /** Called when assignees are changed */
  readonly onUpdateAssignees: (assignees: ReadonlyArray<string>) => void

  /** Called when labels are changed */
  readonly onUpdateLabels: (labels: ReadonlyArray<string>) => void

  /** Called when milestone is changed */
  readonly onUpdateMilestone: (milestoneNumber: number | null) => void

  /** Called when issue state is changed */
  readonly onUpdateState: (state: 'open' | 'closed') => void

  /** Available GitHub Projects V2 */
  readonly projects: ReadonlyArray<IAPIProjectV2>

  /** Called when project status is changed */
  readonly onUpdateProjectStatus: (
    projectId: string,
    itemId: string,
    fieldId: string,
    optionId: string
  ) => void

  /** Called when issue is added to a project with a status */
  readonly onAddToProject: (
    projectId: string,
    statusFieldId: string,
    statusOptionId: string
  ) => void
}

interface ITaskDetailPanelState {
  readonly newComment: string
  readonly isSubmittingComment: boolean
  readonly showAssigneeDropdown: boolean
  readonly showLabelDropdown: boolean
  readonly showMilestoneDropdown: boolean
  readonly showProjectStatusDropdown: boolean
}

/** Detailed view of a single task/issue with GitHub-like layout */
export class TaskDetailPanel extends React.Component<
  ITaskDetailPanelProps,
  ITaskDetailPanelState
> {
  public constructor(props: ITaskDetailPanelProps) {
    super(props)
    this.state = {
      newComment: '',
      isSubmittingComment: false,
      showAssigneeDropdown: false,
      showLabelDropdown: false,
      showMilestoneDropdown: false,
      showProjectStatusDropdown: false,
    }
  }

  public render() {
    const { task, isActive } = this.props

    return (
      <div className="task-detail-panel">
        <header className="task-detail-header">
          <button
            className="back-button"
            onClick={this.props.onBack}
            title="Back to task list"
          >
            <Octicon symbol={octicons.arrowLeft} />
          </button>
          <div className="task-header-info">
            <span className="task-repo">{task.repositoryName}</span>
          </div>
          <div className="task-detail-actions">
            <button
              className={classNames('action-button', { active: task.isPinned })}
              onClick={this.props.onPin}
              title={task.isPinned ? 'Unpin' : 'Pin to top'}
            >
              <Octicon symbol={task.isPinned ? octicons.pinSlash : octicons.pin} />
            </button>
            <button
              className={classNames('action-button', { active: isActive })}
              onClick={this.props.onActivate}
              title={isActive ? 'Stop working' : 'Start working'}
            >
              <Octicon symbol={isActive ? octicons.square : octicons.play} />
            </button>
            <button
              className="action-button"
              onClick={this.props.onOpenInBrowser}
              title="Open in browser"
            >
              <Octicon symbol={octicons.linkExternal} />
            </button>
          </div>
        </header>

        <div className="task-detail-layout">
          <div className="task-detail-main">
            {this.renderMainContent()}
          </div>
          <div className="task-detail-sidebar">
            {this.renderSidebar()}
          </div>
        </div>
      </div>
    )
  }

  private renderMainContent() {
    const { task, issueDetails, isLoadingDetails } = this.props

    return (
      <>
        {/* Title and status */}
        <div className="task-title-section">
          <h1 className="task-detail-title">
            {task.title}
            <span className="task-number"> #{task.issueNumber}</span>
          </h1>
          <div className="task-status-row">
            <span className={classNames('task-state-badge', task.state.toLowerCase())}>
              <Octicon symbol={task.state === 'OPEN' ? octicons.issueOpened : octicons.issueClosed} />
              {task.state === 'OPEN' ? 'Open' : 'Closed'}
            </span>
            {task.authorLogin && (
              <span className="task-opened-by">
                <strong>{task.authorLogin}</strong> opened this issue{' '}
                {task.createdAt && this.formatDate(task.createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* Issue body */}
        <div className="task-body-section">
          <div className="comment-container first-comment">
            {task.authorAvatarUrl && (
              <img
                src={task.authorAvatarUrl}
                alt={task.authorLogin || ''}
                className="comment-avatar"
              />
            )}
            <div className="comment-content">
              <div className="comment-header">
                <span className="comment-author">{task.authorLogin}</span>
                <span className="comment-date">
                  commented {task.createdAt && this.formatDate(task.createdAt)}
                </span>
              </div>
              <div className="comment-body markdown-body">
                {task.body ? (
                  this.renderMarkdown(task.body)
                ) : (
                  <p className="no-description">No description provided.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Comments section */}
        <div className="task-comments-section">
          {isLoadingDetails && (
            <div className="loading-comments">
              <Octicon symbol={octicons.sync} className="spin" />
              Loading comments...
            </div>
          )}

          {issueDetails?.comments.map(comment => (
            <div key={comment.id} className="comment-container">
              <img
                src={comment.user.avatar_url}
                alt={comment.user.login}
                className="comment-avatar"
              />
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">{comment.user.login}</span>
                  <span className="comment-date">
                    commented {this.formatDate(comment.createdAt)}
                  </span>
                </div>
                <div className="comment-body markdown-body">
                  {this.renderMarkdown(comment.body)}
                </div>
              </div>
            </div>
          ))}

          {/* Add comment form */}
          <div className="add-comment-section">
            <div className="comment-form">
              <h3>Add a comment</h3>
              <textarea
                className="comment-textarea"
                placeholder="Leave a comment"
                value={this.state.newComment}
                onChange={this.onCommentChange}
                rows={4}
              />
              <div className="comment-form-actions">
                <button
                  className={classNames('close-issue-button', {
                    reopen: task.state !== 'OPEN',
                  })}
                  onClick={this.onToggleState}
                >
                  <Octicon
                    symbol={
                      task.state === 'OPEN'
                        ? octicons.issueClosed
                        : octicons.issueReopened
                    }
                  />
                  {task.state === 'OPEN' ? 'Close issue' : 'Reopen issue'}
                </button>
                <button
                  className="submit-comment-button"
                  onClick={this.onSubmitComment}
                  disabled={
                    !this.state.newComment.trim() ||
                    this.state.isSubmittingComment
                  }
                >
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  private renderSidebar() {
    const { task, issueDetails, projects } = this.props

    return (
      <>
        {/* Assignees */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Assignees</span>
            <button
              className="sidebar-edit-button"
              onClick={this.toggleAssigneeDropdown}
            >
              <Octicon symbol={octicons.gear} />
            </button>
          </div>
          <div className="sidebar-section-content">
            {this.state.showAssigneeDropdown && this.renderAssigneeDropdown()}
            {issueDetails?.assignees.length ? (
              issueDetails.assignees.map(assignee => (
                <div key={assignee.id} className="assignee-item">
                  <img
                    src={assignee.avatar_url}
                    alt={assignee.login}
                    className="assignee-avatar"
                  />
                  <span className="assignee-name">{assignee.login}</span>
                </div>
              ))
            ) : (
              <span className="no-value">No one assigned</span>
            )}
          </div>
        </div>

        {/* Labels */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Labels</span>
            <button
              className="sidebar-edit-button"
              onClick={this.toggleLabelDropdown}
            >
              <Octicon symbol={octicons.gear} />
            </button>
          </div>
          <div className="sidebar-section-content">
            {this.state.showLabelDropdown && this.renderLabelDropdown()}
            {task.labels.length ? (
              <div className="label-list">
                {task.labels.map(label => (
                  <span
                    key={label.name}
                    className="label-badge"
                    style={{ backgroundColor: `#${label.color}` }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="no-value">None yet</span>
            )}
          </div>
        </div>

        {/* Projects */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Projects</span>
            {projects.length > 0 && (
              <button
                className="sidebar-edit-button"
                onClick={this.toggleProjectStatusDropdown}
                title="Add to project"
              >
                <Octicon symbol={octicons.gear} />
              </button>
            )}
          </div>
          <div className="sidebar-section-content">
            {this.state.showProjectStatusDropdown &&
              this.renderProjectStatusDropdown()}
            {task.projectTitle ? (
              <div className="project-item-with-status">
                <div className="project-name-row">
                  <Octicon symbol={octicons.project} />
                  <span className="project-title">{task.projectTitle}</span>
                </div>
                {this.renderInlineStatusSelect()}
              </div>
            ) : (
              <span className="no-value">None yet</span>
            )}
          </div>
        </div>

        {/* Milestone */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span>Milestone</span>
            <button
              className="sidebar-edit-button"
              onClick={this.toggleMilestoneDropdown}
            >
              <Octicon symbol={octicons.gear} />
            </button>
          </div>
          <div className="sidebar-section-content">
            {this.state.showMilestoneDropdown && this.renderMilestoneDropdown()}
            {issueDetails?.milestone ? (
              <div className="milestone-item">
                <Octicon symbol={octicons.milestone} />
                <span className="milestone-title">
                  {issueDetails.milestone.title}
                </span>
              </div>
            ) : (
              <span className="no-value">No milestone</span>
            )}
          </div>
        </div>

        {/* Time tracking (local feature) */}
        {task.timeSpent > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span>Time Tracked</span>
            </div>
            <div className="sidebar-section-content">
              <span className="time-value">
                <Octicon symbol={octicons.clock} />
                {Math.floor(task.timeSpent / 60)}h {task.timeSpent % 60}m
              </span>
            </div>
          </div>
        )}

        {/* Personal notes (local feature) */}
        {task.notes && (
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span>Personal Notes</span>
            </div>
            <div className="sidebar-section-content">
              <div className="notes-content">{task.notes}</div>
            </div>
          </div>
        )}
      </>
    )
  }

  private renderAssigneeDropdown() {
    const { issueDetails } = this.props
    if (!issueDetails) return null

    const currentLogins = new Set(
      issueDetails.assignees.map(a => a.login)
    )

    return (
      <div className="dropdown-menu assignee-dropdown">
        <div className="dropdown-header">Assign up to 10 people</div>
        {issueDetails.availableAssignees.map(user => (
          <label key={user.id} className="dropdown-item">
            <input
              type="checkbox"
              checked={currentLogins.has(user.login)}
              onChange={() => this.onToggleAssignee(user.login)}
            />
            <img
              src={user.avatar_url}
              alt={user.login}
              className="dropdown-avatar"
            />
            <span>{user.login}</span>
          </label>
        ))}
      </div>
    )
  }

  private renderLabelDropdown() {
    const { task, issueDetails } = this.props
    if (!issueDetails) return null

    const currentLabels = new Set(task.labels.map(l => l.name))

    return (
      <div className="dropdown-menu label-dropdown">
        <div className="dropdown-header">Apply labels to this issue</div>
        {issueDetails.availableLabels.map(label => (
          <label key={label.name} className="dropdown-item">
            <input
              type="checkbox"
              checked={currentLabels.has(label.name)}
              onChange={() => this.onToggleLabel(label.name)}
            />
            <span
              className="label-color-dot"
              style={{ backgroundColor: `#${label.color}` }}
            />
            <span>{label.name}</span>
          </label>
        ))}
      </div>
    )
  }

  private renderMilestoneDropdown() {
    const { issueDetails } = this.props
    if (!issueDetails) return null

    return (
      <div className="dropdown-menu milestone-dropdown">
        <div className="dropdown-header">Set milestone</div>
        <label className="dropdown-item">
          <input
            type="radio"
            name="milestone"
            checked={issueDetails.milestone === null}
            onChange={() => this.props.onUpdateMilestone(null)}
          />
          <span>No milestone</span>
        </label>
        {issueDetails.availableMilestones.map(milestone => (
          <label key={milestone.id} className="dropdown-item">
            <input
              type="radio"
              name="milestone"
              checked={issueDetails.milestone?.id === milestone.id}
              onChange={() => this.props.onUpdateMilestone(milestone.number)}
            />
            <span>{milestone.title}</span>
          </label>
        ))}
      </div>
    )
  }

  private renderProjectStatusDropdown() {
    const { task, projects, issueDetails } = this.props

    // If no projects available at all
    if (projects.length === 0) {
      return (
        <div className="dropdown-menu project-status-dropdown">
          <div className="dropdown-header">Projects</div>
          <div className="dropdown-item loading">No projects available</div>
        </div>
      )
    }

    // Find the project that matches this task's projectTitle (if any)
    const currentProject = task.projectTitle
      ? projects.find(p => p.title === task.projectTitle)
      : null

    const currentStatusName = issueDetails?.projectInfo?.currentStatusName || task.projectStatus

    // Other projects (ones this task is not in)
    const otherProjects = currentProject
      ? projects.filter(p => p.id !== currentProject.id)
      : projects

    // If task is in a project, show current project with status options
    if (currentProject) {
      const statusField = currentProject.fields.find(
        f => f.name === 'Status' && f.dataType === 'SINGLE_SELECT'
      )

      return (
        <div className="dropdown-menu project-status-dropdown">
          {/* Current project section */}
          <div className="dropdown-section">
            <div className="dropdown-header">
              <Octicon symbol={octicons.project} />
              <span className="current-project-name">{currentProject.title}</span>
            </div>
            {statusField?.options ? (
              statusField.options.map(option => (
                <label key={option.id} className="dropdown-item">
                  <input
                    type="radio"
                    name="project-status"
                    checked={option.name === currentStatusName}
                    onChange={() => this.onSelectProjectStatusFromField(
                      currentProject.id,
                      statusField.id,
                      option.id
                    )}
                  />
                  {option.color && (
                    <span
                      className="status-color-dot"
                      style={{ backgroundColor: this.getStatusColor(option.color) }}
                    />
                  )}
                  <span>{option.name}</span>
                </label>
              ))
            ) : (
              <div className="dropdown-item disabled">No status options</div>
            )}
          </div>

          {/* Other projects section - allow adding to additional projects */}
          {otherProjects.length > 0 && (
            <div className="dropdown-section">
              <div className="dropdown-header">Add to another project</div>
              {otherProjects.map(project => {
                const projectStatusField = project.fields.find(
                  f => f.name === 'Status' && f.dataType === 'SINGLE_SELECT'
                )
                return (
                  <div key={project.id} className="dropdown-item project-option">
                    <span className="project-name">{project.title}</span>
                    {projectStatusField?.options && (
                      <select
                        className="status-select"
                        onChange={(e) => this.onAddToProjectWithStatus(
                          project.id,
                          projectStatusField.id,
                          e.target.value
                        )}
                        defaultValue=""
                      >
                        <option value="" disabled>Select status...</option>
                        {projectStatusField.options.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    // Task is not in a project - show list of projects to add to
    return (
      <div className="dropdown-menu project-status-dropdown">
        <div className="dropdown-header">Add to project</div>
        {projects.map(project => {
          const statusField = project.fields.find(
            f => f.name === 'Status' && f.dataType === 'SINGLE_SELECT'
          )
          return (
            <div key={project.id} className="dropdown-item project-option">
              <span className="project-name">{project.title}</span>
              {statusField?.options && (
                <select
                  className="status-select"
                  onChange={(e) => this.onAddToProjectWithStatus(
                    project.id,
                    statusField.id,
                    e.target.value
                  )}
                  defaultValue=""
                >
                  <option value="" disabled>Select status...</option>
                  {statusField.options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  private renderInlineStatusSelect() {
    const { task, projects, issueDetails } = this.props

    // Find the current project
    const currentProject = task.projectTitle
      ? projects.find(p => p.title === task.projectTitle)
      : null

    if (!currentProject) {
      // Fallback: just show the status as text if we can't find the project
      return task.projectStatus ? (
        <span className="project-status-badge">{task.projectStatus}</span>
      ) : null
    }

    // Find the status field in the project
    const statusField = currentProject.fields.find(
      f => f.name === 'Status' && f.dataType === 'SINGLE_SELECT'
    )

    if (!statusField?.options) {
      return task.projectStatus ? (
        <span className="project-status-badge">{task.projectStatus}</span>
      ) : null
    }

    const currentStatusName =
      issueDetails?.projectInfo?.currentStatusName || task.projectStatus

    // Find the current option to get its ID for the select value
    const currentOption = statusField.options.find(
      opt => opt.name === currentStatusName
    )

    return (
      <select
        className="inline-status-select"
        value={currentOption?.id ?? ''}
        onChange={e => {
          if (e.target.value) {
            this.onSelectProjectStatusFromField(
              currentProject.id,
              statusField.id,
              e.target.value
            )
          }
        }}
      >
        {!currentOption && (
          <option value="" disabled>
            Select status...
          </option>
        )}
        {statusField.options.map(option => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    )
  }

  private onCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    this.setState({ newComment: e.target.value })
  }

  private onSubmitComment = async () => {
    const { newComment } = this.state
    if (!newComment.trim()) return

    this.setState({ isSubmittingComment: true })
    this.props.onAddComment(newComment)
    this.setState({ newComment: '', isSubmittingComment: false })
  }

  private onToggleState = () => {
    const { task } = this.props
    const newState = task.state === 'OPEN' ? 'closed' : 'open'
    this.props.onUpdateState(newState)
  }

  private toggleAssigneeDropdown = () => {
    this.setState(prev => ({
      showAssigneeDropdown: !prev.showAssigneeDropdown,
      showLabelDropdown: false,
      showMilestoneDropdown: false,
      showProjectStatusDropdown: false,
    }))
  }

  private toggleLabelDropdown = () => {
    this.setState(prev => ({
      showLabelDropdown: !prev.showLabelDropdown,
      showAssigneeDropdown: false,
      showMilestoneDropdown: false,
      showProjectStatusDropdown: false,
    }))
  }

  private toggleMilestoneDropdown = () => {
    this.setState(prev => ({
      showMilestoneDropdown: !prev.showMilestoneDropdown,
      showAssigneeDropdown: false,
      showLabelDropdown: false,
      showProjectStatusDropdown: false,
    }))
  }

  private toggleProjectStatusDropdown = () => {
    this.setState(prev => ({
      showProjectStatusDropdown: !prev.showProjectStatusDropdown,
      showAssigneeDropdown: false,
      showLabelDropdown: false,
      showMilestoneDropdown: false,
    }))
  }

  private onSelectProjectStatusFromField = (
    projectId: string,
    fieldId: string,
    optionId: string
  ) => {
    const { issueDetails } = this.props
    const projectInfo = issueDetails?.projectInfo

    // We need the itemId from projectInfo (the link between issue and project)
    if (!projectInfo?.itemId) {
      console.error('Cannot update status: missing project item ID')
      return
    }

    this.props.onUpdateProjectStatus(
      projectId,
      projectInfo.itemId,
      fieldId,
      optionId
    )
    this.setState({ showProjectStatusDropdown: false })
  }

  private onAddToProjectWithStatus = (
    projectId: string,
    statusFieldId: string,
    statusOptionId: string
  ) => {
    if (!statusOptionId) return // User didn't select a status
    this.props.onAddToProject(projectId, statusFieldId, statusOptionId)
    this.setState({ showProjectStatusDropdown: false })
  }

  private getStatusColor(color: string): string {
    // GitHub Projects V2 uses color names, map them to CSS colors
    const colorMap: Record<string, string> = {
      GRAY: '#8b949e',
      RED: '#f85149',
      ORANGE: '#db6d28',
      YELLOW: '#d29922',
      GREEN: '#3fb950',
      BLUE: '#58a6ff',
      PURPLE: '#a371f7',
      PINK: '#db61a2',
    }
    return colorMap[color.toUpperCase()] || '#8b949e'
  }

  private onToggleAssignee = (login: string) => {
    const { issueDetails } = this.props
    if (!issueDetails) return

    const currentLogins = issueDetails.assignees.map(a => a.login)
    const isAssigned = currentLogins.includes(login)

    const newAssignees = isAssigned
      ? currentLogins.filter(l => l !== login)
      : [...currentLogins, login]

    this.props.onUpdateAssignees(newAssignees)
  }

  private onToggleLabel = (labelName: string) => {
    const { task } = this.props
    const currentLabels = task.labels.map(l => l.name)
    const hasLabel = currentLabels.includes(labelName)

    const newLabels = hasLabel
      ? currentLabels.filter(l => l !== labelName)
      : [...currentLabels, labelName]

    this.props.onUpdateLabels(newLabels)
  }

  private formatDate(isoString: string): string {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'today'
    } else if (diffDays === 1) {
      return 'yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30)
      return `${months} month${months > 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  private renderMarkdown(text: string): React.ReactNode {
    const paragraphs = text.split(/\n\n+/)

    return paragraphs.map((paragraph, index) => {
      if (paragraph.startsWith('```')) {
        const lines = paragraph.split('\n')
        const lang = lines[0].slice(3)
        const code = lines.slice(1, -1).join('\n')
        return (
          <pre key={index} className={`language-${lang}`}>
            <code>{code}</code>
          </pre>
        )
      }

      if (paragraph.startsWith('# ')) {
        return <h1 key={index}>{paragraph.slice(2)}</h1>
      }
      if (paragraph.startsWith('## ')) {
        return <h2 key={index}>{paragraph.slice(3)}</h2>
      }
      if (paragraph.startsWith('### ')) {
        return <h3 key={index}>{paragraph.slice(4)}</h3>
      }

      if (paragraph.match(/^[-*]\s/m)) {
        const items = paragraph.split(/\n/).filter(line => line.match(/^[-*]\s/))
        return (
          <ul key={index}>
            {items.map((item, i) => (
              <li key={i}>{item.replace(/^[-*]\s/, '')}</li>
            ))}
          </ul>
        )
      }

      const formatted = this.formatInline(paragraph)
      return <p key={index}>{formatted}</p>
    })
  }

  private formatInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    const codeRegex = /`([^`]+)`/g
    let match

    while ((match = codeRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      parts.push(<code key={match.index}>{match[1]}</code>)
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }
}
