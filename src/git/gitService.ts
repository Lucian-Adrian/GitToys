import * as vscode from 'vscode';
import { API, GitExtension, Repository, Change, Status } from '../types/git';

export interface FileChange {
  path: string;
  relativePath: string;
  status: FileStatus;
  staged: boolean;
  uri: string;
}

export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';

export interface CommitTask {
  filePath: string;
  message: string;
}

export interface CommitResult {
  success: boolean;
  filePath: string;
  message?: string;
  error?: string;
}

export interface BulkCommitResult {
  successful: CommitResult[];
  failed: CommitResult[];
  totalCommits: number;
}

export class GitService {
  private api: API | undefined;

  constructor() {}

  /**
   * Initialize the Git API from VS Code's built-in Git extension
   */
  async initialize(): Promise<boolean> {
    try {
      const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
      
      if (!gitExtension) {
        vscode.window.showErrorMessage('Git extension not found. Please ensure Git is installed.');
        return false;
      }

      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }

      this.api = gitExtension.exports.getAPI(1);
      return true;
    } catch (error) {
      console.error('Failed to initialize Git API:', error);
      return false;
    }
  }

  /**
   * Get the active repository (first one, or the one containing the active file)
   */
  getActiveRepository(): Repository | undefined {
    if (!this.api || this.api.repositories.length === 0) {
      return undefined;
    }

    // If there's an active editor, try to find its repository
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const repo = this.api.getRepository(activeEditor.document.uri);
      if (repo) {
        return repo;
      }
    }

    // Fall back to the first repository
    return this.api.repositories[0];
  }

  /**
   * Get all available repositories
   */
  getRepositories(): Repository[] {
    return this.api?.repositories || [];
  }

  /**
   * Convert VS Code Git Status to our FileStatus
   */
  private convertStatus(status: Status): FileStatus {
    switch (status) {
      case Status.INDEX_MODIFIED:
      case Status.MODIFIED:
        return 'modified';
      case Status.INDEX_ADDED:
      case Status.UNTRACKED:
      case Status.INTENT_TO_ADD:
        return 'added';
      case Status.INDEX_DELETED:
      case Status.DELETED:
        return 'deleted';
      case Status.INDEX_RENAMED:
      case Status.INDEX_COPIED:
        return 'renamed';
      case Status.ADDED_BY_US:
      case Status.ADDED_BY_THEM:
      case Status.DELETED_BY_US:
      case Status.DELETED_BY_THEM:
      case Status.BOTH_ADDED:
      case Status.BOTH_DELETED:
      case Status.BOTH_MODIFIED:
        return 'conflicted';
      default:
        return 'modified';
    }
  }

  /**
   * Check if a status represents a staged file
   */
  private isStaged(status: Status): boolean {
    return status === Status.INDEX_MODIFIED ||
           status === Status.INDEX_ADDED ||
           status === Status.INDEX_DELETED ||
           status === Status.INDEX_RENAMED ||
           status === Status.INDEX_COPIED;
  }

  /**
   * Get all changed files in the repository
   */
  async getChangedFiles(repo?: Repository): Promise<FileChange[]> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return [];
    }

    const rootPath = repository.rootUri.fsPath;
    const changes: FileChange[] = [];

    // Get working tree changes (unstaged)
    for (const change of repository.state.workingTreeChanges) {
      changes.push({
        path: change.uri.fsPath,
        relativePath: this.getRelativePath(change.uri.fsPath, rootPath),
        status: this.convertStatus(change.status),
        staged: false,
        uri: change.uri.toString()
      });
    }

    // Get index changes (staged)
    for (const change of repository.state.indexChanges) {
      // Check if this file is already in the list (can have both staged and unstaged changes)
      const existingIndex = changes.findIndex(c => c.path === change.uri.fsPath);
      if (existingIndex >= 0) {
        // File has both staged and unstaged changes - mark as staged
        changes[existingIndex].staged = true;
      } else {
        changes.push({
          path: change.uri.fsPath,
          relativePath: this.getRelativePath(change.uri.fsPath, rootPath),
          status: this.convertStatus(change.status),
          staged: true,
          uri: change.uri.toString()
        });
      }
    }

    return changes;
  }

  /**
   * Get relative path from absolute path
   */
  private getRelativePath(absolutePath: string, rootPath: string): string {
    if (absolutePath.startsWith(rootPath)) {
      return absolutePath.slice(rootPath.length + 1).replace(/\\/g, '/');
    }
    return absolutePath.replace(/\\/g, '/');
  }

  /**
   * Stage specific files
   */
  async stageFiles(filePaths: string[], repo?: Repository): Promise<void> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      throw new Error('No repository found');
    }

    await repository.add(filePaths);
  }

  /**
   * Unstage specific files
   */
  async unstageFiles(filePaths: string[], repo?: Repository): Promise<void> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      throw new Error('No repository found');
    }

    await repository.revert(filePaths);
  }

  /**
   * Commit staged changes with a message
   */
  async commit(message: string, repo?: Repository): Promise<void> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      throw new Error('No repository found');
    }

    await repository.commit(message);
  }

  /**
   * Perform bulk commits - commit each file with its own message
   */
  async bulkCommit(tasks: CommitTask[], repo?: Repository): Promise<BulkCommitResult> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      throw new Error('No repository found');
    }

    const result: BulkCommitResult = {
      successful: [],
      failed: [],
      totalCommits: tasks.length
    };

    for (const task of tasks) {
      try {
        // Stage the specific file
        await repository.add([task.filePath]);
        
        // Commit with the file's message
        await repository.commit(task.message);

        result.successful.push({
          success: true,
          filePath: task.filePath,
          message: task.message
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed.push({
          success: false,
          filePath: task.filePath,
          message: task.message,
          error: errorMessage
        });
        
        // Continue with next file instead of stopping
        console.error(`Failed to commit ${task.filePath}:`, errorMessage);
      }
    }

    return result;
  }

  /**
   * Get the diff for a specific file
   */
  async getDiff(filePath: string, repo?: Repository): Promise<string> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return '';
    }

    try {
      return await repository.diffWithHEAD(filePath);
    } catch {
      return '';
    }
  }

  /**
   * Get repository info
   */
  getRepositoryInfo(repo?: Repository): { name: string; branch: string; rootPath: string } | undefined {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return undefined;
    }

    const rootPath = repository.rootUri.fsPath;
    const name = rootPath.split(/[/\\]/).pop() || 'Unknown';
    const branch = repository.state.HEAD?.name || 'Unknown';

    return { name, branch, rootPath };
  }

  /**
   * Listen for repository state changes
   */
  onDidChangeRepository(callback: () => void): vscode.Disposable | undefined {
    const repo = this.getActiveRepository();
    if (!repo) {
      return undefined;
    }

    return repo.state.onDidChange(callback);
  }

  /**
   * Open diff view for a file
   */
  async openDiff(filePath: string, repo?: Repository): Promise<void> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return;
    }

    const uri = vscode.Uri.file(filePath);
    const gitUri = this.api?.toGitUri(uri, 'HEAD');
    
    if (gitUri) {
      await vscode.commands.executeCommand('vscode.diff', gitUri, uri, `${filePath.split(/[/\\]/).pop()} (Working Tree)`);
    }
  }

  /**
   * Push changes to remote
   */
  async push(repo?: Repository): Promise<{ success: boolean; error?: string }> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return { success: false, error: 'No repository found' };
    }

    try {
      await repository.push();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Pull changes from remote
   */
  async pull(repo?: Repository): Promise<{ success: boolean; error?: string }> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return { success: false, error: 'No repository found' };
    }

    try {
      await repository.pull();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(repo?: Repository): Promise<{ success: boolean; error?: string }> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return { success: false, error: 'No repository found' };
    }

    try {
      await repository.fetch();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get recent commits
   */
  async getRecentCommits(count: number = 10, repo?: Repository): Promise<Array<{ hash: string; message: string; author: string; date: Date }>> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return [];
    }

    try {
      const commits = await repository.log({ maxEntries: count });
      return commits.map(c => ({
        hash: c.hash,
        message: c.message,
        author: c.authorName || 'Unknown',
        date: c.authorDate || new Date()
      }));
    } catch {
      return [];
    }
  }

  /**
   * Undo the last commit (soft reset)
   */
  async undoLastCommit(repo?: Repository): Promise<{ success: boolean; error?: string }> {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return { success: false, error: 'No repository found' };
    }

    try {
      // Get the last commit to show in message
      const commits = await repository.log({ maxEntries: 1 });
      if (commits.length === 0) {
        return { success: false, error: 'No commits to undo' };
      }

      // Use git reset --soft HEAD~1 via VS Code command
      await vscode.commands.executeCommand('git.undoCommit');
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get sync status (ahead/behind counts)
   */
  getSyncStatus(repo?: Repository): { ahead: number; behind: number } | undefined {
    const repository = repo || this.getActiveRepository();
    if (!repository || !repository.state.HEAD) {
      return undefined;
    }

    return {
      ahead: repository.state.HEAD.ahead || 0,
      behind: repository.state.HEAD.behind || 0
    };
  }

  /**
   * Check if there are uncommitted changes
   */
  hasChanges(repo?: Repository): boolean {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return false;
    }

    return (
      repository.state.workingTreeChanges.length > 0 ||
      repository.state.indexChanges.length > 0
    );
  }

  /**
   * Get the number of changed files
   */
  getChangesCount(repo?: Repository): { staged: number; unstaged: number; total: number } {
    const repository = repo || this.getActiveRepository();
    if (!repository) {
      return { staged: 0, unstaged: 0, total: 0 };
    }

    const staged = repository.state.indexChanges.length;
    const unstaged = repository.state.workingTreeChanges.length;
    
    return { staged, unstaged, total: staged + unstaged };
  }
}
