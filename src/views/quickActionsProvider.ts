import * as vscode from 'vscode';
import { GitService } from '../git/gitService';

export class QuickActionsProvider implements vscode.TreeDataProvider<QuickActionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<QuickActionItem | undefined | null | void> = 
    new vscode.EventEmitter<QuickActionItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<QuickActionItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  constructor(private gitService: GitService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: QuickActionItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: QuickActionItem): Thenable<QuickActionItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const syncStatus = this.gitService.getSyncStatus();
    const changesCount = this.gitService.getChangesCount();
    const repoInfo = this.gitService.getRepositoryInfo();

    if (!repoInfo) {
      return Promise.resolve([
        new QuickActionItem(
          'No repository',
          'Open a folder with a Git repository',
          undefined,
          'warning',
          true
        )
      ]);
    }

    const items: QuickActionItem[] = [
      new QuickActionItem(
        'Push',
        syncStatus && syncStatus.ahead > 0 
          ? `${syncStatus.ahead} commit(s) to push` 
          : 'Up to date',
        'gittoys.pushChanges',
        'cloud-upload',
        syncStatus?.ahead === 0
      ),
      new QuickActionItem(
        'Pull',
        syncStatus && syncStatus.behind > 0 
          ? `${syncStatus.behind} commit(s) to pull` 
          : 'Up to date',
        'gittoys.pullChanges',
        'cloud-download',
        false
      ),
      new QuickActionItem(
        'Bulk Commit',
        changesCount.total > 0 
          ? `${changesCount.total} file(s) changed` 
          : 'No changes',
        'gittoys.openBulkCommit',
        'git-commit',
        changesCount.total === 0
      ),
      new QuickActionItem(
        'Undo Last Commit',
        'Soft reset to previous state',
        'gittoys.undoLastCommit',
        'discard',
        false
      ),
    ];

    return Promise.resolve(items);
  }
}

export class QuickActionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly commandId: string | undefined,
    public readonly iconName: string,
    public readonly disabled: boolean = false
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    
    this.tooltip = this.description;
    this.iconPath = new vscode.ThemeIcon(iconName);
    
    if (commandId && !disabled) {
      this.command = {
        command: commandId,
        title: label,
        arguments: []
      };
    }

    if (disabled) {
      this.contextValue = 'disabled';
    }
  }
}
