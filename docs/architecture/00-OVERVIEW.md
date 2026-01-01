# GitToys Architecture Overview

## Project Summary

**GitToys** is a VS Code extension for powerful, portable Git workflow automation with bulk commit support. Designed for developers who need fine-grained control over commits across multiple files.

**Platform**: VS Code Extension  
**Language**: TypeScript  
**Version**: 0.2.0  
**License**: MIT  
**Size**: ~17KB packaged  

## Core Value Proposition

- **Bulk Commits**: Commit each file individually with separate, meaningful messages
- **Portable**: Single .vsix file, USB-runnable, zero external dependencies
- **Keyboard-First**: Optimized for terminal-like workflows
- **Template-Driven**: Reusable commit message templates
- **Zero LLM**: Pure deterministic Git operations

## System Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  VS Code UI Layer                                        │
│  - Activity Bar (GitToys icon)                          │
│  - Views (Quick Actions, Git Toys)                      │
│  - Status Bar (Changes count, sync status)              │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  Extension Layer (src/extension.ts)                     │
│  - Command Registration & Dispatch                      │
│  - View Providers (Tree views)                          │
│  - Event Handlers                                       │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  Service Layer                                           │
│  ┌─────────────────────────────────────────────────────┐
│  │ GitService (src/git/gitService.ts)                  │
│  │ - Wraps VS Code's Git extension API                 │
│  │ - All Git operations (commit, push, pull, etc)      │
│  └─────────────────────────────────────────────────────┘
│  ┌─────────────────────────────────────────────────────┐
│  │ StatusBarManager (src/views/statusBarManager.ts)    │
│  │ - Manages status bar items                          │
│  └─────────────────────────────────────────────────────┘
│  ┌─────────────────────────────────────────────────────┐
│  │ BulkCommitPanel (src/toys/bulk-commit/)             │
│  │ - Webview panel lifecycle & IPC                     │
│  └─────────────────────────────────────────────────────┘
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  Webview Layer (webview-ui/)                            │
│  - Rich UI with TypeScript (no framework)               │
│  - Event listeners & state management                   │
│  - Theme-aware CSS with VS Code vars                    │
└─────────────────────────────────────────────────────────┘
```

## Key Directories

```
GitToys/
├── src/                          # Extension source (Node.js)
│   ├── extension.ts              # Main entry point
│   ├── git/
│   │   └── gitService.ts         # Git API wrapper
│   ├── toys/
│   │   └── bulk-commit/
│   │       └── bulkCommitPanel.ts# Webview panel controller
│   ├── views/
│   │   ├── toysTreeProvider.ts   # Main menu tree view
│   │   ├── quickActionsProvider.ts# Quick actions tree
│   │   └── statusBarManager.ts   # Status bar items
│   └── types/
│       ├── git.ts                # Git API types
│       └── messages.ts           # IPC message types
│
├── webview-ui/                   # Webview source (Browser)
│   ├── bulkCommit.ts             # BulkCommitApp class
│   └── bulkCommit.css            # Styles (theme-aware)
│
├── dist/                         # Build output (compiled)
│   ├── extension.js              # Extension bundle
│   └── webview/
│       ├── bulkCommit.js         # Webview bundle
│       └── bulkCommit.css        # Processed styles
│
├── docs/                         # Documentation
│   └── architecture/             # This folder
│
├── package.json                  # Manifest & dependencies
├── tsconfig.json                 # TypeScript config
├── esbuild.js                    # Build script (dual targets)
└── README.md                     # User docs
```

## Data Flow

### Bulk Commit Flow
```
User clicks "Bulk Commit" command
        ↓
Extension creates BulkCommitPanel webview
        ↓
GitService.getChangedFiles() → retrieves file list
        ↓
Webview renders file list with search/filters
        ↓
User selects files & writes messages
        ↓
Webview sends "commitFiles" message to extension
        ↓
GitService.bulkCommit() processes each file
        ↓
On success: clear messages, refresh file list
On error: display error dialog
```

### Status Updates
```
Repository changes detected (file system)
        ↓
VS Code Git API emits onDidChangeRepository event
        ↓
StatusBarManager refreshes status bar
        ↓
Webview receives changedFiles message
        ↓
State updates and re-renders
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Extension Host** | VS Code API | Git integration, commands, UI |
| **Extension Code** | TypeScript | Type-safe Git operations |
| **Build** | esbuild | Dual-target bundling (Node + Browser) |
| **Webview** | Vanilla TS + HTML5 | Lightweight, zero-dependency UI |
| **Styling** | CSS + VS Code vars | Theme-aware, native feel |
| **Storage** | VS Code Settings API | User config persistence |

## Extension Lifecycle

1. **Activation** (lazy): When user opens workspace with git repo
2. **Initialization**: 
   - Register all commands
   - Create view providers
   - Initialize status bar
3. **Running**: Respond to user commands & git events
4. **Cleanup**: Dispose resources on deactivation

## Design Principles

1. **Single Responsibility**: Each class handles one concern
2. **Dependency Injection**: Explicit dependencies in constructors
3. **Type Safety**: Full TypeScript, no `any` types
4. **Portability**: No native modules or external tools
5. **Performance**: Minimal re-renders, efficient git queries
6. **Accessibility**: Theme-aware, keyboard-navigable

See specific architecture docs for implementation details.
