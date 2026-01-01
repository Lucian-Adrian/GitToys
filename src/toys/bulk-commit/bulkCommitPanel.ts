import * as vscode from 'vscode';
import { GitService } from '../../git/gitService';
import { WebviewMessage, ExtensionMessage, FileInfo, RepoInfo, BulkCommitResultInfo } from '../../types/messages';

interface CommitTemplate {
  name: string;
  template: string;
  description: string;
}

export class BulkCommitPanel {
  public static currentPanel: BulkCommitPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _gitService: GitService;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, gitService: GitService) {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    // If we already have a panel, show it
    if (BulkCommitPanel.currentPanel) {
      BulkCommitPanel.currentPanel._panel.reveal(column);
      BulkCommitPanel.currentPanel.refresh();
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'gitToysBulkCommit',
      'GitToys: Bulk Commit',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'resources')
        ]
      }
    );

    BulkCommitPanel.currentPanel = new BulkCommitPanel(panel, extensionUri, gitService);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, gitService: GitService) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._gitService = gitService;

    // Set the webview's initial html content
    this._panel.webview.html = this._getHtmlForWebview();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );

    // Listen for repository changes
    const repoChangeDisposable = this._gitService.onDidChangeRepository(() => {
      this.refresh();
    });
    if (repoChangeDisposable) {
      this._disposables.push(repoChangeDisposable);
    }
  }

  public async refresh() {
    await this._sendChangedFiles();
  }

  /**
   * Apply a commit template prefix to all selected files
   */
  public applyTemplate(template: string) {
    this._postMessage({ type: 'applyTemplate', template });
  }

  private async _handleMessage(message: WebviewMessage) {
    switch (message.command) {
      case 'ready':
      case 'getChangedFiles':
      case 'refresh':
        await this._sendChangedFiles();
        break;

      case 'commitFiles':
        await this._commitFiles(message.commits);
        break;

      case 'openDiff':
        await this._gitService.openDiff(message.filePath);
        break;

      case 'stageFile':
        await this._gitService.stageFiles([message.filePath]);
        await this._sendChangedFiles();
        break;

      case 'unstageFile':
        await this._gitService.unstageFiles([message.filePath]);
        await this._sendChangedFiles();
        break;

      case 'getTemplates':
        this._sendTemplates();
        break;

      case 'pushChanges':
        await this._pushAfterCommit();
        break;
    }
  }

  private _sendTemplates() {
    const config = vscode.workspace.getConfiguration('gittoys');
    const templates = config.get<CommitTemplate[]>('bulkCommit.templates', []);
    this._postMessage({ type: 'templates', templates });
  }

  private async _pushAfterCommit() {
    const result = await this._gitService.push();
    if (result.success) {
      vscode.window.showInformationMessage('GitToys: Push successful');
    } else {
      vscode.window.showErrorMessage(`GitToys: Push failed - ${result.error}`);
    }
  }

  private async _sendChangedFiles() {
    try {
      this._postMessage({ type: 'loading', loading: true });

      const files = await this._gitService.getChangedFiles();
      const repoInfo = this._gitService.getRepositoryInfo();

      const fileInfos: FileInfo[] = files.map(f => ({
        path: f.path,
        relativePath: f.relativePath,
        status: f.status,
        staged: f.staged,
        uri: f.uri
      }));

      const repoInfoMsg: RepoInfo | null = repoInfo ? {
        name: repoInfo.name,
        branch: repoInfo.branch,
        rootPath: repoInfo.rootPath
      } : null;

      // Also send templates and settings
      const config = vscode.workspace.getConfiguration('gittoys');
      const templates = config.get<CommitTemplate[]>('bulkCommit.templates', []);
      const pushAfterCommit = config.get<boolean>('bulkCommit.pushAfterCommit', false);
      const confirmBeforeCommit = config.get<boolean>('bulkCommit.confirmBeforeCommit', true);

      this._postMessage({ 
        type: 'changedFiles', 
        files: fileInfos, 
        repoInfo: repoInfoMsg,
        templates,
        settings: { pushAfterCommit, confirmBeforeCommit }
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this._postMessage({ type: 'error', message: errorMsg });
    } finally {
      this._postMessage({ type: 'loading', loading: false });
    }
  }

  private async _commitFiles(commits: { filePath: string; message: string }[]) {
    if (commits.length === 0) {
      vscode.window.showWarningMessage('No files selected for commit.');
      return;
    }

    // Confirmation dialog
    const config = vscode.workspace.getConfiguration('gittoys');
    const confirmBeforeCommit = config.get<boolean>('bulkCommit.confirmBeforeCommit', true);
    
    if (confirmBeforeCommit) {
      const confirm = await vscode.window.showWarningMessage(
        `Create ${commits.length} commit(s)?`,
        { modal: true },
        'Commit'
      );
      if (confirm !== 'Commit') {
        return;
      }
    }

    // Filter out commits without messages
    const validCommits = commits.filter(c => c.message.trim().length > 0);
    if (validCommits.length === 0) {
      vscode.window.showWarningMessage('All selected files need commit messages.');
      return;
    }

    try {
      this._postMessage({ type: 'loading', loading: true });

      const result = await this._gitService.bulkCommit(validCommits);

      const resultInfo: BulkCommitResultInfo = {
        successful: result.successful.length,
        failed: result.failed.length,
        total: result.totalCommits,
        errors: result.failed.map(f => `${f.filePath}: ${f.error}`)
      };

      this._postMessage({ type: 'commitResult', result: resultInfo });

      if (result.successful.length > 0) {
        vscode.window.showInformationMessage(
          `GitToys: Successfully created ${result.successful.length} commit(s).`
        );
        
        // Auto-push if configured
        const config = vscode.workspace.getConfiguration('gittoys');
        if (config.get<boolean>('bulkCommit.pushAfterCommit', false)) {
          await this._pushAfterCommit();
        }
      }

      if (result.failed.length > 0) {
        vscode.window.showErrorMessage(
          `GitToys: Failed to commit ${result.failed.length} file(s).`
        );
      }

      // Refresh the file list after committing
      await this._sendChangedFiles();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this._postMessage({ type: 'error', message: errorMsg });
      vscode.window.showErrorMessage(`GitToys: ${errorMsg}`);
    } finally {
      this._postMessage({ type: 'loading', loading: false });
    }
  }

  private _postMessage(message: ExtensionMessage) {
    this._panel.webview.postMessage(message);
  }

  private _getHtmlForWebview(): string {
    const webview = this._panel.webview;

    // Get resource URIs
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'bulkCommit.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'bulkCommit.css')
    );

    // Use a nonce to only allow specific scripts to run
    const nonce = this._getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <title>Bulk Commit</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="app">
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public dispose() {
    BulkCommitPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
