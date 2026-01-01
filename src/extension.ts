import * as vscode from 'vscode';
import { GitService } from './git/gitService';
import { BulkCommitPanel } from './toys/bulk-commit/bulkCommitPanel';
import { ToysTreeProvider } from './views/toysTreeProvider';
import { QuickActionsProvider } from './views/quickActionsProvider';
import { StatusBarManager } from './views/statusBarManager';

let gitService: GitService;
let statusBarManager: StatusBarManager | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log('GitToys is now active!');

  // Initialize Git Service
  gitService = new GitService();
  const initialized = await gitService.initialize();
  
  if (!initialized) {
    vscode.window.showWarningMessage('GitToys: Could not initialize Git. Some features may not work.');
  }

  // Register the Toys Tree View
  const toysProvider = new ToysTreeProvider();
  vscode.window.registerTreeDataProvider('gittoys.toysView', toysProvider);

  // Register Quick Actions Tree View
  const quickActionsProvider = new QuickActionsProvider(gitService);
  vscode.window.registerTreeDataProvider('gittoys.quickActionsView', quickActionsProvider);

  // Initialize Status Bar
  const config = vscode.workspace.getConfiguration('gittoys');
  if (config.get('quickActions.showInStatusBar', true)) {
    statusBarManager = new StatusBarManager(gitService);
    context.subscriptions.push(statusBarManager);
  }

  // ===== COMMANDS =====

  // Open Bulk Commit Panel
  const openBulkCommitCmd = vscode.commands.registerCommand('gittoys.openBulkCommit', () => {
    BulkCommitPanel.createOrShow(context.extensionUri, gitService);
  });

  // Refresh
  const refreshCmd = vscode.commands.registerCommand('gittoys.refreshBulkCommit', () => {
    if (BulkCommitPanel.currentPanel) {
      BulkCommitPanel.currentPanel.refresh();
    }
    toysProvider.refresh();
    quickActionsProvider.refresh();
    statusBarManager?.update();
  });

  // Open Quick Actions
  const openQuickActionsCmd = vscode.commands.registerCommand('gittoys.openQuickActions', async () => {
    const syncStatus = gitService.getSyncStatus();
    const changesCount = gitService.getChangesCount();
    
    const actions = [
      { 
        label: '$(cloud-upload) Push', 
        description: syncStatus ? `${syncStatus.ahead} commit(s) ahead` : 'Push to remote', 
        action: 'push' 
      },
      { 
        label: '$(cloud-download) Pull', 
        description: syncStatus ? `${syncStatus.behind} commit(s) behind` : 'Pull from remote', 
        action: 'pull' 
      },
      { label: '$(sync) Fetch', description: 'Fetch from remote', action: 'fetch' },
      { label: '$(discard) Undo Last Commit', description: 'Soft reset last commit', action: 'undo' },
      { 
        label: '$(git-commit) Bulk Commit', 
        description: `${changesCount.total} file(s) changed`, 
        action: 'bulk' 
      },
    ];

    const selected = await vscode.window.showQuickPick(actions, {
      placeHolder: 'Select a Git action',
      title: 'GitToys Quick Actions'
    });

    if (selected) {
      switch (selected.action) {
        case 'push':
          vscode.commands.executeCommand('gittoys.pushChanges');
          break;
        case 'pull':
          vscode.commands.executeCommand('gittoys.pullChanges');
          break;
        case 'fetch':
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'GitToys: Fetching...',
            cancellable: false
          }, async () => {
            const result = await gitService.fetch();
            if (result.success) {
              vscode.window.showInformationMessage('GitToys: Fetch complete');
              statusBarManager?.update();
            } else {
              vscode.window.showErrorMessage(`GitToys: Fetch failed - ${result.error}`);
            }
          });
          break;
        case 'undo':
          vscode.commands.executeCommand('gittoys.undoLastCommit');
          break;
        case 'bulk':
          vscode.commands.executeCommand('gittoys.openBulkCommit');
          break;
      }
    }
  });

  // Push Changes
  const pushCmd = vscode.commands.registerCommand('gittoys.pushChanges', async () => {
    const syncStatus = gitService.getSyncStatus();
    if (syncStatus && syncStatus.ahead === 0) {
      vscode.window.showInformationMessage('GitToys: Nothing to push');
      return;
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'GitToys: Pushing changes...',
      cancellable: false
    }, async () => {
      const result = await gitService.push();
      if (result.success) {
        vscode.window.showInformationMessage('GitToys: Push successful');
        statusBarManager?.update();
        quickActionsProvider.refresh();
      } else {
        vscode.window.showErrorMessage(`GitToys: Push failed - ${result.error}`);
      }
    });
  });

  // Pull Changes
  const pullCmd = vscode.commands.registerCommand('gittoys.pullChanges', async () => {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'GitToys: Pulling changes...',
      cancellable: false
    }, async () => {
      const result = await gitService.pull();
      if (result.success) {
        vscode.window.showInformationMessage('GitToys: Pull successful');
        statusBarManager?.update();
        quickActionsProvider.refresh();
        if (BulkCommitPanel.currentPanel) {
          BulkCommitPanel.currentPanel.refresh();
        }
      } else {
        vscode.window.showErrorMessage(`GitToys: Pull failed - ${result.error}`);
      }
    });
  });

  // Undo Last Commit
  const undoCmd = vscode.commands.registerCommand('gittoys.undoLastCommit', async () => {
    const commits = await gitService.getRecentCommits(1);
    if (commits.length === 0) {
      vscode.window.showWarningMessage('GitToys: No commits to undo');
      return;
    }

    const lastCommit = commits[0];
    const confirm = await vscode.window.showWarningMessage(
      `Undo commit: "${lastCommit.message.substring(0, 50)}${lastCommit.message.length > 50 ? '...' : ''}"?`,
      { modal: true },
      'Undo Commit'
    );

    if (confirm === 'Undo Commit') {
      const result = await gitService.undoLastCommit();
      if (result.success) {
        vscode.window.showInformationMessage('GitToys: Last commit undone. Changes are now staged.');
        if (BulkCommitPanel.currentPanel) {
          BulkCommitPanel.currentPanel.refresh();
        }
        statusBarManager?.update();
        quickActionsProvider.refresh();
      } else {
        vscode.window.showErrorMessage(`GitToys: Failed to undo commit - ${result.error}`);
      }
    }
  });

  // Apply Template command (for bulk commit panel)
  const applyTemplateCmd = vscode.commands.registerCommand('gittoys.applyTemplate', async () => {
    const templates = config.get<Array<{ name: string; template: string; description: string }>>('bulkCommit.templates', []);

    if (templates.length === 0) {
      vscode.window.showWarningMessage('GitToys: No commit templates configured');
      return;
    }

    const items = templates.map(t => ({
      label: t.name,
      description: t.description,
      template: t.template
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a commit template',
      title: 'Commit Templates'
    });

    if (selected && BulkCommitPanel.currentPanel) {
      BulkCommitPanel.currentPanel.applyTemplate(selected.template);
    }
  });

  // Listen for active editor changes to update repository context
  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
    if (BulkCommitPanel.currentPanel) {
      BulkCommitPanel.currentPanel.refresh();
    }
    quickActionsProvider.refresh();
    statusBarManager?.update();
  });

  // Listen for Git state changes
  const repoChangeDisposable = gitService.onDidChangeRepository(() => {
    quickActionsProvider.refresh();
    statusBarManager?.update();
  });

  context.subscriptions.push(
    openBulkCommitCmd,
    refreshCmd,
    openQuickActionsCmd,
    pushCmd,
    pullCmd,
    undoCmd,
    applyTemplateCmd,
    editorChangeDisposable
  );

  if (repoChangeDisposable) {
    context.subscriptions.push(repoChangeDisposable);
  }

  // Show welcome message on first activation
  const hasShownWelcome = context.globalState.get('gittoys.welcomeShown');
  if (!hasShownWelcome) {
    const action = await vscode.window.showInformationMessage(
      'Welcome to GitToys! Use Ctrl+Shift+G B to open Bulk Commit, or Ctrl+Shift+G Q for Quick Actions.',
      'Open Bulk Commit',
      'Quick Actions'
    );
    if (action === 'Open Bulk Commit') {
      vscode.commands.executeCommand('gittoys.openBulkCommit');
    } else if (action === 'Quick Actions') {
      vscode.commands.executeCommand('gittoys.openQuickActions');
    }
    context.globalState.update('gittoys.welcomeShown', true);
  }
}

export function deactivate() {
  console.log('GitToys is now deactivated.');
}
