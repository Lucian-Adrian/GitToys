# View Providers & Status Bar

**Files**: 
- `src/views/toysTreeProvider.ts`
- `src/views/quickActionsProvider.ts`
- `src/views/statusBarManager.ts`

**Type**: UI providers  
**Combined Size**: ~250 lines  

## Tree View Architecture

Both providers implement VS Code's `TreeDataProvider<TreeItem>` interface.

### ToysTreeProvider

Implements menu tree with main commands.

**View ID**: `gittoys.toysView`  
**Title**: "Git Toys"

**Root Items**:
```
📦 Bulk Commit (command: gittoys.bulkCommit.open)
📤 Push (command: gittoys.pushChanges)
📥 Pull (command: gittoys.pullChanges)
↩️  Undo Last Commit (command: gittoys.undoLastCommit)
```

**Implementation**:
```typescript
export class ToysTreeProvider implements TreeDataProvider<TreeItem> {
  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) return rootItems;
    return [];  // Leaf items have no children
  }
  
  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }
}
```

**Features**:
- Static menu (no hierarchy)
- Icons for visual distinction
- Simple state (no status indicators)

### QuickActionsProvider

Same items as ToysTreeProvider but with status info.

**View ID**: `gittoys.quickActionsView`  
**Title**: "Quick Actions"

**Extended Items with Status**:
```
Push    [ahead: 3]
Pull    [behind: 2]
Undo    [latest: abc1234]
```

**Implementation**:
```typescript
async getChildren() {
  const syncStatus = this.gitService.getSyncStatus();
  
  return [
    {
      label: `Push ${syncStatus.ahead ? `[+${syncStatus.ahead}]` : ''}`,
      command: { command: 'gittoys.pushChanges', ... }
    },
    {
      label: `Pull ${syncStatus.behind ? `[-${syncStatus.behind}]` : ''}`,
      command: { command: 'gittoys.pullChanges', ... }
    },
    ...
  ];
}
```

**Refresh Trigger**:
```typescript
private refresh() {
  this.onDidChangeTreeDataEmitter.fire();
}

this.gitService.onRepositoryChanged(() => this.refresh());
```

On any git change, tree refreshes to show updated counts.

## Status Bar Manager

Creates and manages status bar items in the editor bottom bar.

### Architecture

```typescript
export class StatusBarManager {
  private changesItem: vscode.StatusBarItem;
  private syncItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];
}
```

### Changes Item

**Position**: Far left (priority high)  
**Text**: `"✏️ 5 changes"`  
**Command**: `gittoys.bulkCommit.open`

**Update Logic**:
```typescript
const count = this.gitService.getChangesCount();
this.changesItem.text = `✏️ ${count.total} changes`;
this.changesItem.tooltip = `${count.modified} modified, ${count.added} added, ${count.deleted} deleted`;
```

**Hide Condition**:
- Hidden if 0 changes (clean repo)
- Shown immediately when first change detected

### Sync Item

**Position**: Left-center  
**Text**: `"↕️ ahead:2 behind:1"`  
**Command**: `gittoys.openQuickActions`

**Update Logic**:
```typescript
const status = this.gitService.getSyncStatus();
const text = status.ahead > 0 || status.behind > 0
  ? `↕️ ↑${status.ahead} ↓${status.behind}`
  : `↕️ In sync`;
this.syncItem.text = text;
this.syncItem.tooltip = `${status.branch} - ${status.remote}`;
```

**Hide Condition**:
- Hidden if no remote set
- Hidden if no commits ahead/behind

### Creation

```typescript
constructor(private gitService: GitService) {
  this.changesItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  
  this.syncItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99
  );
  
  this.changesItem.show();
  this.syncItem.show();
  
  // Update on git changes
  this.gitService.onRepositoryChanged(() => {
    this.updateChanges();
    this.updateSync();
  });
}
```

### Public API

```typescript
public update(): void {
  this.updateChanges();
  this.updateSync();
}

public dispose(): void {
  this.disposables.forEach(d => d.dispose());
  this.changesItem.dispose();
  this.syncItem.dispose();
}
```

## Event Flow Diagram

```
Git Repository Changes (file system)
        ↓
VS Code Git API: onDidChangeRepository
        ↓
GitService: onRepositoryChanged event
        ↓
Both:
├─ StatusBarManager: refresh UI
├─ QuickActionsProvider: refresh tree
├─ BulkCommitPanel: send changedFiles message
└─ Any UI listening to event
```

All updates happen reactively from git change event.

## TreeItem Configuration

```typescript
const item = new TreeItem(
  'Bulk Commit',
  TreeItemCollapsibleState.None  // Leaf node
);

item.iconPath = new ThemeIcon('files');
item.command = {
  command: 'gittoys.bulkCommit.open',
  title: 'Open Bulk Commit'
};
item.contextValue = 'bulkCommit';  // For context menu
```

**contextValue**: Enables context-menu filtering in `menus.json`.

## Context Menus

Tree items can have context menus:

```json
"menus": {
  "view/item/context": [
    {
      "command": "gittoys.bulkCommit.open",
      "when": "view == gittoys.toysView && viewItem == bulkCommit"
    }
  ]
}
```

Allow running commands from right-click on tree items.

## Performance Notes

- **Tree refresh**: O(1) for status queries, instant refresh
- **Status bar**: Updates only on git changes (not polling)
- **No polling**: Event-driven, not timer-based

## Testing

For unit tests:
1. Mock GitService
2. Test tree item generation
3. Test status bar text formatting
4. Test event listeners
5. Mock repository state

## Future Enhancements

**Tree Views**:
- Add nested structure (Group by status type)
- Expand/collapse folders
- Right-click → Open file

**Status Bar**:
- Progress indicator during push/pull
- Clickable status details
- Repository selector if multi-repo support added

## Accessibility

- **Icons**: Accessible through labels
- **Text**: Sufficient contrast with background
- **Keyboard**: Tree items focusable with Tab
- **Screen readers**: TreeItem.tooltip provides context
