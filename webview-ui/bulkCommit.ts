/**
 * GitToys Bulk Commit - Webview UI
 * Enhanced with templates, filters, smart grouping, and keyboard navigation
 */

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface FileInfo {
  path: string;
  relativePath: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
  uri: string;
}

interface RepoInfo {
  name: string;
  branch: string;
  rootPath: string;
}

interface CommitRequest {
  filePath: string;
  message: string;
}

interface CommitTemplate {
  name: string;
  template: string;
  description: string;
}

interface Settings {
  pushAfterCommit: boolean;
  confirmBeforeCommit: boolean;
}

interface BulkCommitResultInfo {
  successful: number;
  failed: number;
  total: number;
  errors: string[];
}

type FilterType = 'all' | 'modified' | 'added' | 'deleted' | 'staged' | 'unstaged';

interface AppState {
  files: FileInfo[];
  repoInfo: RepoInfo | null;
  selectedFiles: Set<string>;
  commitMessages: Map<string, string>;
  loading: boolean;
  error: string | null;
  templates: CommitTemplate[];
  settings: Settings;
  filter: FilterType;
  searchQuery: string;
  groupByFolder: boolean;
}

class BulkCommitApp {
  private vscode: VsCodeApi;
  private state: AppState;
  private appElement: HTMLElement;

