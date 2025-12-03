import {
  TasksDatabase,
  ITask,
  ITaskLabel,
} from '../databases/tasks-database'
import { Account } from '../../models/account'
import { GitHubRepository } from '../../models/github-repository'
import { Emitter, Disposable } from 'event-kit'
import {
  API,
  IAPIIssueWithMetadata,
  IAPIIdentity,
  IAPILabel,
  IAPIMilestone,
  IAPIProjectV2,
  IAPIProjectItem,
} from '../api'
import {
  GHDesktopMetadataService,
  ITaskList,
  ITimeEntry,
} from '../ghdesktop-metadata'

/** How tasks are sorted in the list */
export type TaskSortOrder = 'priority' | 'updated' | 'custom' | 'repository'

/** Which tasks to show */
export type TaskViewMode = 'all' | 'repo' | 'active' | 'pinned'

/** The current state of the tasks store */
export interface ITasksState {
  /** All tasks matching the current view mode */
  readonly tasks: ReadonlyArray<ITask>

  /** The currently active task (if any) */
  readonly activeTask: ITask | null

  /** Current sort order */
  readonly sortOrder: TaskSortOrder

  /** Current view mode */
  readonly viewMode: TaskViewMode

  /** Whether we're currently loading from the API */
  readonly isLoading: boolean

  /** When we last refreshed from the API */
  readonly lastRefresh: Date | null

  /** Collaborators for the current repository */
  readonly collaborators: ReadonlyArray<IAPIIdentity>

  /** Labels for the current repository */
  readonly labels: ReadonlyArray<IAPILabel>

  /** Milestones for the current repository */
  readonly milestones: ReadonlyArray<IAPIMilestone>

  /** Custom task lists from .ghdesktop metadata */
  readonly taskLists: ReadonlyArray<ITaskList>

  /** Time entries from .ghdesktop metadata */
  readonly timeEntries: ReadonlyArray<ITimeEntry>

  /** GitHub Projects V2 linked to the repository */
  readonly projects: ReadonlyArray<IAPIProjectV2>
}

export { ITaskList, ITimeEntry }
export type { IAPIProjectV2 }

/**
 * The store for managing tasks (GitHub issues assigned to the user).
 * Tasks are synced from GitHub but can have local-only metadata like
 * pinned status, notes, and time tracking.
 */
export class TasksStore {
  private db: TasksDatabase
  private emitter = new Emitter()
  private metadataService: GHDesktopMetadataService | null = null
  private state: ITasksState = {
    tasks: [],
    activeTask: null,
    sortOrder: 'priority',
    viewMode: 'all',
    isLoading: false,
    lastRefresh: null,
    collaborators: [],
    labels: [],
    milestones: [],
    taskLists: [],
    timeEntries: [],
    projects: [],
  }

  public constructor(db: TasksDatabase) {
    this.db = db
  }

  /**
   * Set the repository path for .ghdesktop metadata operations.
   */
  public setRepositoryPath(path: string): void {
    this.metadataService = new GHDesktopMetadataService(path)
  }

  private emitUpdate() {
    this.emitter.emit('did-update', this.state)
  }

  /** Subscribe to state changes */
  public onDidUpdate(fn: (state: ITasksState) => void): Disposable {
    return this.emitter.on('did-update', fn)
  }

  /** Get the current state */
  public getState(): ITasksState {
    return this.state
  }

  /**
   * Refresh tasks from GitHub API for issues assigned to the user.
   * If a repository is provided, only fetches tasks for that repo.
   */
  public async refreshTasks(
    account: Account,
    repository?: GitHubRepository
  ): Promise<void> {
    this.state = { ...this.state, isLoading: true }
    this.emitUpdate()

    const api = API.fromAccount(account)

    try {
      let apiIssues: ReadonlyArray<IAPIIssueWithMetadata> = []

      if (repository) {
        // Fetch issues for specific repo assigned to user
        apiIssues = await api.fetchAssignedIssues(
          repository.owner.login,
          repository.name,
          account.login
        )
        await this.syncTasks(api, apiIssues, repository)
      }

      this.state = {
        ...this.state,
        isLoading: false,
        lastRefresh: new Date(),
      }
      await this.loadTasks()
    } catch (error) {
      this.state = { ...this.state, isLoading: false }
      this.emitUpdate()
      throw error
    }
  }

