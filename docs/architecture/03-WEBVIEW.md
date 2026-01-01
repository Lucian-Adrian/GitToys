# Webview Architecture

**Files**: `webview-ui/bulkCommit.ts`, `webview-ui/bulkCommit.css`  
**Type**: Client UI  
**Size**: ~709 lines TS, ~450 lines CSS  

## Overview

Single-page app in a VS Code webview panel. Handles UI rendering, user input, and IPC messaging.

## BulkCommitApp Class

Main application class managing state and events.

### Constructor

```typescript
constructor() {
  this.vscode = acquireVsCodeApi();
  this.state = { /* initial state */ };
  this.setupMessageListener();
  this.setupKeyboardShortcuts();
  this.render();
}
```

Initializes:
- VS Code API bridge
- App state
- Event listeners
- First render

### State Structure

```typescript
interface AppState {
  files: FileInfo[];               // All changed files
  repoInfo: RepoInfo | null;       // Repo name, branch
  selectedFiles: Set<string>;      // Paths of selected files
  commitMessages: Map<string, string>;  // Path → message
  loading: boolean;
  error: string | null;
  templates: CommitTemplate[];
  settings: Settings;
  filter: FilterType;              // 'all' | 'modified' | etc
  searchQuery: string;
  groupByFolder: boolean;
}
```

State persists using `vscode.setState()` across webview lifecycle.

## Message Protocol (IPC)

### Extension → Webview

**Type**: `changedFiles`
```typescript
{
  type: 'changedFiles',
  files: FileInfo[],
  repoInfo: RepoInfo,
  templates: CommitTemplate[],
  settings: Settings
}
```
Sent when files change. Populates UI with current repo state.

**Type**: `error`
```typescript
{
  type: 'error',
  message: string
}
```
Display error notification.

**Type**: `loading`
```typescript
{
  type: 'loading',
  loading: boolean
}
```
Show/hide loading spinner.

### Webview → Extension

**Type**: `ready`
```typescript
{ command: 'ready' }
```
Signals webview ready to receive messages.

**Type**: `commitFiles`
```typescript
{
  command: 'commitFiles',
  commits: CommitRequest[]
}
```
User clicked Commit button. Send array of { filePath, message }.

**Type**: `openDiff`
```typescript
{
  command: 'openDiff',
  filePath: string
}
```
User clicked file path. Open VS Code diff viewer.

**Type**: `refresh`
```typescript
{ command: 'refresh' }
```
User clicked refresh button. Ask extension for latest file list.

## Keyboard Shortcuts

| Key Combo | Action |
|-----------|--------|
| `Ctrl+Enter` | Commit |
| `Ctrl+A` | Select all visible files |
| `Ctrl+F` | Focus search input |
| `Escape` | Clear search |
| `Tab` (in textarea) | Next commit message input |

Prevent default where needed (e.g., Ctrl+A in search).

## UI Rendering

### Main Render Flow

```typescript
render() {
  if (loading && no files) → show spinner
  if (no repo) → show "no repo" state
  if (no files) → show empty state
  else → render full UI with file list
}
```

### File List Rendering

1. **Filter**: Apply status, search, staged filters
2. **Group**: Optionally group by folder
3. **Render Groups**: Loop folders → loop files
4. **Selected Files**: Show commit input if selected

### Search & Filter

```typescript
getFilteredFiles(): FileInfo[] {
  // Apply filter type
  switch (this.state.filter) {
    case 'modified': return files with status='modified'
    case 'added': return added/untracked files
    // etc
  }
  
  // Apply search
  if (searchQuery) {
    return files.filter(f =>
      f.relativePath.includes(searchQuery)
    );
  }
  
  return filtered files
}
```

## Event Listeners

### File Checkbox
```typescript
.file-checkbox → on 'change' → add/remove from selectedFiles
```

### Commit Input (Textarea)
```typescript
.commit-input → on 'input' → update commitMessages map
                → on 'keydown' (Tab) → move to next input
                → auto-resize based on content
```

### Filter Buttons
```typescript
.filter-btn → on 'click' → set filter state → re-render
```

### Search Input
```typescript
.search-input → on 'input' → set searchQuery → re-render
```

### Template Buttons
```typescript
.template-btn → on 'click' → prepend template to selected files
```

## State Persistence

```typescript
saveState() {
  this.vscode.setState({
    selectedFiles: Array.from(selectedFiles),
    commitMessages: Object.fromEntries(commitMessages),
    filter, groupByFolder
  });
}
```

When webview reopens (user clicks command again), state restored.

## Performance Optimizations

1. **Conditional Rendering**: Only show textarea for selected files
2. **Debounced Search**: Render on input change
3. **No Framework**: Vanilla TS, no virtual DOM overhead
4. **HTML Escaping**: Prevent XSS via `escapeHtml()`

## CSS Architecture

### Design System

```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --border-radius: 4px;
  --transition: 0.15s ease;
}
```

### VS Code Theme Integration

```css
color: var(--vscode-foreground);
background: var(--vscode-editor-background);
border-color: var(--vscode-widget-border);
```

All colors use VS Code CSS variables for native theme support.

### Component Styles

- `.header`: Title and repo info
- `.search-filter-bar`: Search input + filter buttons
- `.templates-bar`: Template buttons
- `.file-list`: Container for file items
- `.file-item`: Single file with checkbox, status, message input
- `.folder-group`: Folder header + child files
- `.commit-container`: Sticky footer with commit button
- `.empty-state`: "No changes" message
- `.error-state`: Error notification

## Accessibility

- All inputs have `title` attributes
- Color not sole indicator (status badges have letters)
- Keyboard navigation fully supported
- Focus visible on inputs
- Semantic HTML (labels, buttons, inputs)

## Future Enhancements

- Virtual scrolling for large file lists (50+ files)
- Fuzzy search instead of substring match
- Diff preview inline (webview expense trade-off)
- Commit message autocomplete from history
- Drag-to-reorder commits
