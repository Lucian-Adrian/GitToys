# Type Definitions & Message Protocol

**Files**: `src/types/git.ts`, `src/types/messages.ts`  
**Type**: Type definitions  
**Size**: ~100 lines total  

## Git API Types

**File**: `src/types/git.ts`

Minimal type definitions for VS Code Git extension API (v1).

### Repository Interface

```typescript
export interface Repository {
  rootUri: Uri;
  inputBox: InputBox;
  state: RepositoryState;
  getCommit(ref: string): Promise<Commit>;
  status(): Promise<FileStatus[]>;
  add(resources: Uri[]): Promise<void>;
  revert(resources: Uri[]): Promise<void>;
  commit(message: string, all?: boolean): Promise<void>;
  push(remote?: string, branch?: string): Promise<void>;
  pull(): Promise<void>;
  fetch(): Promise<void>;
}
```

Only includes methods GitService actually uses.

### RepositoryState Interface

```typescript
export interface RepositoryState {
  HEAD?: Branch;
  branches: Branch[];
  remotes: Remote[];
  mergeInProgress: boolean;
  rebaseInProgress: boolean;
  revertInProgress: boolean;
  cherryPickInProgress: boolean;
  bisectInProgress: boolean;
  
  // Changes (uncommitted)
  workingTreeChanges: Change[];
  stagingChanges: Change[];
  
  // Ahead/behind
  aheadBehind?: { ahead: number; behind: number };
}
```

Used to query current repo state.

### Change Interface

```typescript
export interface Change {
  uri: Uri;
  renameUri?: Uri;
  status: GitFileStatus;
}

export enum GitFileStatus {
  INDEX_MODIFIED = 'M',
  INDEX_ADDED = 'A',
  INDEX_DELETED = 'D',
  INDEX_RENAMED = 'R',
  INDEX_COPIED = 'C',
  
  MODIFIED = 'M ̃',
  DELETED = 'D ̃',
  UNTRACKED = '??',
  IGNORED = '!!',
  INTENT_TO_ADD = 'A ',
  INTENT_TO_DELETE = 'D ',
  TYPE_CHANGE = 'T'
}
```

Maps to git's porcelain status format.

## FileInfo Type (Domain Model)

```typescript
export interface FileInfo {
  path: string;                    // Absolute path
  relativePath: string;            // Relative to repo root
  status: FileStatus;              // Simplified status
  staged: boolean;                 // Is file staged?
  uri: string;                     // VS Code URI
}

export type FileStatus = 
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'conflicted';
```

Simplified version of git's status for frontend.

### Status Mapping

Git status codes → FileStatus:
```
INDEX_MODIFIED, MODIFIED       → 'modified'
INDEX_ADDED, INTENT_TO_ADD    → 'added'
INDEX_DELETED, INTENT_TO_DELETE → 'deleted'
INDEX_RENAMED                  → 'renamed'
UNTRACKED                       → 'untracked'
All others                      → 'conflicted'
```

## Message Protocol Types

**File**: `src/types/messages.ts`

IPC message types between extension and webview.

### Base Message Types

```typescript
export interface ExtensionMessage {
  type: string;
  [key: string]: unknown;
}

export interface WebviewMessage {
  command: string;
  [key: string]: unknown;
}
```

Base types for type-safe messaging.

### Extension → Webview Messages

```typescript
export type ExtensionMessage = 
  | { type: 'changedFiles'; files: FileInfo[]; repoInfo: RepoInfo | null; templates: CommitTemplate[]; settings: Settings }
  | { type: 'error'; message: string }
  | { type: 'loading'; loading: boolean };
```

Webview listens in `setupMessageListener()` and handles each type.

**changedFiles**: Sent on:
- Initial webview load
- User clicks refresh
- After successful commit
- Repository change detected

**error**: Sent when operation fails
- Shown in webview error banner

**loading**: Toggle loading spinner

### Webview → Extension Messages

```typescript
export type WebviewMessage =
  | { command: 'ready' }
  | { command: 'commitFiles'; commits: CommitRequest[] }
  | { command: 'openDiff'; filePath: string }
  | { command: 'refresh' };
```