  constructor() {
    this.vscode = acquireVsCodeApi();
    this.state = {
      files: [],
      repoInfo: null,
      selectedFiles: new Set(),
      commitMessages: new Map(),
      loading: true,
      error: null,
      templates: [],
      settings: { pushAfterCommit: false, confirmBeforeCommit: true },
      filter: 'all',
      searchQuery: '',
      groupByFolder: false
    };
    this.appElement = document.getElementById('app')!;

    // Restore previous state if available
    const previousState = this.vscode.getState() as Partial<AppState> | undefined;
    if (previousState) {
      this.state.selectedFiles = new Set(previousState.selectedFiles || []);
      this.state.commitMessages = new Map(Object.entries(previousState.commitMessages || {}));
      this.state.filter = previousState.filter || 'all';
      this.state.groupByFolder = previousState.groupByFolder || false;
    }

    this.setupMessageListener();
    this.setupKeyboardShortcuts();
    this.render();
    
    // Signal we're ready
    this.vscode.postMessage({ command: 'ready' });
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      const message = event.data;
      this.handleMessage(message);
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter = Commit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.handleCommit();
      }
      // Ctrl/Cmd + A = Select all (when not in input)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        this.selectAll();
      }
      // Escape = Clear search
      if (e.key === 'Escape') {
        this.state.searchQuery = '';
        this.render();
      }
      // Ctrl/Cmd + F = Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    });
  }

  private selectAll(): void {
    this.getFilteredFiles().forEach(file => {
      this.state.selectedFiles.add(file.path);
    });
    this.saveState();
    this.render();
  }

  private handleMessage(message: { type: string; [key: string]: unknown }): void {
    switch (message.type) {
      case 'changedFiles':
        this.state.files = message.files as FileInfo[];
        this.state.repoInfo = message.repoInfo as RepoInfo | null;
        this.state.templates = (message.templates as CommitTemplate[]) || [];
        this.state.settings = (message.settings as Settings) || { pushAfterCommit: false, confirmBeforeCommit: true };
        this.state.loading = false;
        this.state.error = null;
        
        // Auto-select all files that don't have a selection state yet
        this.state.files.forEach(file => {
          if (!this.state.commitMessages.has(file.path)) {
            this.state.selectedFiles.add(file.path);
          }
        });
        
        // Clean up messages for files that no longer exist
        const filePaths = new Set(this.state.files.map(f => f.path));
        this.state.selectedFiles.forEach(path => {
          if (!filePaths.has(path)) {
            this.state.selectedFiles.delete(path);
          }
        });
        this.state.commitMessages.forEach((_, path) => {
          if (!filePaths.has(path)) {
            this.state.commitMessages.delete(path);
          }
        });
        
        this.saveState();
        this.render();
        break;

      case 'commitResult':
        const result = message.result as BulkCommitResultInfo;
        if (result.successful > 0) {
          this.state.commitMessages.clear();
          this.state.selectedFiles.clear();
        }
        this.saveState();
        break;

      case 'error':
        this.state.error = message.message as string;
        this.state.loading = false;
        this.render();
        break;

      case 'loading':
        this.state.loading = message.loading as boolean;
        this.render();
        break;

      case 'applyTemplate':
        const template = message.template as string;
        this.applyTemplateToSelected(template);
        break;
    }
  }

  private applyTemplateToSelected(template: string): void {
    this.state.selectedFiles.forEach(path => {
      const currentMessage = this.state.commitMessages.get(path) || '';
      if (!currentMessage.startsWith(template)) {
        this.state.commitMessages.set(path, template + currentMessage);
      }
    });
    this.saveState();
    this.render();
  }

  private saveState(): void {
    this.vscode.setState({
      selectedFiles: Array.from(this.state.selectedFiles),
      commitMessages: Object.fromEntries(this.state.commitMessages),
      filter: this.state.filter,
      groupByFolder: this.state.groupByFolder
    });
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      modified: 'M',
      added: 'A',
      deleted: 'D',
      renamed: 'R',
      untracked: 'U',
      conflicted: '!'
    };
    return labels[status] || '?';
  }

  private getStatusTitle(status: string): string {
    const titles: Record<string, string> = {
      modified: 'Modified',
      added: 'Added',
      deleted: 'Deleted',
      renamed: 'Renamed',
      untracked: 'Untracked',
      conflicted: 'Conflicted'
    };
    return titles[status] || 'Unknown';
  }

  private getFilteredFiles(): FileInfo[] {
    let files = this.state.files;

    // Apply filter
    switch (this.state.filter) {
      case 'modified':
        files = files.filter(f => f.status === 'modified');
        break;
      case 'added':
        files = files.filter(f => f.status === 'added' || f.status === 'untracked');
        break;
      case 'deleted':
        files = files.filter(f => f.status === 'deleted');
        break;
      case 'staged':
        files = files.filter(f => f.staged);
        break;
      case 'unstaged':
        files = files.filter(f => !f.staged);
        break;
    }

    // Apply search
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      files = files.filter(f => f.relativePath.toLowerCase().includes(query));
    }

    return files;
  }

  private getGroupedFiles(): Map<string, FileInfo[]> {
    const files = this.getFilteredFiles();
    const groups = new Map<string, FileInfo[]>();

    if (!this.state.groupByFolder) {
      groups.set('', files);
      return groups;
    }

    files.forEach(file => {
      const parts = file.relativePath.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)';
      
      if (!groups.has(folder)) {
        groups.set(folder, []);
      }
      groups.get(folder)!.push(file);
    });

    return groups;
  }

  private render(): void {
    if (this.state.loading && this.state.files.length === 0) {
      this.appElement.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Loading repository...</p>
        </div>
      `;
      return;
    }

    if (!this.state.repoInfo) {
      this.appElement.innerHTML = `
        <div class="no-repo-state">
          <div class="icon">📁</div>
          <h2>No Git Repository Found</h2>
          <p>Open a folder containing a Git repository to use Bulk Commit.</p>
        </div>
      `;
      return;
    }

    const filteredFiles = this.getFilteredFiles();
    const selectedCount = Array.from(this.state.selectedFiles).filter(
      path => filteredFiles.some(f => f.path === path)
    ).length;
    const filesWithMessages = Array.from(this.state.selectedFiles)
      .filter(path => this.state.commitMessages.get(path)?.trim())
      .filter(path => filteredFiles.some(f => f.path === path));
    const readyToCommit = filesWithMessages.length;

    this.appElement.innerHTML = `
      ${this.state.error ? `<div class="error-state">${this.escapeHtml(this.state.error)}</div>` : ''}
      
      <header class="header">
        <h1>
          <span class="icon">🔧</span>
          Bulk Commit
        </h1>
        <div class="repo-info">
          <span>${this.escapeHtml(this.state.repoInfo.name)}</span>
          <span class="branch">
            <span>⎇</span>
            ${this.escapeHtml(this.state.repoInfo.branch)}
          </span>
        </div>
      </header>

      <!-- Search and Filter Bar -->
      <div class="search-filter-bar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            id="search-input" 
            class="search-input" 
            placeholder="Search files... (Ctrl+F)" 
            value="${this.escapeHtml(this.state.searchQuery)}"
          />
          ${this.state.searchQuery ? '<button class="clear-search" id="clear-search">✕</button>' : ''}
        </div>
        <div class="filter-buttons">
          ${this.renderFilterButton('all', 'All', this.state.files.length)}
          ${this.renderFilterButton('modified', 'M', this.state.files.filter(f => f.status === 'modified').length)}
          ${this.renderFilterButton('added', 'A', this.state.files.filter(f => f.status === 'added' || f.status === 'untracked').length)}
          ${this.renderFilterButton('deleted', 'D', this.state.files.filter(f => f.status === 'deleted').length)}
          ${this.renderFilterButton('staged', 'Staged', this.state.files.filter(f => f.staged).length)}
        </div>
      </div>

      <!-- Templates Bar -->
      ${this.state.templates.length > 0 ? `
        <div class="templates-bar">
          <span class="templates-label">Templates:</span>
          ${this.state.templates.map(t => `
            <button class="template-btn" data-template="${this.escapeHtml(t.template)}" title="${this.escapeHtml(t.description)}">
              ${this.escapeHtml(t.name)}
            </button>
          `).join('')}
        </div>
      ` : ''}

      <div class="toolbar">
        <div class="toolbar-left">
          <span class="file-count">${filteredFiles.length} file${filteredFiles.length !== 1 ? 's' : ''}</span>
          <label class="group-toggle">
            <input type="checkbox" id="group-by-folder" ${this.state.groupByFolder ? 'checked' : ''} />
            Group by folder
          </label>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-icon" id="btn-refresh" title="Refresh">🔄</button>
          <button class="btn btn-secondary" id="btn-select-all">Select All</button>
          <button class="btn btn-secondary" id="btn-select-none">Select None</button>
        </div>
      </div>

      ${filteredFiles.length === 0 ? `
        <div class="empty-state">
          <div class="icon">✨</div>
          <h2>${this.state.files.length === 0 ? 'All Clean!' : 'No matching files'}</h2>
          <p>${this.state.files.length === 0 ? 'No uncommitted changes in this repository.' : 'Try adjusting your filter or search.'}</p>
        </div>
      ` : `
        <div class="file-list" id="file-list">
          ${this.renderFileGroups()}
        </div>

        <div class="commit-container">
          <div class="commit-actions">
            <span class="commit-summary">
              ${readyToCommit > 0 
                ? `Ready to commit ${readyToCommit} file${readyToCommit !== 1 ? 's' : ''} ${this.state.settings.pushAfterCommit ? '(will push)' : ''}`
                : `${selectedCount} file${selectedCount !== 1 ? 's' : ''} selected - add commit messages`}
            </span>
            <button 
              class="btn btn-primary" 
              id="btn-commit" 
              ${readyToCommit === 0 ? 'disabled' : ''}
              title="Commit (Ctrl+Enter)"
            >
              Commit ${readyToCommit > 0 ? `(${readyToCommit})` : ''}
            </button>
          </div>
          <div class="keyboard-hints">
            <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> Commit</span>
            <span><kbd>Ctrl</kbd>+<kbd>F</kbd> Search</span>
            <span>Click path → view diff</span>
          </div>
        </div>
      `}
    `;

    this.setupEventListeners();
  }

  private renderFilterButton(filter: FilterType, label: string, count: number): string {
    const isActive = this.state.filter === filter;
    return `
      <button 
        class="filter-btn ${isActive ? 'active' : ''}" 
        data-filter="${filter}"
        ${count === 0 && filter !== 'all' ? 'disabled' : ''}
      >
        ${label} <span class="filter-count">${count}</span>
      </button>
    `;
  }

  private renderFileGroups(): string {
    const groups = this.getGroupedFiles();
    let html = '';

    groups.forEach((files, folder) => {
      if (this.state.groupByFolder && folder) {
        html += `<div class="folder-group">
          <div class="folder-header">
            <span class="folder-icon">📁</span>
            <span class="folder-name">${this.escapeHtml(folder)}</span>
            <span class="folder-count">${files.length}</span>
          </div>
        </div>`;
      }
      files.forEach(file => {
        html += this.renderFileItem(file);
      });
    });

    return html;
  }

  private renderFileItem(file: FileInfo): string {
    const isSelected = this.state.selectedFiles.has(file.path);
    const message = this.state.commitMessages.get(file.path) || '';
    const fileName = file.relativePath.split('/').pop() || file.relativePath;

    return `
      <div class="file-item ${isSelected ? 'selected' : ''}" data-path="${this.escapeHtml(file.path)}">
        <div class="file-header">
          <input 
            type="checkbox" 
            class="file-checkbox" 
            data-path="${this.escapeHtml(file.path)}"
            ${isSelected ? 'checked' : ''}
          />
          <span 
            class="file-status ${file.status}" 
            title="${this.getStatusTitle(file.status)}"
          >${this.getStatusLabel(file.status)}</span>
          <span 
            class="file-path" 
            data-path="${this.escapeHtml(file.path)}" 
            title="Click to view diff"
          >
            <span class="file-name">${this.escapeHtml(fileName)}</span>
            ${!this.state.groupByFolder && file.relativePath.includes('/') ? 
              `<span class="file-folder">${this.escapeHtml(file.relativePath.split('/').slice(0, -1).join('/'))}</span>` : ''}
          </span>
          ${file.staged ? '<span class="staged-badge">Staged</span>' : ''}
        </div>
        ${isSelected ? `
          <div class="commit-input-wrapper">
            <textarea 
              class="commit-input" 
              data-path="${this.escapeHtml(file.path)}"
              placeholder="Commit message for ${this.escapeHtml(fileName)}..."
              rows="1"
            >${this.escapeHtml(message)}</textarea>
            <div class="input-actions">
              <span class="char-count ${message.length > 72 ? 'warning' : ''}">${message.length}</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private setupEventListeners(): void {
    // Refresh button
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.vscode.postMessage({ command: 'refresh' });
    });

    // Select all
    document.getElementById('btn-select-all')?.addEventListener('click', () => {
      this.selectAll();
    });

    // Select none
    document.getElementById('btn-select-none')?.addEventListener('click', () => {
      this.state.selectedFiles.clear();
      this.saveState();
      this.render();
    });

    // Commit button
    document.getElementById('btn-commit')?.addEventListener('click', () => {
      this.handleCommit();
    });

    // Search input
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.state.searchQuery = (e.target as HTMLInputElement).value;
      this.saveState();
      this.render();
    });

    // Clear search
    document.getElementById('clear-search')?.addEventListener('click', () => {
      this.state.searchQuery = '';
      this.saveState();
      this.render();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = (e.currentTarget as HTMLElement).dataset.filter as FilterType;
        this.state.filter = filter;
        this.saveState();
        this.render();
      });
    });

    // Template buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const template = (e.currentTarget as HTMLElement).dataset.template!;
        this.applyTemplateToSelected(template);
      });
    });

    // Group by folder checkbox
    document.getElementById('group-by-folder')?.addEventListener('change', (e) => {
      this.state.groupByFolder = (e.target as HTMLInputElement).checked;
      this.saveState();
      this.render();
    });

    // File checkboxes
    document.querySelectorAll('.file-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const path = target.dataset.path!;
        if (target.checked) {
          this.state.selectedFiles.add(path);
        } else {
          this.state.selectedFiles.delete(path);
        }
        this.saveState();
        this.render();
      });
    });

    // File paths (open diff)
    document.querySelectorAll('.file-path').forEach(pathEl => {
      pathEl.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const path = target.dataset.path!;
        this.vscode.postMessage({ command: 'openDiff', filePath: path });
      });
    });

    // Commit message inputs
    document.querySelectorAll('.commit-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLTextAreaElement;
        const path = target.dataset.path!;
        this.state.commitMessages.set(path, target.value);
        this.saveState();
        this.updateCommitButton();
        this.updateCharCount(target);
      });

      // Auto-resize textarea
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
      });

      // Tab to next input
      input.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Tab' && !keyEvent.shiftKey) {
          const inputs = Array.from(document.querySelectorAll('.commit-input'));
          const currentIndex = inputs.indexOf(e.target as Element);
          if (currentIndex < inputs.length - 1) {
            e.preventDefault();
            (inputs[currentIndex + 1] as HTMLTextAreaElement).focus();
          }
        }
      });
    });
  }

  private updateCharCount(textarea: HTMLTextAreaElement): void {
    const wrapper = textarea.closest('.commit-input-wrapper');
    const charCount = wrapper?.querySelector('.char-count');
    if (charCount) {
      const count = textarea.value.length;
      charCount.textContent = String(count);
      charCount.classList.toggle('warning', count > 72);
    }
  }

  private updateCommitButton(): void {
    const filteredFiles = this.getFilteredFiles();
    const filesWithMessages = Array.from(this.state.selectedFiles)
      .filter(path => this.state.commitMessages.get(path)?.trim())
      .filter(path => filteredFiles.some(f => f.path === path));
    const readyToCommit = filesWithMessages.length;
    
    const btn = document.getElementById('btn-commit') as HTMLButtonElement;
    const summary = document.querySelector('.commit-summary');
    
    if (btn) {
      btn.disabled = readyToCommit === 0;
      btn.textContent = `Commit ${readyToCommit > 0 ? `(${readyToCommit})` : ''}`;
    }
    
    if (summary) {
      const selectedCount = Array.from(this.state.selectedFiles).filter(
        path => filteredFiles.some(f => f.path === path)
      ).length;
      summary.textContent = readyToCommit > 0 
        ? `Ready to commit ${readyToCommit} file${readyToCommit !== 1 ? 's' : ''} ${this.state.settings.pushAfterCommit ? '(will push)' : ''}`
        : `${selectedCount} file${selectedCount !== 1 ? 's' : ''} selected - add commit messages`;
    }
  }

  private handleCommit(): void {
    const filteredFiles = this.getFilteredFiles();
    const commits: CommitRequest[] = [];
    
    this.state.selectedFiles.forEach(path => {
      const message = this.state.commitMessages.get(path)?.trim();
      if (message && filteredFiles.some(f => f.path === path)) {
        commits.push({ filePath: path, message });
      }
    });

    if (commits.length === 0) {
      return;
    }

    this.vscode.postMessage({ command: 'commitFiles', commits });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the app when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new BulkCommitApp());
} else {
  new BulkCommitApp();
}
