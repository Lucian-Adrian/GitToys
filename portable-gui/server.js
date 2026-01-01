const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = 3000;

let currentRepoPath = process.cwd();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper to run git commands
function runGit(command, cwd = currentRepoPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(path.join(cwd, '.git')) && command !== 'init') {
            reject({ stderr: 'Not a git repository' });
            return;
        }
        exec(`git ${command}`, { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
                return;
            }
            resolve(stdout.trim());
        });
    });
}

// Set repo path
app.post('/api/path', (req, res) => {
    const { repoPath } = req.body;
    if (fs.existsSync(repoPath)) {
        currentRepoPath = repoPath;
        res.json({ success: true, path: currentRepoPath });
    } else {
        res.status(400).json({ error: 'Path does not exist' });
    }
});

// Get changed files
app.get('/api/files', async (req, res) => {
    try {
        const status = await runGit('status --porcelain');
        if (!status) {
            return res.json([]);
        }

        const files = status.split('\n').filter(line => line.trim()).map(line => {
            const statusCode = line.substring(0, 2).trim();
            const filePath = line.substring(3).trim().replace(/^"(.*)"$/, '$1'); // Handle quoted paths
            
            let status = 'modified';
            if (statusCode === '??') status = 'untracked';
            else if (statusCode === 'A') status = 'added';
            else if (statusCode === 'D') status = 'deleted';
            else if (statusCode === 'R') status = 'renamed';

            return {
                path: filePath,
                status: status,
                staged: line[0] !== ' ' && line[0] !== '?'
            };
        });

        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.stderr || err.message || 'Unknown error' });
    }
});

// Get repo info
app.get('/api/repo', async (req, res) => {
    try {
        let branch = 'N/A';
        try {
            branch = await runGit('rev-parse --abbrev-ref HEAD');
        } catch (e) {
            branch = 'no branch';
        }
        const name = path.basename(currentRepoPath);
        res.json({ name, branch, rootPath: currentRepoPath });
    } catch (err) {
        res.status(500).json({ error: err.stderr || err.message || 'Not a git repository' });
    }
});

// Bulk commit
app.post('/api/commit', async (req, res) => {
    const { commits } = req.body;
    const results = { successful: 0, failed: 0, errors: [] };

    try {
        for (const commit of commits) {
            try {
                // Stage the file
                await runGit(`add "${commit.filePath}"`);
                // Commit the file
                await runGit(`commit -m "${commit.message}"`);
                results.successful++;
            } catch (err) {
                results.failed++;
                results.errors.push(`${commit.filePath}: ${err.stderr || err.message}`);
            }
        }
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Sync operations
app.post('/api/sync/:op', async (req, res) => {
    const { op } = req.params;
    try {
        let result;
        if (op === 'push') result = await runGit('push');
        else if (op === 'pull') result = await runGit('pull');
        else if (op === 'fetch') result = await runGit('fetch');
        else if (op === 'undo') result = await runGit('reset --soft HEAD~1');
        
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.stderr || err.message });
    }
});

// Get diff for a file
app.get('/api/diff', async (req, res) => {
    const { file } = req.query;
    try {
        const diff = await runGit(`diff "${file}"`);
        const untrackedDiff = diff || await runGit(`diff --no-index /dev/null "${file}"`).catch(() => 'New file (untracked)');
        res.json({ diff: untrackedDiff || 'No changes or binary file' });
    } catch (err) {
        res.status(500).json({ error: err.stderr || err.message });
    }
});

app.listen(port, () => {
    console.log(`GitToys Portable GUI running at http://localhost:${port}`);
    console.log(`Working directory: ${process.cwd()}`);
});
