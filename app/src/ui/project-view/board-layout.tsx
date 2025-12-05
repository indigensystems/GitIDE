import * as React from 'react'
import {
  IAPIProjectField,
  IAPIProjectV2ItemWithContent,
} from '../../lib/api'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IBoardLayoutProps {
  readonly items: ReadonlyArray<IAPIProjectV2ItemWithContent>
  readonly fields: ReadonlyArray<IAPIProjectField>
  readonly statusField: IAPIProjectField | undefined
  readonly groupByField?: { id: string; name: string }
  readonly onCardClick?: (item: IAPIProjectV2ItemWithContent) => void
}

interface IColumn {
  readonly id: string
  readonly name: string
  readonly color: string
  readonly items: ReadonlyArray<IAPIProjectV2ItemWithContent>
}

export class BoardLayout extends React.Component<IBoardLayoutProps> {
  private getColumns(): ReadonlyArray<IColumn> {
    const { items, statusField } = this.props

    // If no status field, put all items in one column
    if (!statusField || !statusField.options) {
      return [
        {
          id: 'all',
          name: 'All Items',
          color: 'GRAY',
          items,
        },
      ]
    }

    // Create columns from status field options
    const columns: IColumn[] = statusField.options.map(option => ({
      id: option.id,
      name: option.name,
      color: option.color || 'GRAY',
      items: [],
    }))

    // Add a "No Status" column for items without a status
    const noStatusColumn: IColumn = {
      id: 'no-status',
      name: 'No Status',
      color: 'GRAY',
      items: [],
    }

    // Group items by their status
    const columnMap = new Map<string, IAPIProjectV2ItemWithContent[]>()
    for (const column of columns) {
      columnMap.set(column.id, [])
    }
    columnMap.set('no-status', [])

    for (const item of items) {
      const statusValue = item.fieldValues.find(
        fv => fv.field.name === 'Status'
      )

      if (statusValue && statusValue.type === 'singleSelect') {
        const columnItems = columnMap.get(statusValue.optionId)
        if (columnItems) {
          columnItems.push(item)
        } else {
          // If option not found, add to no status
          columnMap.get('no-status')!.push(item)
        }
      } else {
        columnMap.get('no-status')!.push(item)
      }
    }

    // Build final columns array with items
    const result: IColumn[] = columns.map(col => ({
      ...col,
      items: columnMap.get(col.id) || [],
    }))

    // Add no status column if it has items
    const noStatusItems = columnMap.get('no-status') || []
    if (noStatusItems.length > 0) {
      result.unshift({
        ...noStatusColumn,
        items: noStatusItems,
      })
    }

    return result
  }

  private getColumnColorClass(color: string): string {
    // Map GitHub project colors to CSS classes
    const colorMap: Record<string, string> = {
      GRAY: 'gray',
      RED: 'red',
      PINK: 'pink',
      PURPLE: 'purple',
      BLUE: 'blue',
      GREEN: 'green',
      YELLOW: 'yellow',
      ORANGE: 'orange',
    }
    return colorMap[color.toUpperCase()] || 'gray'
  }

  private onCardClick = (item: IAPIProjectV2ItemWithContent) => {
    this.props.onCardClick?.(item)
  }

  private renderCard(item: IAPIProjectV2ItemWithContent) {
    const content = item.content
    if (!content) {
      return null
    }

    const repoInfo = content.repository
      ? `${content.repository.owner.login}/${content.repository.name}`
      : null

    return (
      <div
        key={item.id}
        className="board-card"
        onClick={() => this.onCardClick(item)}
      >
        <div className="card-header">
          {content.type === 'Issue' && (
            <Octicon
              symbol={content.state === 'OPEN' ? octicons.issueOpened : octicons.issueClosed}
              className={`issue-icon ${content.state === 'OPEN' ? 'open' : 'closed'}`}
            />
          )}
          {content.type === 'PullRequest' && (
            <Octicon
              symbol={octicons.gitPullRequest}
              className={`pr-icon ${content.state === 'OPEN' ? 'open' : 'merged'}`}
            />
          )}
          {content.type === 'DraftIssue' && (
            <Octicon symbol={octicons.issueDraft} className="draft-icon" />
          )}
          <span className="card-title">{content.title}</span>
        </div>
        <div className="card-meta">
          {repoInfo && <span className="card-repo">{repoInfo}</span>}
          {content.number && <span className="card-number">#{content.number}</span>}
        </div>
        {content.labels && content.labels.length > 0 && (
          <div className="card-labels">
            {content.labels.slice(0, 3).map((label, idx) => (
              <span
                key={idx}
                className="card-label"
                style={{ backgroundColor: `#${label.color}` }}
              >
                {label.name}
              </span>
            ))}
            {content.labels.length > 3 && (
              <span className="more-labels">+{content.labels.length - 3}</span>
            )}
          </div>
        )}
        {content.assignees && content.assignees.length > 0 && (
          <div className="card-assignees">
            {content.assignees.slice(0, 3).map((assignee, idx) => (
              <img
                key={idx}
                src={assignee.avatarUrl}
                alt={assignee.login}
                className="assignee-avatar"
                title={assignee.login}
              />
            ))}
            {content.assignees.length > 3 && (
              <span className="more-assignees">+{content.assignees.length - 3}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  private renderColumn(column: IColumn) {
    const colorClass = this.getColumnColorClass(column.color)

    return (
      <div key={column.id} className={`board-column ${colorClass}`}>
        <div className="column-header">
          <span className={`column-indicator ${colorClass}`} />
          <span className="column-name">{column.name}</span>
          <span className="column-count">{column.items.length}</span>
        </div>
        <div className="column-content">
          {column.items.map(item => this.renderCard(item))}
          {column.items.length === 0 && (
            <div className="column-empty">No items</div>
          )}
        </div>
      </div>
    )
  }

  public render() {
    const columns = this.getColumns()

    return (
      <div className="board-layout">
        <div className="board-columns">
          {columns.map(column => this.renderColumn(column))}
        </div>
      </div>
    )
  }
}
