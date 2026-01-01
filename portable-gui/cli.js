#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

function run(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf8' }).trim();
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

function parseSelection(input, items) {
  input = (input || '').trim();
  if (!input || input.toLowerCase() === 'all') return items.slice();
  const parts = input.split(',').map(p => p.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        if (items[i-1]) out.push(items[i-1]);
      }
    } else {
      const idx = Number(part);
      if (!isNaN(idx) && items[idx-1]) out.push(items[idx-1]);
    }
  }
  return out;
}

async function main() {
  console.log('\nGitToys CLI (basic)\n');

  const repoPath = (await ask('Path to repository (default: .): ')) || '.';
  const resolved = path.resolve(repoPath);
  if (!fs.existsSync(resolved)) { console.error('Path does not exist:', resolved); process.exit(1); }

  if (!fs.existsSync(path.join(resolved, '.git'))) {
    const init = ((await ask('Not a git repo. Init here? (y/N): ')).trim().toLowerCase() === 'y');
    if (!init) process.exit(0);
    run('git init', resolved);
    console.log('Initialized git repository.');
  }

  const statusRaw = run('git status --porcelain', resolved);
  const lines = statusRaw ? statusRaw.split('\n').map(l => l.trim()).filter(Boolean) : [];
  if (lines.length === 0) { console.log('No changes to commit.'); process.exit(0); }

  const files = lines.map(l => {
    const code = l.substring(0,2).trim();
    const p = l.substring(3).trim().replace(/^"(.*)"$/, '$1');
    return { code, path: p };
  });

  console.log('\nFiles:');
  files.forEach((f, i) => console.log(`  ${i+1}. ${f.path} (${f.code})`));

  const sel = (await ask('\nSelect files to commit (e.g. 1,3-5 or all): ')) || 'all';
  const selected = parseSelection(sel, files.map(f => f.path));
  if (selected.length === 0) { console.log('No files selected. Exiting.'); process.exit(0); }

  const template = (await ask('Commit message template (default: feat: update {file}): ')) || 'feat: update {file}';
  const pushAfter = (await ask('Push after each commit? (y/N): ')).trim().toLowerCase() === 'y';
  const doWatch = (await ask('Watch mode? (poll for changes after finishing) (y/N): ')).trim().toLowerCase() === 'y';
  let interval = 10; if (doWatch) { const iv = parseInt((await ask('Poll interval seconds (default 10): ')) || '10', 10); interval = isNaN(iv) ? 10 : iv; }

  async function processList(list) {
    for (const p of list) {
      try {
        const fileName = path.basename(p);
        const message = template.replace('{file}', fileName).replace('{path}', p);
        console.log(`\nStaging: ${p}`);
        run(`git add -- "${p}"`, resolved);
        try {
          run(`git commit -m "${message}" -- "${p}"`, resolved);
          console.log(`Committed: ${p} -> ${message}`);
        } catch (e) {
          console.error('Commit failed for', p, ':', e.message.split('\n')[0]);
          continue;
        }
        if (pushAfter) {
          console.log('Pushing...');
          try { run('git push', resolved); console.log('Push succeeded'); } catch (pe) { console.error('Push failed:', pe.message.split('\n')[0]); }
        }
      } catch (err) {
        console.error('Error processing', p, err.message);
      }
    }
  }

  await processList(selected);

  if (doWatch) {
    console.log(`\nEntering watch mode. Polling every ${interval}s. Ctrl-C to exit.`);
    setInterval(async () => {
      const raw = run('git status --porcelain', resolved);
      const lines2 = raw ? raw.split('\n').map(l => l.trim()).filter(Boolean) : [];
      if (lines2.length === 0) return;
      const changed = lines2.map(l => l.substring(3).trim().replace(/^"(.*)"$/, '$1'));
      console.log('\nDetected new changes:', changed);
      await processList(changed);
    }, interval * 1000);
  } else {
    console.log('\nDone.');
  }
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
