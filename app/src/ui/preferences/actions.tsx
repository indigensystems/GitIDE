import * as React from 'react'
import { DialogContent } from '../dialog'
import { Row } from '../lib/row'
import { TextBox } from '../lib/text-box'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import {
  IActionButtonsSettings,
  ActionButtonTheme,
  ICustomActionButton,
  CoreActionScripts,
  UIActionButtons,
} from '../../models/preferences'

interface IActionsProps {
  readonly actionButtonsSettings: IActionButtonsSettings
  readonly onActionButtonsSettingsChanged: (
    settings: IActionButtonsSettings
  ) => void
}

interface IActionsState {
  readonly newButtonFile: string
  readonly newButtonLabel: string
  readonly editingButtonId: string | null
}

export class Actions extends React.Component<IActionsProps, IActionsState> {
  public constructor(props: IActionsProps) {
    super(props)
    this.state = {
      newButtonFile: '',
      newButtonLabel: '',
      editingButtonId: null,
    }
  }

  private onThemeChanged = (theme: ActionButtonTheme) => {
    this.props.onActionButtonsSettingsChanged({
      ...this.props.actionButtonsSettings,
      theme,
    })
  }

  private onCustomColorChanged = (buttonId: string, color: string) => {
    const { actionButtonsSettings } = this.props
    this.props.onActionButtonsSettingsChanged({
      ...actionButtonsSettings,
      customColors: {
        ...actionButtonsSettings.customColors,
        [buttonId]: color,
      },
    })
  }

  private onRemoveCustomButton = (buttonId: string) => {
    const { actionButtonsSettings } = this.props
    this.props.onActionButtonsSettingsChanged({
      ...actionButtonsSettings,
      customButtons: actionButtonsSettings.customButtons.filter(
        b => b.id !== buttonId
      ),
    })
  }

  private onAddCustomButton = () => {
    const { newButtonFile, newButtonLabel } = this.state
    if (!newButtonFile.trim()) return

    const file = newButtonFile.trim()
    const label = newButtonLabel.trim() || this.generateLabelFromFile(file)
    const id = this.generateIdFromFile(file)

    // Check for duplicates
    const { actionButtonsSettings } = this.props
    const allButtons = [
      ...CoreActionScripts,
      ...actionButtonsSettings.customButtons,
    ]
    if (allButtons.some(b => b.file === file || b.id === id)) {
      return // Already exists
    }

    const newButton: ICustomActionButton = { id, file, label }
    this.props.onActionButtonsSettingsChanged({
      ...actionButtonsSettings,
      customButtons: [...actionButtonsSettings.customButtons, newButton],
    })

    this.setState({ newButtonFile: '', newButtonLabel: '' })
  }

