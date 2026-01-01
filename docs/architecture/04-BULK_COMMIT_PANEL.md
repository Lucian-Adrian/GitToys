# Bulk Commit Panel

**File**: `src/toys/bulk-commit/bulkCommitPanel.ts`  
**Type**: Webview controller  
**Size**: ~250 lines  

## Purpose

Manages the bulk commit webview panel lifecycle and coordinates between extension and webview.

## Class Structure

```typescript
export class BulkCommitPanel {
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private onClosedEmitter = new vscode.EventEmitter<void>();
  public onClosed = this.onClosedEmitter.event;
}
```

## Constructor

```typescript
constructor(
  private context: vscode.ExtensionContext,
  private gitService: GitService
)
```

**Initialization Steps**:
1. Create webview panel
2. Set HTML content
3. Set up message listeners
4. Load initial data
5. Subscribe to git events

## Creating Webview Panel

```typescript
const panel = vscode.window.createWebviewPanel(
  'bulkCommit',                    // Unique ID
  'Bulk Commit',                   // Display title
  vscode.ViewColumn.One,           // Position
  {
    enableScripts: true,           // Allow JS
    localResourceRoots: [...]      // Security: only serve from dist/
  }
);
```

## HTML Content

```typescript
private getHtmlContent(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Bulk Commit</title>
      <link rel="stylesheet" href="${cssUri}">
    </head>
    <body>
      <div id="app"></div>
      <script src="${jsUri}"></script>
    </body>
    </html>
  `;
}
```

Gets URIs to compiled webview assets from `dist/webview/`.

## Message Handlers

Listens for messages from webview:

### `commitFiles` Command

```typescript
case 'commitFiles':
  const commits = message.commits as CommitRequest[];
  
  // Confirm if configured
  if (settings.confirmBeforeCommit) {
    const confirmed = await vscode.window.showWarningMessage(
      `Commit ${commits.length} files?`,
      'Commit'
    );
    if (!confirmed) return;
  }
  
  // Execute commits
  const result = await gitService.bulkCommit(commits);
  
  // Show result
  vscode.window.showInformationMessage(
    `Committed ${result.successful}/${result.total} files`
  );
  
  // Auto-push if configured
  if (settings.pushAfterCommit && result.successful > 0) {
    await gitService.push();
  }
  
  // Refresh file list
  this.sendChangedFiles();
```

### `openDiff` Command

```typescript
case 'openDiff':
  const filePath = message.filePath as string;
  await this.gitService.openDiff(filePath);
```

### `refresh` Command

```typescript
case 'refresh':
  this.sendChangedFiles();
```

## Data Transmission

### `sendChangedFiles()`

```typescript
private async sendChangedFiles(): Promise<void> {
  const files = this.gitService.getChangedFiles();
  const repoInfo = this.getRepoInfo();
  const templates = this.loadTemplates();
  const settings = this.loadSettings();
  
  this.panel.webview.postMessage({
    type: 'changedFiles',
    files,
    repoInfo,
    templates,
    settings
  });
}
```

Sent on:
- Initial load
- User clicks refresh
- After successful commit
- On git repository change event

### Template Loading

```typescript
private loadTemplates(): CommitTemplate[] {
  const config = vscode.workspace.getConfiguration('gittoys');
  return config.get('bulkCommit.templates', []);
}
```

Reads from user settings (see CONFIG.md).

### Settings Loading

```typescript
private loadSettings(): Settings {
  const config = vscode.workspace.getConfiguration('gittoys');
  return {
    pushAfterCommit: config.get('bulkCommit.pushAfterCommit', false),
    confirmBeforeCommit: config.get('bulkCommit.confirmBeforeCommit', true)
  };
}
```

## Event Subscriptions

### Repository Changes

```typescript
this.gitService.onRepositoryChanged(() => {
  this.sendChangedFiles();
});
```

When any git state changes (outside the panel), refresh UI.

### Panel Disposed

```typescript
panel.onDidDispose(() => {
  this.dispose();
  this.onClosedEmitter.fire();
});
```

Extension calls this to clear panel reference.

## Public Methods

### `show()`

Brings panel to focus.

```typescript
this.panel.reveal(vscode.ViewColumn.One);
```

### `dispose()`

Cleans up resources.

```typescript
this.disposables.forEach(d => d.dispose());
this.panel.dispose();
```

## Lifecycle

```
User command: gittoys.bulkCommit.open
        ↓
Extension checks if panel exists
        ↓
If not, create new BulkCommitPanel()
        ↓
Constructor: createWebviewPanel, setHtmlContent, setupListeners
        ↓
Send initial changedFiles message
        ↓
Webview renders UI
        ↓
User interacts: select files, write messages
        ↓
Click commit → postMessage to extension
        ↓
Panel receives message, calls gitService.bulkCommit()
        ↓
Result shown to user
        ↓
sendChangedFiles() → refresh webview
        ↓
User closes panel → onDidDispose → extension clears ref
```

## Security Considerations

- **Scripts enabled**: Necessary for interactivity
- **Local resources only**: CSS/JS served from extension bundle
- **HTML escaping**: Webview escapes all user data
- **No eval**: No dangerous dynamic code execution
- **No external resources**: No CDN, all bundled

## Configuration Integration

Panel reads from settings:
- `gittoys.bulkCommit.pushAfterCommit`
- `gittoys.bulkCommit.confirmBeforeCommit`
- `gittoys.bulkCommit.templates`

Changes to settings take effect on next message (no live refresh).

## Error Handling

```typescript
try {
  // Command logic
} catch (error) {
  panel.webview.postMessage({
    type: 'error',
    message: error.message
  });
}
```

Errors shown in webview notification.

## Testing

For unit tests:
1. Mock vscode.window.createWebviewPanel
2. Mock gitService
3. Mock vscode.workspace.getConfiguration
4. Test message handlers
5. Test data transmission