Extension listens in BulkCommitPanel's `setupMessageListener()`.

**ready**: Webview signals it's initialized
- Extension waits for this before sending first message

**commitFiles**: User clicked Commit
- Contains array of file paths + messages
- Extension processes synchronously

**openDiff**: User clicked file path
- Extension opens VS Code's git diff viewer

**refresh**: User clicked refresh button
- Extension re-queries git and sends changedFiles

## Domain Models

### CommitTemplate

```typescript
export interface CommitTemplate {
  name: string;              // "Feature", "Bug Fix"
  template: string;          // "feat: ", "fix: "
  description?: string;      // Shown on hover
}
```

Loaded from settings, passed to webview.

### RepoInfo

```typescript
export interface RepoInfo {
  name: string;              // Folder name
  branch: string;            // Current branch
  rootPath: string;          // Absolute path
}
```

Displayed in webview header.

### Settings

```typescript
export interface Settings {
  pushAfterCommit: boolean;
  confirmBeforeCommit: boolean;
}
```

Subset of settings relevant to webview. Full config in extension only.

### CommitRequest

```typescript
export interface CommitRequest {
  filePath: string;
  message: string;
}
```

What webview sends for each file to commit.

### BulkCommitResult

```typescript
export interface BulkCommitResult {
  successful: number;
  failed: number;
  total: number;
  errors: string[];
}
```

Returned from GitService.bulkCommit().

## SyncStatus Type

```typescript
export interface SyncStatus {
  ahead: number;
  behind: number;
  branch: string;
  remote?: string;
}
```

Used by status bar and quick actions provider.

## FileChange Type

```typescript
export interface FileChange {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}
```

Intermediate type used within GitService.

## Type Usage Patterns

### Safe Type Checking

```typescript
// ✅ Good
const message = event.data as ExtensionMessage;
if (message.type === 'changedFiles') {
  const files = message.files;  // Guaranteed by type guard
}

// ❌ Bad
const anything = event.data;
if (anything.type === 'changedFiles') {
  const files = anything.files;  // Could be undefined
}
```

### Exhaustive Type Checking

```typescript
// ✅ TypeScript ensures all cases handled
switch (message.type) {
  case 'changedFiles': ... break;
  case 'error': ... break;
  case 'loading': ... break;
  // TypeScript error if missing case
}
```

## Adding New Message Types

1. **Define in messages.ts**:
```typescript
export interface MyMessage {
  type: 'myMessage';
  data: MyData;
}
```

2. **Add to union type**:
```typescript
export type ExtensionMessage = 
  | { type: 'changedFiles'; ... }
  | { type: 'myMessage'; data: MyData }  // New
```

3. **Handle in receiver**:
```typescript
case 'myMessage':
  this.handleMyMessage(message.data);
  break;
```

4. **TypeScript enforces all senders**:
```typescript
// Error: Cannot access .data
this.vscode.postMessage({ type: 'myMessage' });

// Correct
this.vscode.postMessage({ 
  type: 'myMessage', 
  data: myData 
});
```

## Type Guard Functions

Could add type guards for runtime validation:

```typescript
function isCommitFilesMessage(msg: unknown): msg is { command: 'commitFiles'; commits: CommitRequest[] } {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'command' in msg &&
    msg.command === 'commitFiles' &&
    'commits' in msg &&
    Array.isArray(msg.commits)
  );
}
```

Currently not needed (trusts webview code), but useful for safety.

## Naming Conventions

- **Message types**: camelCase (`changedFiles`, `commitFiles`)
- **Interfaces**: PascalCase (`FileInfo`, `CommitTemplate`)
- **Enums**: PascalCase.UPPER_SNAKE_CASE (`GitFileStatus.INDEX_MODIFIED`)
- **Fields**: camelCase (`filePath`, `isStaged`)

## Future Type Additions

When adding new features:
1. Define types in appropriate file
2. Update message union types
3. Add to handler switch statements
4. Document in this file
5. Update DEVELOPMENT.md if complex

Types are single source of truth for contracts between components.
