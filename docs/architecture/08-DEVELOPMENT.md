# Development Guide

**Target**: Developers extending GitToys  
**Updated**: v0.2.0  

## Setting Up Development Environment

### Prerequisites

- Node.js 16+ (LTS recommended)
- VS Code 1.85+
- Git installed and in PATH
- Familiarity with TypeScript

### Clone & Setup

```bash
git clone <repo-url> gittoys
cd gittoys
npm install
npm run build
```

### IDE Configuration

**VS Code Extensions** (recommended):
- ESLint (for code quality)
- Prettier (for formatting)
- TypeScript (built-in)
- GitLens (understand git context)

**Workspace Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## Common Development Tasks

### Adding a New Git Command

1. **Add to GitService** (`src/git/gitService.ts`):
```typescript
async myNewCommand(): Promise<ResultType> {
  try {
    // Implement using repository API
    return result;
  } catch (error) {
    throw new GitError('myNewCommand', stderr, message);
  }
}
```

2. **Define Result Type** (`src/types/git.ts`):
```typescript
export interface MyResult {
  success: boolean;
  // ... fields
}
```

3. **Register Command** (in `src/extension.ts` `activate()`):
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('gittoys.myNewCommand', async () => {
    try {
      const result = await gitService.myNewCommand();
      vscode.window.showInformationMessage(`Success: ${result}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
  })
);
```

4. **Add to package.json**:
```json
"commands": [
  {
    "command": "gittoys.myNewCommand",
    "title": "My New Command"
  }
]
```

### Adding a New View

1. **Create Provider** (`src/views/myViewProvider.ts`):
```typescript
import * as vscode from 'vscode';

export class MyViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private emitter = new vscode.EventEmitter<void>();
  onDidChangeTreeData = this.emitter.event;
  
  constructor(private gitService: GitService) {
    this.gitService.onRepositoryChanged(() => {
      this.emitter.fire();
    });
  }
  
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  
  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) return [];
    return [/* root items */];
  }
}
```

2. **Register in extension.ts**:
```typescript
const provider = new MyViewProvider(gitService);
vscode.window.registerTreeDataProvider('gittoys.myView', provider);
```

3. **Add to package.json**:
```json
"views": {
  "gittoys": [
    {
      "id": "gittoys.myView",
      "name": "My View",
      "type": "tree"
    }
  ]
}
```

### Modifying Webview UI

1. **Edit webview code** (`webview-ui/bulkCommit.ts`):
```typescript
private setupNewFeature(): void {
  // Add event listeners, state changes
}
```

2. **Add CSS** (`webview-ui/bulkCommit.css`):
```css
.new-feature {
  /* Use VS Code CSS vars */
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}
```

3. **Rebuild & test**:
```bash
npm run build
# F5 to run in Extension Dev Host
```

## Testing Locally

### Running Extension Dev Host

Press `F5` or:
```bash
npm run build
code --extensionDevelopmentPath=. <test-workspace>
```

Opens new VS Code window with extension loaded from `dist/` folder.

### Debug Mode

In Extension Dev Host:
- Set breakpoints (red dot on line number)
- F5 to continue, F10 to step over, F11 to step into
- Inspect variables in Debug Console
- Hot reload on file save (requires rebuild)

### Testing Bulk Commit

1. Open workspace with git repo
2. Make file changes (`touch file.txt`, edit existing)
3. Run: `Ctrl+Shift+G B` (Bulk Commit)
4. Select files, write messages
5. Click Commit

Check git log: `git log --oneline -n 5`

### Testing Status Bar

1. Make changes → Status bar shows count
2. Create commit → Count decreases
3. Make local commit → Sync status shows ahead

## Code Structure Guidelines

### File Naming

- Classes: PascalCase.ts (`BulkCommitPanel.ts`)
- Functions/exports: camelCase.ts (`gitService.ts`)
- Constants: UPPER_SNAKE_CASE
- Types/Interfaces: PascalCase

### Class Structure

```typescript
export class MyClass {
  // 1. Static properties
  static readonly DEFAULT_VALUE = 100;
  
  // 2. Private properties
  private disposables: Disposable[] = [];
  
  // 3. Constructor
  constructor(private service: Service) {}
  
  // 4. Public methods
  public async publicMethod(): Promise<void> {}
  
  // 5. Private methods
  private privateMethod(): void {}
  
  // 6. Event emitters
  private emitter = new EventEmitter<void>();
  public onDidChange = this.emitter.event;
}
```

### Error Handling

```typescript
// ✅ Specific error types
try {
  return await gitService.commit();
} catch (error) {
  if (error instanceof GitError) {
    vscode.window.showErrorMessage(error.message);
  } else {
    vscode.window.showErrorMessage('Unknown error');
  }
}

// ❌ Avoid
catch (error: any) {
  console.log(error);  // No user feedback
}
```

## Type Safety

No `any` types except in specific cases (documented with `@ts-ignore` comment).

```typescript
// ✅ Good
function process(data: string): number {
  return data.length;
}

// ❌ Bad
function process(data: any): any {
  return data;
}
```

## Testing (Future)

When adding tests:
```bash
npm install --save-dev jest ts-jest @types/jest
```

Test file: `src/__tests__/gitService.test.ts`

Run: `npm test`

## Performance Considerations

1. **Avoid blocking operations in UI thread**
   - Use `async/await` for git operations
   - Never `fs.readFileSync()` in extension code

2. **Minimize re-renders in webview**
   - Only re-render on state change
   - Use `saveState()` to avoid duplicate renders

3. **Cache expensive operations**
   - File list: query on demand (already git-cached)
   - Repo info: cache until repo change event

## Documentation

When adding features, update:
- This file (DEVELOPMENT.md) if procedural
- Relevant architecture doc if architectural
- Code comments for non-obvious logic
- README.md for user-facing features

## Common Mistakes

1. **Forgetting to register command**: Command defined but not in `activate()`
   - Fix: Add `context.subscriptions.push(registerCommand(...))`

2. **Not disposing resources**: Memory leaks from listeners
   - Fix: Always add to `context.subscriptions` or manual `dispose()`

3. **Async without await**: Promise hangs silently
   - Fix: Always `await` or handle `.catch()`

4. **Type mismatches**: `any` or wrong interface
   - Fix: Check types match exactly (including nullability)

5. **Webview asset paths wrong**: Assets 404
   - Fix: Use `webview.asWebviewUri()` for asset paths

## Debugging Tips

**Check extension logs**:
```
View → Output → GitToys (from dropdown)
```

**Check webview console**:
Press F12 in extension, then Escape to see webview DevTools.

**Check repository state**:
```bash
git status
git log --oneline -n 5
```

**Use console.log**:
```typescript
console.log('Debug:', value);  // Shows in Output → GitToys
```

## Release Process

See `BUILD_DEPLOYMENT.md` for full checklist and commands.

Quick version:
1. Update version in `package.json`
2. Run `npm run build`
3. Test in Extension Dev Host
4. Run `npm run vscode:prepublish`
5. Run `npx vsce package --allow-missing-repository`
6. Install from VSIX to test one more time
7. Commit and tag

## Getting Help

- VS Code API: https://code.visualstudio.com/api
- TypeScript: https://www.typescriptlang.org/docs
- Git: https://git-scm.com/doc
- esbuild: https://esbuild.github.io/

Read existing code first - most patterns already implemented.
