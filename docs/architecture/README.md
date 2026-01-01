# Architecture Documentation Index

Complete system documentation for GitToys extension v0.2.0.

## Quick Navigation

### Getting Started
- **New to the codebase?** → Start with `00-OVERVIEW.md`
- **Want to contribute?** → Read `08-DEVELOPMENT.md`
- **Building/packaging?** → See `07-BUILD_DEPLOYMENT.md`

### Component-Specific Docs

| Component | File | Purpose |
|-----------|------|---------|
| Extension Entry | `01-EXTENSION_ENTRY.md` | Commands, lifecycle, activation |
| Git Service | `02-GIT_SERVICE.md` | All git operations, API wrapper |
| Webview UI | `03-WEBVIEW.md` | Bulk Commit UI, rendering, state |
| Bulk Commit Panel | `04-BULK_COMMIT_PANEL.ts` | Webview lifecycle & IPC bridge |
| Configuration | `05-CONFIGURATION.md` | Settings, templates, keybindings |
| Views & Status Bar | `06-VIEWS_STATUS_BAR.md` | Tree views, status bar items |
| Build & Deploy | `07-BUILD_DEPLOYMENT.md` | Build process, packaging, CI/CD |
| Development | `08-DEVELOPMENT.md` | Contributing guide, setup, patterns |
| Types & Messages | `09-TYPES_MESSAGES.md` | Message protocol, type definitions |

## Key Concepts

### Single Responsibility
Each file/class does one thing:
- **GitService**: Git operations only
- **BulkCommitPanel**: Webview lifecycle only
- **StatusBarManager**: Status bar UI only
- **BulkCommitApp**: Webview rendering only

### Dependency Flow
```
extension.ts (main)
    ├── GitService (git ops)
    ├── BulkCommitPanel (panel)
    │   ├── GitService (shared)
    │   └── Webview (UI)
    ├── StatusBarManager (status)
    │   └── GitService (shared)
    ├── QuickActionsProvider (tree)
    │   └── GitService (shared)
    └── ToysTreeProvider (tree)
        └── GitService (shared)
```

### Data Flow
```
Git file changes (disk)
    ↓
VS Code Git API (onDidChangeRepository)
    ↓
GitService.onRepositoryChanged event
    ↓
Multiple listeners:
├─ StatusBarManager.refresh() → UI update
├─ QuickActionsProvider.refresh() → Tree update
└─ BulkCommitPanel.sendChangedFiles() → Webview message

User action in webview (click commit)
    ↓
Webview postMessage('commitFiles', ...)
    ↓
BulkCommitPanel receives message
    ↓
BulkCommitPanel calls GitService.bulkCommit()
    ↓
Result shown to user
    ↓
Refresh file list (back to top)
```

## File Structure Quick Reference

```
src/
├── extension.ts              # Main entry, command registration
├── git/
│   └── gitService.ts         # All git operations
├── types/
│   ├── git.ts                # VS Code Git API types
│   └── messages.ts           # IPC message types
├── views/
│   ├── toysTreeProvider.ts   # Main menu tree
│   ├── quickActionsProvider.ts # Quick actions with status
│   └── statusBarManager.ts   # Status bar items
└── toys/
    └── bulk-commit/
        └── bulkCommitPanel.ts # Webview panel controller

webview-ui/
├── bulkCommit.ts             # Bulk Commit UI app
└── bulkCommit.css            # Theme-aware styles
```

## Common Tasks

### I want to...

**...add a new git command**
1. Read: `02-GIT_SERVICE.md` → "Adding New Git Operations"
2. File: `src/git/gitService.ts` → Add method
3. File: `src/extension.ts` → Register command
4. File: `package.json` → Add command definition

**...add a new view**
1. Read: `08-DEVELOPMENT.md` → "Adding a New View"
2. Create: `src/views/myView.ts`
3. File: `src/extension.ts` → Register provider
4. File: `package.json` → Add view definition

**...modify the UI**
1. Read: `03-WEBVIEW.md` → "Event Listeners"
2. File: `webview-ui/bulkCommit.ts` → Modify logic
3. File: `webview-ui/bulkCommit.css` → Add styles
4. Run: `npm run build` and test

**...add a new setting**
1. Read: `05-CONFIGURATION.md` → "Adding New Settings"
2. File: `package.json` → Add to configuration
3. File: Loading component → Read with `vscode.workspace.getConfiguration()`
4. Optionally: Pass to webview if UI needs it