  /**
   * Sync API issues with local database, preserving local-only fields.
   */
  private async syncTasks(
    api: API,
    apiIssues: ReadonlyArray<IAPIIssueWithMetadata>,
    repository: GitHubRepository
  ): Promise<void> {
    // Fetch project items for all issues in parallel
    const projectItemsMap = new Map<number, ReadonlyArray<IAPIProjectItem>>()
    await Promise.all(
      apiIssues.map(async issue => {
        const projectItems = await api.fetchIssueProjectItems(
          repository.owner.login,
          repository.name,
          issue.number
        )
        projectItemsMap.set(issue.number, projectItems)
      })
    )

    await this.db.transaction('rw', this.db.tasks, async () => {
      for (const apiIssue of apiIssues) {
        const issueId = `${repository.dbID}-${apiIssue.number}`
        const existing = await this.db.getTaskByIssueId(issueId)

        const labels: ITaskLabel[] = (apiIssue.labels ?? []).map(label => ({
          name: typeof label === 'string' ? label : label.name,
          color: typeof label === 'string' ? '888888' : label.color,
        }))

        // Extract project status from project items
        const projectItems = projectItemsMap.get(apiIssue.number) ?? []
        let projectStatus: string | null = null
        let projectTitle: string | null = null

        if (projectItems.length > 0) {
          // Use the first project item's status
          const firstItem = projectItems[0]
          projectTitle = firstItem.project.title

          // Find the Status field value
          for (const fieldValue of firstItem.fieldValues) {
            if (fieldValue.field?.name === 'Status' && fieldValue.name) {
              projectStatus = fieldValue.name
              break
            }
          }
        }

        const taskData: Partial<ITask> = {
          issueId,
          issueNumber: apiIssue.number,
          title: apiIssue.title,
          repositoryId: repository.dbID,
          repositoryName: `${repository.owner.login}/${repository.name}`,
          url: apiIssue.html_url,
          state: apiIssue.state === 'open' ? 'OPEN' : 'CLOSED',
          labels,
          projectStatus,
          projectTitle,
          updated_at: new Date().toISOString(),
        }

        if (existing) {
          // Preserve local-only fields when updating
          await this.db.tasks.update(existing.id!, taskData)
        } else {
          // New task with default local fields
          await this.db.tasks.add({
            ...taskData,
            isPinned: false,
            localOrder: 0,
            isActive: false,
            notes: null,
            timeSpent: 0,
            lastWorkedOn: null,
          } as ITask)
        }
      }

      // Remove tasks that are no longer assigned or are closed
      const repoTasks = await this.db.getTasksForRepository(repository.dbID)
      const currentIssueNumbers = new Set(apiIssues.map(i => i.number))

      for (const task of repoTasks) {
        if (!currentIssueNumbers.has(task.issueNumber)) {
          await this.db.tasks.delete(task.id!)
        }
      }
    })
  }

  /**
   * Load tasks from local database based on current view mode.
   */
  public async loadTasks(viewMode?: TaskViewMode): Promise<void> {
    const mode = viewMode ?? this.state.viewMode
    let tasks: ITask[]

    switch (mode) {
      case 'pinned':
        tasks = await this.db.getPinnedTasks()
        break
      case 'active':
        tasks = await this.db.getActiveTasks()
        break
      default:
        tasks = await this.db.getAllTasks()
    }

    // Filter to only open tasks
    tasks = tasks.filter(t => t.state === 'OPEN')

    // Apply sorting
    tasks = this.sortTasks(tasks)

    // Find active task
    const activeTask = tasks.find(t => t.isActive) ?? null

    this.state = { ...this.state, tasks, viewMode: mode, activeTask }
    this.emitUpdate()
  }

  /**
   * Load tasks for a specific repository.
   */
  public async loadTasksForRepository(repositoryId: number): Promise<void> {
    let tasks = await this.db.getTasksForRepository(repositoryId)
    tasks = tasks.filter(t => t.state === 'OPEN')
    tasks = this.sortTasks(tasks)

    const activeTask = tasks.find(t => t.isActive) ?? null

    this.state = {
      ...this.state,
      tasks,
      viewMode: 'repo',
      activeTask,
    }
    this.emitUpdate()
  }

