# Configuration & Settings

**Files**: `package.json`, User settings  
**Type**: Configuration schema  
**Size**: Defined in package.json  

## Settings Structure

All settings prefixed with `gittoys.*` in VS Code settings.

### Bulk Commit Settings

**`gittoys.bulkCommit.templates`**
- Type: `object[]`
- Default: `[]`
- Schema:
  ```typescript
  {
    name: string;           // Display name (e.g., "Feature")
    template: string;       // Template text (e.g., "feat: ")
    description?: string;   // Hover tooltip
  }
  ```
- Usage: Buttons in webview UI
- Example:
  ```json
  [
    { "name": "Feature", "template": "feat: " },
    { "name": "Bug Fix", "template": "fix: " },
    { "name": "Docs", "template": "docs: " }
  ]
  ```

**`gittoys.bulkCommit.pushAfterCommit`**
- Type: `boolean`
- Default: `false`
- Effect: Auto-push after bulk commit completes
- When enabled, flow is: Stage → Commit → Push
- User can still disable per-session via webview setting

**`gittoys.bulkCommit.confirmBeforeCommit`**
- Type: `boolean`
- Default: `true`
- Effect: Show "Are you sure?" dialog before committing
- Prevents accidental bulk commits

**`gittoys.bulkCommit.autoStage`**
- Type: `boolean`
- Default: `true`
- Effect: Automatically stage files before committing
- If false, user must stage files manually in VS Code

**`gittoys.bulkCommit.showDiffOnSelect`**
- Type: `boolean`
- Default: `false`
- Effect: Auto-open diff when file selected
- Useful for review before writing message

## Keyboard Shortcut Configuration

In `package.json` `keybindings`:

```json
{
  "command": "gittoys.bulkCommit.open",
  "key": "ctrl+shift+g b",
  "mac": "cmd+shift+g b"
}
```

Format: `[ctrl/cmd] + [shift] + [key]`

All bindings start with `ctrl+shift+g` for namespace collision prevention.

### Default Bindings

| Command | Windows/Linux | macOS |
|---------|--------------|-------|
| Bulk Commit | `Ctrl+Shift+G B` | `Cmd+Shift+G B` |
| Quick Actions | `Ctrl+Shift+G Q` | `Cmd+Shift+G Q` |
| Push | `Ctrl+Shift+G P` | `Cmd+Shift+G P` |
| Pull | `Ctrl+Shift+G L` | `Cmd+Shift+G L` |
| Undo Last Commit | `Ctrl+Shift+G Z` | `Cmd+Shift+G Z` |

Users can override in `keybindings.json`:
```json
{
  "command": "gittoys.bulkCommit.open",
  "key": "ctrl+b"
}
```

## Loading Settings at Runtime

```typescript
// In BulkCommitPanel
const config = vscode.workspace.getConfiguration('gittoys');

// Get specific value
const pushAfterCommit = config.get('bulkCommit.pushAfterCommit', false);

// Get all templates
const templates = config.get('bulkCommit.templates', []);

// Get nested value
const confirmBefore = config.get('bulkCommit.confirmBeforeCommit', true);
```

## Scope Levels

Settings can be configured at different scopes:

1. **User**: Applies globally to all workspaces
2. **Workspace**: Applies to `.code-workspace` file
3. **Workspace Folder**: Applies to `.vscode/settings.json` in folder

VS Code merges them: Workspace Folder > Workspace > User

Recommended: Store templates at User level.

## Configuration Schema (package.json)

```json
"configuration": {
  "title": "GitToys",
  "properties": {
    "gittoys.bulkCommit.templates": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "template": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["name", "template"]
      },
      "default": [],
      "description": "Custom commit message templates"
    },
    "gittoys.bulkCommit.pushAfterCommit": {
      "type": "boolean",
      "default": false,
      "description": "Automatically push after bulk commit"
    },
    // ... more settings
  }
}
```

## Environment Variables

None currently used. Could add in future for:
- Git executable path
- Default commit options
- UI theme overrides

## Adding New Settings

1. Add property to `configuration.properties` in package.json
2. Define type, default, description
3. Update type definitions if needed
4. Load in relevant component:
   - BulkCommitPanel: sends to webview
   - StatusBarManager: uses for behavior
   - Commands: read directly if single-use

5. If user-facing, document in README.md

## Settings Validation

VS Code validates against JSON schema automatically.
- Type mismatches rejected
- Required properties enforced
- Default applied if missing

No runtime validation needed.

## UI for Settings

Users access settings via:
- `Ctrl+,` → Settings UI
- Search "GitToys"
- Click settings
- Or edit `settings.json` directly

Settings UI auto-generated from schema.

## Template Syntax

Templates are literal strings prepended to commit message.
No special syntax support yet (future enhancement):
- `{FILENAME}` could expand to file name
- `{DATE}` could expand to date
- Conditional logic

Current: Simple string templates.

## Best Practices for Users

1. **Templates**: Keep short (prefix only)
   - ✅ `"feat: "`
   - ❌ `"Feature that adds something new"`

2. **Auto-push**: Only enable if you push to main often
   - Risk: Pushing broken code if you don't review commits

3. **Confirm**: Keep enabled for safety
   - Only disable if you bulk commit frequently

## Troubleshooting

**Settings not applying**: 
- Reload VS Code window (`Cmd+R` or `Ctrl+Shift+F5`)

**Templates not showing**: 
- Check JSON syntax in settings.json
- Verify `gittoys.bulkCommit.templates` exists

**Shortcut conflicts**: 
- Check `keybindings.json` for duplicate bindings
- Use Command Palette to check current binding