**...debug an issue**
1. Read: `08-DEVELOPMENT.md` → "Debugging Tips"
2. Set breakpoint, run F5 for Extension Dev Host
3. Check git state: `git status`, `git log`
4. Check browser console (F12)

**...release a new version**
1. Read: `07-BUILD_DEPLOYMENT.md` → "Release Checklist"
2. Follow checklist step-by-step
3. Test .vsix install
4. Commit and tag

## Technology Stack

| Layer | Tech | Details |
|-------|------|---------|
| **Hosting** | VS Code | Extension host |
| **Extension** | TypeScript | Type-safe extension code |
| **Git Integration** | VS Code Git API | No external git dependency |
| **UI** | Vanilla TS + HTML5 | No framework overhead |
| **Styling** | CSS | VS Code theme variables |
| **Build** | esbuild | Fast, dual-target bundling |
| **Package** | vsce | VSIX (.zip-based) format |

## Design Decisions

### Why Vanilla TypeScript (No Framework)?

**Rationale**:
- Minimal download size (~14 KB webview vs ~30+ KB with React)
- No runtime overhead
- Direct DOM control
- Portable (no npm install needed at runtime)

**Trade-off**: More boilerplate than React, but simpler codebase.

### Why Two Bundles?

**Rationale**:
- Extension runs in Node.js (needs CommonJS)
- Webview runs in browser (needs browser APIs)
- esbuild targets both simultaneously

**Alternative**: Single webpack config (more complex).

### Why Event-Driven Updates?

**Rationale**:
- Repository changes are rare (seconds between)
- No polling needed
- Responsive to user actions
- Simple state management (one-way flow)

**Alternative**: Polling every second (wasteful).

### Why No LLM Integration?

**Rationale**:
- User's commit messages are intentional
- AI guesses often wrong for specific contexts
- Privacy (no API calls needed)
- Deterministic behavior (no randomness)

**Future**: Could add optional LLM features behind setting.

## Testing Strategy

Current: Manual testing in Extension Dev Host (F5).

Future test setup:
```bash
npm install --save-dev jest ts-jest @types/jest
npm test  # Run all tests
npm run test:watch  # Watch mode
```

Test structure (future):
```
src/__tests__/
├── gitService.test.ts
├── bulkCommitPanel.test.ts
└── webview.test.ts
```

## Performance Baselines

- Extension activation: ~50 ms
- Webview load: ~100 ms
- Webview first render: ~150 ms
- File list refresh: <10 ms
- Status bar update: <5 ms

All well under perception threshold (<300 ms).

## Security Considerations

- **No eval()**: No dynamic code execution
- **No external requests**: Except git operations
- **HTML escaping**: All user data escaped in webview
- **Local resources only**: Assets bundled, not from CDN
- **No credentials**: Git auth handled by VS Code
- **No telemetry**: No data collection

## Accessibility

- Keyboard navigation (Tab, Enter, Escape)
- Screen reader support (semantic HTML, tooltips)
- Color not sole indicator (status badges have letters)
- High contrast support (uses VS Code theme)
- Configurable font sizes (inherited from editor)

## Maintenance

### Code Health
- **No `any` types**: Full TypeScript safety
- **No console output**: Use proper logging
- **No dead code**: Removed when features deleted
- **Comments**: On non-obvious logic only

### Dependencies
- **Zero runtime deps**: Only VS Code API
- **Minimal dev deps**: TypeScript, esbuild, @types/vscode
- **No abandoned packages**: All maintained

### Monitoring (Future)
- Error reporting (Sentry, etc)
- Usage telemetry (opt-in)
- Performance monitoring

## Contributing

1. Fork repository
2. Read `08-DEVELOPMENT.md`
3. Create feature branch
4. Follow code style (see patterns)
5. Test in Extension Dev Host
6. Submit PR

Requirements:
- Full TypeScript types
- No `any` types
- All code changes tested manually
- Commit messages referencing issue #123

## Support & Questions

- **VS Code API**: https://code.visualstudio.com/api
- **TypeScript**: https://www.typescriptlang.org/docs
- **Git Concepts**: https://git-scm.com/doc
- **esbuild**: https://esbuild.github.io/

## Document Maintenance

Updated: January 2026, v0.2.0

These docs reflect current state. Update when:
- Adding new major feature
- Restructuring code
- Changing architecture pattern
- Every minor version bump

Keep in sync with actual code via:
- Code reviews
- Comment in PRs when docs need update
- Regular audits (quarterly)

---

**Total Documented**: ~2,000 lines across 10 files  
**Coverage**: All major components and workflows  
**Audience**: Developers extending GitToys
