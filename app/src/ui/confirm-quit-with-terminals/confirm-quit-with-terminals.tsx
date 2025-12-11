import * as React from 'react'
import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { OkCancelButtonGroup } from '../dialog/ok-cancel-button-group'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IConfirmQuitWithTerminalsProps {
  /** Number of repositories with active terminal sessions */
  readonly repositoryCount: number
  /** Called when the user confirms they want to quit */
  readonly onConfirm: () => void
  /** Called when the dialog is dismissed */
  readonly onDismissed: () => void
}

/**
 * Dialog shown when the user tries to quit the app while there are
 * active terminal sessions.
 */
export class ConfirmQuitWithTerminals extends React.Component<IConfirmQuitWithTerminalsProps> {
  private onConfirm = () => {
    this.props.onConfirm()
    this.props.onDismissed()
  }

  public render() {
    const { repositoryCount, onDismissed } = this.props

    const repoText = repositoryCount === 1
      ? '1 repository'
      : `${repositoryCount} repositories`

    return (
      <Dialog
        id="confirm-quit-with-terminals"
        title="Active Terminal Sessions"
        type="warning"
        onDismissed={onDismissed}
        onSubmit={this.onConfirm}
      >
        <DialogContent>
          <div className="confirm-quit-terminals-content">
            <Octicon symbol={octicons.terminal} className="warning-icon" />
            <p>
              You have active terminal sessions in {repoText}. These sessions
              will be terminated if you quit the application.
            </p>
            <p>
              Are you sure you want to quit?
            </p>
          </div>
        </DialogContent>
        <DialogFooter>
          <OkCancelButtonGroup
            okButtonText="Quit Anyway"
            cancelButtonText="Cancel"
            destructive={true}
          />
        </DialogFooter>
      </Dialog>
    )
  }
}
