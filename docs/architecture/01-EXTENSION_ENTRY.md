# Extension Entry Point

**File**: `src/extension.ts`  
**Type**: Main entry point  
**Size**: ~100 lines  

## Purpose

Registers commands, initializes all managers/providers, and orchestrates extension lifecycle.

## Activation Events

```json
"activationEvents": [
  "workspaceContains:.git",
  "onCommand:gittoys.bulkCommit.open",
  "onView:gittoys.toysView",
  "onView:gittoys.quickActionsView"
]
```

Extension activates when user opens a git repo workspace or uses any GitToys command.

## Exports & API

### `activate(context: ExtensionContext): void`

Main function called by VS Code on activation.

**Responsibilities**:
- Initialize GitService singleton
- Create and register QuickActionsProvider
- Create and register ToysTreeProvider
- Initialize StatusBarManager
- Register all commands (7 total)
- Store context for disposal

**Key Variables**:
```typescript
let gitService: GitService;              // Shared instance
let statusBarManager: StatusBarManager;  // Manages status bar
let bulkCommitPanel: BulkCommitPanel;    // Current webview (null if closed)
```

### `deactivate(): void`

Called when extension is deactivated. Disposes resources (webview panels, listeners).

## Commands Registered

| Command ID | Title | Keyboard Shortcut | Handler |
|-----------|-------|-------------------|---------|
| `gittoys.bulkCommit.open` | Open Bulk Commit | `Ctrl+Shift+G B` | Opens BulkCommitPanel |
| `gittoys.openQuickActions` | Quick Actions | `Ctrl+Shift+G Q` | Shows tree view |
| `gittoys.pushChanges` | Push | `Ctrl+Shift+G P` | Calls GitService.push() |
| `gittoys.pullChanges` | Pull | `Ctrl+Shift+G L` | Calls GitService.pull() |
| `gittoys.undoLastCommit` | Undo Last Commit | `Ctrl+Shift+G Z` | Calls GitService.undoLastCommit() |
| `gittoys.applyTemplate` | Apply Template | None | Handler in BulkCommitPanel |

## View Providers

### ToysTreeProvider
- **View ID**: `gittoys.toysView`
- **Title**: "Git Toys"
- **Items**: Top-level commands (Bulk Commit, Push, Pull, Undo)
- **File**: `src/views/toysTreeProvider.ts`

### QuickActionsProvider
- **View ID**: `gittoys.quickActionsView`
- **Title**: "Quick Actions"
- **Items**: Same as toys view but with status indicators
- **File**: `src/views/quickActionsProvider.ts`

## Status Bar Items

Created by StatusBarManager:
- **Changes Item**: Shows file count, click to open Bulk Commit
- **Sync Item**: Shows ahead/behind counts, click to open Quick Actions

## Webview Panel Management

```typescript
if (!bulkCommitPanel) {
  bulkCommitPanel = new BulkCommitPanel(context, gitService);
  bulkCommitPanel.onClosed(() => {
    bulkCommitPanel = null;  // Clear reference
  });
}
bulkCommitPanel.show();  // Bring to focus
```

Only one bulk commit panel can be open at a time. If closed, next command creates new instance.

## Error Handling

All command handlers wrapped with try-catch:
```typescript
try {
  // Command logic
} catch (error) {
  vscode.window.showErrorMessage(`Error: ${error.message}`);
}
```

## Context Object Usage

Extension context stored for:
- **Subscriptions**: All disposables added here for cleanup
- **Extension URI**: Used to load webview assets
- **Global State**: Could be used for extension-wide data persistence

## Dependency Graph

```
extension.ts
├── GitService (singleton)
├── StatusBarManager → GitService
├── QuickActionsProvider → GitService
├── ToysTreeProvider → GitService
└── BulkCommitPanel → GitService, context
```

All services share same GitService instance for consistent git state.

## Next Steps

For adding new commands:
1. Define command in `package.json` under `commands`
2. Register handler in `activate()` function
3. Handler typically delegates to GitService or opens panel
4. Ensure context.subscriptions.push() to register disposable
