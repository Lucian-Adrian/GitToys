# Git Service Layer

**File**: `src/git/gitService.ts`  
**Type**: Core service  
**Size**: ~250 lines  

## Purpose

Singleton service wrapping VS Code's Git extension API. All git operations go through here.

## Initialization

```typescript
const gitExt = vscode.extensions.getExtension('vscode.git');
const gitAPI = gitExt.exports.getAPI(1);  // API version 1
this.repository = gitAPI.repositories[0];  // First (only) repo
```

Throws error if:
- vscode.git extension not available
- No repositories found in workspace

## Repository State

```typescript
private repository: Repository;  // Single repo instance
private disposables: Disposable[] = [];
```

Listeners for repository changes:
- `onDidChangeRepository`: Any git state change
- Used to trigger UI updates

## Core Methods

### `getChangedFiles(): FileInfo[]`

Returns all uncommitted changes (staged + unstaged).

**Returns**:
```typescript
interface FileInfo {
  path: string;              // Full path
  relativePath: string;      // Relative to repo root
  status: 'modified' | 'added' | 'deleted' | ...
  staged: boolean;           // Git status
  uri: string;              // VS Code URI
}
```

**Implementation**:
- Uses `repository.state.workingTreeChanges`
- Uses `repository.state.stagingChanges` 
- Merges and deduplicates

### `bulkCommit(commits: CommitRequest[]): Promise<BulkCommitResult>`

Atomically commits each file with its message.

**Input**:
```typescript
interface CommitRequest {
  filePath: string;    // Must exist in changed files
  message: string;     // Commit message
}
```

**Algorithm**:
```
For each commit request:
  1. Stage the file (unstage others to isolate)
  2. Run: git commit -m "message"
  3. Track success/failure
  4. Restore staging area to original state

Return: { successful, failed, total, errors[] }
```

**Error Recovery**:
- If commit fails, logs error but continues
- Original staging state always restored
- User sees detailed error report

### `push(): Promise<void>`

Pushes current branch to remote.

```typescript
await this.repository.push();
// Throws if no remote or push fails
```

### `pull(): Promise<void>`

Pulls from upstream (fetch + merge/rebase per config).

```typescript
await this.repository.pull();
```

### `fetch(): Promise<void>`

Fetches from all remotes.

```typescript
await this.repository.fetch();
```

### `undoLastCommit(): Promise<void>`

Soft reset to previous commit (keeps changes staged).

```bash
git reset --soft HEAD~1
```

Changes become staged again, user can re-commit or modify.

### `getSyncStatus(): SyncStatus`

Returns ahead/behind counts vs upstream.

```typescript
interface SyncStatus {
  ahead: number;
  behind: number;
  branch: string;
  remote?: string;
}
```

**Source**: `repository.state.HEAD` and `repository.state.remoteSourceBranches`

### `getChangesCount(): ChangeCount`

Quick stats of changes.

```typescript
interface ChangeCount {
  modified: number;
  added: number;
  deleted: number;
  total: number;
}
```

Used for status bar display.

### `openDiff(filePath: string): Promise<void>`

Opens diff viewer for a specific file.

```typescript
const uri = vscode.Uri.file(filePath);
const command = 'git.openChange';
await vscode.commands.executeCommand(command, uri);
```

Delegates to VS Code's Git extension for native diff UI.

## Error Handling

All methods throw `GitError` on failure:

```typescript
class GitError extends Error {
  constructor(
    public readonly command: string,
    public readonly stderr: string,
    message: string
  ) {
    super(message);
  }
}
```

Caller (extension.ts) catches and shows user-friendly message.

## Event Listeners

```typescript
this.repository.onDidChangeRepository(() => {
  this.onRepositoryChanged.fire();
});
```

BulkCommitPanel and StatusBarManager listen to this event to refresh UI.

## Type Definitions

**File**: `src/types/git.ts`

Defines VS Code Git API types:
- `Repository`: Main git repo object
- `RepositoryState`: Current state (HEAD, changes, etc)
- `Change`: Single file change
- Error types

Minimal definitions, only what's needed.

## Performance Considerations

- **Caching**: File list not cached, always queries from git
- **Debouncing**: Repository change events debounced by caller
- **Parallelization**: Commits run sequentially (git lock)
- **Async**: All operations non-blocking

## Testing Strategy

For unit tests (future):
1. Mock VS Code Git API
2. Mock repository state
3. Test each method independently
4. Test error cases (no repo, commit failures)

## Adding New Git Operations

1. Add method to GitService
2. Define return type in types
3. Handle errors appropriately
4. Call from extension.ts command
5. Update messages.ts if webview interaction needed