  private sortTasks(tasks: ITask[]): ITask[] {
    const sorted = [...tasks]

    switch (this.state.sortOrder) {
      case 'priority':
        // Pinned first, then active, then by update time
        return sorted.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )
        })
      case 'custom':
        return sorted.sort((a, b) => a.localOrder - b.localOrder)
      case 'repository':
        return sorted.sort((a, b) =>
          a.repositoryName.localeCompare(b.repositoryName)
        )
      case 'updated':
      default:
        return sorted.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
    }
  }

  // === Local-only operations ===

  /** Pin or unpin a task */
  public async pinTask(taskId: number, pinned: boolean): Promise<void> {
    await this.db.tasks.update(taskId, { isPinned: pinned })
    await this.loadTasks()
  }

  /** Set a task as the active task (only one can be active at a time) */
  public async setActiveTask(taskId: number | null): Promise<void> {
    // Deactivate current active task
    const currentActive = this.state.activeTask
    if (currentActive?.id) {
      await this.db.tasks.update(currentActive.id, { isActive: false })
    }

    // Activate new task
    if (taskId) {
      await this.db.tasks.update(taskId, {
        isActive: true,
        lastWorkedOn: new Date().toISOString(),
      })
    }

    await this.loadTasks()
  }

  /** Update personal notes for a task */
  public async updateTaskNotes(taskId: number, notes: string): Promise<void> {
    await this.db.tasks.update(taskId, { notes: notes || null })
    await this.loadTasks()
  }

  /** Add time spent on a task (in minutes) */
  public async addTimeSpent(taskId: number, minutes: number): Promise<void> {
    const task = await this.db.tasks.get(taskId)
    if (task) {
      await this.db.tasks.update(taskId, {
        timeSpent: task.timeSpent + minutes,
        lastWorkedOn: new Date().toISOString(),
      })
      await this.loadTasks()
    }
  }

  /** Reorder a task (for custom sorting) */
  public async reorderTask(taskId: number, newOrder: number): Promise<void> {
    await this.db.tasks.update(taskId, { localOrder: newOrder })
    this.state = { ...this.state, sortOrder: 'custom' }
    await this.loadTasks()
  }

  /** Change the sort order */
  public async setSortOrder(order: TaskSortOrder): Promise<void> {
    this.state = { ...this.state, sortOrder: order }
    await this.loadTasks()
  }

  /** Change the view mode */
  public async setViewMode(mode: TaskViewMode): Promise<void> {
    await this.loadTasks(mode)
  }

  /** Set collaborators for the current repository */
  public setCollaborators(collaborators: ReadonlyArray<IAPIIdentity>): void {
    this.state = { ...this.state, collaborators }
    this.emitUpdate()
  }

  /** Set labels for the current repository */
  public setLabels(labels: ReadonlyArray<IAPILabel>): void {
    this.state = { ...this.state, labels }
    this.emitUpdate()
  }

  /** Set milestones for the current repository */
  public setMilestones(milestones: ReadonlyArray<IAPIMilestone>): void {
    this.state = { ...this.state, milestones }
    this.emitUpdate()
  }

  /** Set GitHub Projects V2 for the current repository */
  public setProjects(projects: ReadonlyArray<IAPIProjectV2>): void {
    this.state = { ...this.state, projects }
    this.emitUpdate()
  }

  // === .ghdesktop metadata operations ===

  /**
   * Initialize and load .ghdesktop metadata for the current repository.
   */
  public async loadMetadata(): Promise<void> {
    if (!this.metadataService) {
      return
    }

    try {
      const [taskLists, timeEntries, config] = await Promise.all([
        this.metadataService.loadTaskLists(),
        this.metadataService.loadTimeEntries(),
        this.metadataService.loadConfig(),
      ])

      this.state = {
        ...this.state,
        taskLists,
        timeEntries,
        sortOrder: config.sortOrder ?? this.state.sortOrder,
        viewMode: config.viewMode ?? this.state.viewMode,
      }

      // Apply pinned tasks from config
      if (config.pinnedTasks?.length) {
        await this.db.transaction('rw', this.db.tasks, async () => {
          const allTasks = await this.db.getAllTasks()
          for (const task of allTasks) {
            const shouldBePinned = config.pinnedTasks!.includes(task.issueNumber)
            if (task.isPinned !== shouldBePinned) {
              await this.db.tasks.update(task.id!, { isPinned: shouldBePinned })
            }
          }
        })
      }

      // Apply custom order from config
      if (config.customTaskOrder?.length) {
        await this.db.transaction('rw', this.db.tasks, async () => {
          for (let i = 0; i < config.customTaskOrder!.length; i++) {
            const issueNumber = config.customTaskOrder![i]
            const task = await this.db.tasks.where('issueNumber').equals(issueNumber).first()
            if (task) {
              await this.db.tasks.update(task.id!, { localOrder: i })
            }
          }
        })
      }

      await this.loadTasks()
    } catch (error) {
      log.warn('Failed to load .ghdesktop metadata', error)
    }
  }

  /**
   * Save current configuration to .ghdesktop.
   */
  public async saveMetadata(): Promise<void> {
    if (!this.metadataService) {
      return
    }

    try {
      const tasks = await this.db.getAllTasks()
      const pinnedTasks = tasks.filter(t => t.isPinned).map(t => t.issueNumber)
      const customTaskOrder = this.state.sortOrder === 'custom'
        ? [...tasks].sort((a, b) => a.localOrder - b.localOrder).map(t => t.issueNumber)
        : undefined

      await this.metadataService.saveConfig({
        sortOrder: this.state.sortOrder,
        viewMode: this.state.viewMode,
        pinnedTasks,
        customTaskOrder,
      })
    } catch (error) {
      log.warn('Failed to save .ghdesktop metadata', error)
    }
  }

  /**
   * Create a new task list.
   */
  public async createTaskList(name: string, description?: string): Promise<void> {
    if (!this.metadataService) {
      return
    }

    const newList: ITaskList = { name, description, issueNumbers: [] }
    const taskLists = [...this.state.taskLists, newList]
    await this.metadataService.saveTaskLists(taskLists)
    this.state = { ...this.state, taskLists }
    this.emitUpdate()
  }

  /**
   * Add a task to a task list.
   */
  public async addTaskToList(listName: string, issueNumber: number): Promise<void> {
    if (!this.metadataService) {
      return
    }

    const taskLists = this.state.taskLists.map(list => {
      if (list.name === listName && !list.issueNumbers.includes(issueNumber)) {
        return { ...list, issueNumbers: [...list.issueNumbers, issueNumber] }
      }
      return list
    })

    await this.metadataService.saveTaskLists(taskLists)
    this.state = { ...this.state, taskLists }
    this.emitUpdate()
  }

  /**
   * Remove a task from a task list.
   */
  public async removeTaskFromList(listName: string, issueNumber: number): Promise<void> {
    if (!this.metadataService) {
      return
    }

    const taskLists = this.state.taskLists.map(list => {
      if (list.name === listName) {
        return {
          ...list,
          issueNumbers: list.issueNumbers.filter(n => n !== issueNumber),
        }
      }
      return list
    })

    await this.metadataService.saveTaskLists(taskLists)
    this.state = { ...this.state, taskLists }
    this.emitUpdate()
  }

  /**
   * Delete a task list.
   */
  public async deleteTaskList(listName: string): Promise<void> {
    if (!this.metadataService) {
      return
    }

    const taskLists = this.state.taskLists.filter(list => list.name !== listName)
    await this.metadataService.saveTaskLists(taskLists)
    this.state = { ...this.state, taskLists }
    this.emitUpdate()
  }

  /**
   * Log time spent on a task.
   */
  public async logTime(
    issueNumber: number,
    minutes: number,
    note?: string
  ): Promise<void> {
    if (!this.metadataService) {
      return
    }

    const entry: ITimeEntry = {
      issueNumber,
      date: new Date().toISOString().split('T')[0],
      minutes,
      note,
    }

    await this.metadataService.addTimeEntry(entry)
    const timeEntries = [...this.state.timeEntries, entry]
    this.state = { ...this.state, timeEntries }
    this.emitUpdate()
  }

  /**
   * Save notes for a task to .ghdesktop.
   */
  public async saveTaskNotesToMetadata(
    issueNumber: number,
    notes: string
  ): Promise<void> {
    if (!this.metadataService) {
      return
    }

    await this.metadataService.saveNotes(issueNumber, notes)
  }

  /**
   * Load notes for a task from .ghdesktop.
   */
  public async loadTaskNotesFromMetadata(issueNumber: number): Promise<string | null> {
    if (!this.metadataService) {
      return null
    }

    return this.metadataService.loadNotes(issueNumber)
  }
}
