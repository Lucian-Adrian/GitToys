/**
 * Message types for communication between extension and webview
 */

// Messages FROM webview TO extension
export type WebviewMessage =
  | { command: 'getChangedFiles' }
  | { command: 'commitFiles'; commits: CommitRequest[] }
  | { command: 'openDiff'; filePath: string }
  | { command: 'refresh' }
  | { command: 'stageFile'; filePath: string }
  | { command: 'unstageFile'; filePath: string }
  | { command: 'ready' }
  | { command: 'getTemplates' }
  | { command: 'pushChanges' }
  | { command: 'applyTemplateToAll'; template: string };

// Messages FROM extension TO webview
export type ExtensionMessage =
  | { type: 'changedFiles'; files: FileInfo[]; repoInfo: RepoInfo | null; templates?: CommitTemplate[]; settings?: Settings }
  | { type: 'commitResult'; result: BulkCommitResultInfo }
  | { type: 'error'; message: string }
  | { type: 'loading'; loading: boolean }
  | { type: 'templates'; templates: CommitTemplate[] }
  | { type: 'applyTemplate'; template: string };

export interface FileInfo {
  path: string;
  relativePath: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';
  staged: boolean;
  uri: string;
}

export interface RepoInfo {
  name: string;
  branch: string;
  rootPath: string;
}

export interface CommitRequest {
  filePath: string;
  message: string;
}

export interface BulkCommitResultInfo {
  successful: number;
  failed: number;
  total: number;
  errors: string[];
}

export interface CommitTemplate {
  name: string;
  template: string;
  description: string;
}

export interface Settings {
  pushAfterCommit: boolean;
  confirmBeforeCommit: boolean;
}