  private generateLabelFromFile(file: string): string {
    // Remove extension and convert to title case
    const name = file.replace(/\.[^.]+$/, '')
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private generateIdFromFile(file: string): string {
    return file.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }

  private onNewButtonFileChanged = (value: string) => {
    this.setState({ newButtonFile: value })
  }

  private onNewButtonLabelChanged = (value: string) => {
    this.setState({ newButtonLabel: value })
  }

  private renderThemeSelector() {
    const { theme } = this.props.actionButtonsSettings

    return (
      <div className="actions-section">
        <h2 id="button-theme-heading">Button Theme</h2>
        <p className="description">
          Choose a color theme for action buttons in the file tree.
        </p>
        <div className="action-theme-options">
          <label className="action-theme-option">
            <input
              type="radio"
              name="action-button-theme"
              checked={theme === ActionButtonTheme.Default}
              onChange={() => this.onThemeChanged(ActionButtonTheme.Default)}
            />
            <span>Default (colorful)</span>
          </label>
          <label className="action-theme-option">
            <input
              type="radio"
              name="action-button-theme"
              checked={theme === ActionButtonTheme.Dark}
              onChange={() => this.onThemeChanged(ActionButtonTheme.Dark)}
            />
            <span>Dark (muted)</span>
          </label>
          <label className="action-theme-option">
            <input
              type="radio"
              name="action-button-theme"
              checked={theme === ActionButtonTheme.Custom}
              onChange={() => this.onThemeChanged(ActionButtonTheme.Custom)}
            />
            <span>Custom colors</span>
          </label>
        </div>
      </div>
    )
  }

  private renderCoreScripts() {
    return (
      <div className="actions-section">
        <h2>Core Scripts</h2>
        <p className="description">
          These scripts are always watched for. Buttons appear when files exist.
        </p>
        <div className="button-list core-scripts">
          {CoreActionScripts.map(script => (
            <div key={script.id} className="button-item core">
              <span className="button-file">{script.file}</span>
              <span className="button-label">{script.label}</span>
              {this.renderColorPicker(script.id)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  private renderCustomButtons() {
    const { customButtons } = this.props.actionButtonsSettings

    return (
      <div className="actions-section">
        <h2>Custom Scripts</h2>
        <p className="description">
          Add file patterns to watch for. Buttons appear when files exist.
        </p>
        <div className="button-list custom-scripts">
          {customButtons.map(button => (
            <div key={button.id} className="button-item custom">
              <span className="button-file">{button.file}</span>
              <span className="button-label">{button.label}</span>
              {this.renderColorPicker(button.id)}
              <Button
                className="remove-button"
                onClick={() => this.onRemoveCustomButton(button.id)}
                ariaLabel={`Remove ${button.label}`}
              >
                <Octicon symbol={octicons.x} />
              </Button>
            </div>
          ))}
        </div>
        {this.renderAddButton()}
      </div>
    )
  }

  private renderColorPicker(buttonId: string) {
    const { theme, customColors } = this.props.actionButtonsSettings
    if (theme !== ActionButtonTheme.Custom) return null

    const color = customColors[buttonId] || this.getDefaultColor(buttonId)

    return (
      <input
        type="color"
        className="color-picker"
        value={color}
        onChange={e => this.onCustomColorChanged(buttonId, e.target.value)}
        title="Choose button color"
      />
    )
  }

  private getDefaultColor(buttonId: string): string {
    // Default colors based on button type
    const colorMap: { [key: string]: string } = {
      // UI buttons
      'new-file': '#6b7280',
      'new-folder': '#6b7280',
      'terminal': '#6b7280',
      // Core scripts
      run: '#2ea043',
      'start-dev': '#2ea043',
      'stop-dev': '#da3633',
      'restart-dev': '#f0883e',
      claude: '#8b5cf6',
      // Custom scripts
      build: '#3b82f6',
      test: '#22c55e',
      lint: '#eab308',
      deploy: '#ec4899',
    }
    return colorMap[buttonId] || '#6b7280'
  }

  private renderUIButtons() {
    return (
      <div className="actions-section">
        <h2>UI Buttons</h2>
        <p className="description">
          These buttons are always visible in the file tree footer.
        </p>
        <div className="button-list ui-buttons">
          {UIActionButtons.map(button => (
            <div key={button.id} className="button-item core">
              <span className="button-label">{button.label}</span>
              {this.renderColorPicker(button.id)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  private renderAddButton() {
    const { newButtonFile, newButtonLabel } = this.state

    return (
      <div className="add-button-form">
        <Row>
          <TextBox
            label="File name"
            value={newButtonFile}
            onValueChanged={this.onNewButtonFileChanged}
            placeholder="e.g., build.sh, deploy.sh"
          />
        </Row>
        <Row>
          <TextBox
            label="Label (optional)"
            value={newButtonLabel}
            onValueChanged={this.onNewButtonLabelChanged}
            placeholder="Auto-generated from file name"
          />
        </Row>
        <Button
          onClick={this.onAddCustomButton}
          disabled={!newButtonFile.trim()}
        >
          <Octicon symbol={octicons.plus} />
          Add Button
        </Button>
      </div>
    )
  }

  public render() {
    return (
      <DialogContent className="actions-preferences">
        {this.renderThemeSelector()}
        {this.renderUIButtons()}
        {this.renderCoreScripts()}
        {this.renderCustomButtons()}
      </DialogContent>
    )
  }
}
