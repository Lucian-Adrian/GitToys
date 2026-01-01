import * as vscode from 'vscode';
import { GitService } from '../git/gitService';

export class StatusBarManager implements vscode.Disposable {
  private changesItem: vscode.StatusBarItem;
  private syncItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(private gitService: GitService) {
    // Changes count item
    this.changesItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.changesItem.command = 'gittoys.openBulkCommit';
    this.changesItem.tooltip = 'GitToys: Open Bulk Commit';
    
    // Sync status item
    this.syncItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    this.syncItem.command = 'gittoys.openQuickActions';
    this.syncItem.tooltip = 'GitToys: Quick Actions';

    // Initial update
    this.update();

    // Show items
    this.changesItem.show();
    this.syncItem.show();

    // Listen for repo changes
    const repoDisposable = this.gitService.onDidChangeRepository(() => {
      this.update();
    });

    if (repoDisposable) {
      this.disposables.push(repoDisposable);
    }

    // Periodic update (every 5 seconds)
    const intervalId = setInterval(() => this.update(), 5000);
    this.disposables.push({ dispose: () => clearInterval(intervalId) });
  }

  update(): void {
    const repoInfo = this.gitService.getRepositoryInfo();
    
    if (!repoInfo) {
      this.changesItem.hide();
      this.syncItem.hide();
      return;
    }

    // Update changes count
    const changesCount = this.gitService.getChangesCount();
    if (changesCount.total > 0) {
      this.changesItem.text = `$(git-commit) ${changesCount.total}`;
      this.changesItem.tooltip = `GitToys: ${changesCount.total} changed file(s) (${changesCount.staged} staged, ${changesCount.unstaged} unstaged)`;
      this.changesItem.backgroundColor = undefined;
    } else {
      this.changesItem.text = `$(git-commit) 0`;
      this.changesItem.tooltip = 'GitToys: No changes';
    }
    this.changesItem.show();

    // Update sync status
    const syncStatus = this.gitService.getSyncStatus();
    if (syncStatus) {
      const parts: string[] = [];
      if (syncStatus.ahead > 0) {
        parts.push(`↑${syncStatus.ahead}`);
      }
      if (syncStatus.behind > 0) {
        parts.push(`↓${syncStatus.behind}`);
      }
      
      if (parts.length > 0) {
        this.syncItem.text = `$(sync) ${parts.join(' ')}`;
        this.syncItem.tooltip = `GitToys: ${syncStatus.ahead} to push, ${syncStatus.behind} to pull`;
      } else {
        this.syncItem.text = `$(sync) ✓`;
        this.syncItem.tooltip = 'GitToys: In sync with remote';
      }
      this.syncItem.show();
    } else {
      this.syncItem.text = `$(sync)`;
      this.syncItem.tooltip = 'GitToys: Quick Actions';
      this.syncItem.show();
    }
  }

  dispose(): void {
    this.changesItem.dispose();
    this.syncItem.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
