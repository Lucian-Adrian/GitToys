import * as vscode from 'vscode';

export class ToysTreeProvider implements vscode.TreeDataProvider<ToyItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ToyItem | undefined | null | void> = new vscode.EventEmitter<ToyItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ToyItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private toys: ToyItem[] = [
    new ToyItem(
      'Bulk Commit',
      'Commit files one by one with individual messages',
      'gittoys.openBulkCommit',
      'git-commit'
    ),
    new ToyItem(
      'Stash Manager',
      'Coming soon...',
      undefined,
      'archive',
      true
    ),
    new ToyItem(
      'Branch Visualizer',
      'Coming soon...',
      undefined,
      'git-branch',
      true
    ),
    new ToyItem(
      'Commit Templates',
      'Coming soon...',
      undefined,
      'file-text',
      true
    ),
  ];

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ToyItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ToyItem): Thenable<ToyItem[]> {
    if (element) {
      return Promise.resolve([]);
    }
    return Promise.resolve(this.toys);
  }
}

export class ToyItem extends vscode.TreeItem {
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
      this.description = '(Coming Soon)';
      this.contextValue = 'disabled';
    }
  }
}
