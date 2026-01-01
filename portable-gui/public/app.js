const API_BASE = '/api';

const elements = {
    repoName: document.getElementById('repo-name'),
    branchName: document.getElementById('branch-name'),
    repoPathInput: document.getElementById('repo-path'),
    setPathBtn: document.getElementById('set-path-btn'),
    fileList: document.getElementById('file-list'),
    changeCount: document.getElementById('change-count'),
    commitTemplate: document.getElementById('commit-template'),
    bulkCommitBtn: document.getElementById('bulk-commit-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    pullBtn: document.getElementById('pull-btn'),
    pushBtn: document.getElementById('push-btn'),
    selectAllBtn: document.getElementById('select-all'),
    deselectAllBtn: document.getElementById('deselect-all'),
    diffViewer: document.getElementById('diff-viewer'),
    statusBar: document.getElementById('status-bar')
};

let files = [];

async function init() {
    await loadRepoInfo();
    await loadFiles();
    setupEventListeners();
}

async function loadRepoInfo() {
    try {
        const res = await fetch(`${API_BASE}/repo`);
        const data = await res.json();
        if (data.error) {
            showStatus(data.error, 'error');
            return;
        }
        elements.repoName.textContent = data.name;
        elements.branchName.textContent = data.branch;
        elements.repoPathInput.value = data.rootPath;
    } catch (err) {
        showStatus('Failed to load repo info', 'error');
    }
}

async function loadFiles() {
    try {
        const res = await fetch(`${API_BASE}/files`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
            files = data;
            renderFiles();
            updateUI();
            showStatus('Ready', 'success');
        } else {
            files = [];
            renderFiles();
            updateUI();
            showStatus(data.error || 'Failed to load files', 'error');
        }
    } catch (err) {
        files = [];
        renderFiles();
        updateUI();
        showStatus('Failed to load files', 'error');
    }
}

function renderFiles() {
    if (files.length === 0) {
        elements.fileList.innerHTML = '<div class="empty-state">No changes detected</div>';
        return;
    }
    elements.fileList.innerHTML = files.map((file, index) => `
        <div class="file-item" onclick="showDiff('${file.path}')">
            <input type="checkbox" id="file-${index}" ${file.selected ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleFile(${index})">
            <div class="file-info">
                <span class="file-path">${file.path}</span>
                <span class="file-status">${file.status}</span>
            </div>
        </div>
    `).join('');
}

async function showDiff(path) {
    elements.diffViewer.textContent = 'Loading diff...';
    try {
        const res = await fetch(`${API_BASE}/diff?file=${encodeURIComponent(path)}`);
        const data = await res.json();
        elements.diffViewer.textContent = data.diff || 'No changes.';
    } catch (err) {
        elements.diffViewer.textContent = 'Error loading diff.';
    }
}

function toggleFile(index) {
    files[index].selected = !files[index].selected;
    updateUI();
}

function updateUI() {
    const selectedCount = files.filter(f => f.selected).length;
    elements.changeCount.textContent = files.length;
    elements.bulkCommitBtn.disabled = selectedCount === 0;
    elements.bulkCommitBtn.textContent = `Bulk Commit (${selectedCount})`;
}

function setupEventListeners() {
    elements.refreshBtn.onclick = loadFiles;

    elements.setPathBtn.onclick = async () => {
        const repoPath = elements.repoPathInput.value;
        try {
            const res = await fetch(`${API_BASE}/path`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoPath })
            });
            const data = await res.json();
            if (data.success) {
                await loadRepoInfo();
                await loadFiles();
            } else {
                showStatus(data.error, 'error');
            }
        } catch (err) {
            showStatus('Failed to set path', 'error');
        }
    };
    
    elements.selectAllBtn.onclick = () => {
        files.forEach(f => f.selected = true);
        renderFiles();
        updateUI();
    };

    elements.deselectAllBtn.onclick = () => {
        files.forEach(f => f.selected = false);
        renderFiles();
        updateUI();
    };

    elements.bulkCommitBtn.onclick = async () => {
        const selectedFiles = files.filter(f => f.selected);
        const template = elements.commitTemplate.value;
        
        const commits = selectedFiles.map(f => ({
            filePath: f.path,
            message: template.replace('{file}', f.path.split('/').pop()).replace('{path}', f.path)
        }));

        showStatus(`Committing ${commits.length} files...`);
        elements.bulkCommitBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commits })
            });
            const result = await res.json();
            showStatus(`Success: ${result.successful}, Failed: ${result.failed}`, result.failed > 0 ? 'error' : 'success');
            await loadFiles();
        } catch (err) {
            showStatus('Commit failed', 'error');
        } finally {
            elements.bulkCommitBtn.disabled = false;
        }
    };

    elements.pushBtn.onclick = () => sync('push');
    elements.pullBtn.onclick = () => sync('pull');
}

async function sync(op) {
    showStatus(`${op === 'push' ? 'Pushing' : 'Pulling'}...`);
    try {
        const res = await fetch(`${API_BASE}/sync/${op}`, { method: 'POST' });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        showStatus(`${op.charAt(0).toUpperCase() + op.slice(1)} successful`, 'success');
        await loadFiles();
    } catch (err) {
        showStatus(`${op} failed: ${err.message}`, 'error');
    }
}

function showStatus(msg, type = '') {
    elements.statusBar.textContent = msg;
    elements.statusBar.className = `status-bar ${type}`;
}

init();
