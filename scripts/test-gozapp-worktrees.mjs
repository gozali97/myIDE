import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = mkdtempSync(path.join(tmpdir(), 'gozapp-worktree-test-'));
const repo = path.join(root, 'main repo');
const worktree = path.join(root, 'agent task');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
    mkdirSync(repo);
    git('init');
    git('config', 'user.name', 'Gozapp Test');
    git('config', 'user.email', 'gozapp-test@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'core.hooksPath', path.join(root, 'no-hooks'));
    writeFileSync(path.join(repo, 'sample.txt'), 'baseline\n');
    git('add', 'sample.txt');
    git('commit', '-m', 'test baseline');
    writeFileSync(path.join(repo, 'sample.txt'), 'user uncommitted change\n');
    git('worktree', 'add', '-b', 'agent-task', worktree);
    assert.equal(readFileSync(path.join(worktree, 'sample.txt'), 'utf8'), 'baseline\n');
    assert.equal(readFileSync(path.join(repo, 'sample.txt'), 'utf8'), 'user uncommitted change\n');
    writeFileSync(path.join(worktree, 'sample.txt'), 'agent change\n');
    assert.equal(readFileSync(path.join(repo, 'sample.txt'), 'utf8'), 'user uncommitted change\n');
    const removal = spawnSync('git', ['-C', repo, 'worktree', 'remove', worktree], { encoding: 'utf8' });
    assert.notEqual(removal.status, 0, 'Git must refuse to remove a dirty worktree without force');
    assert.equal(readFileSync(path.join(worktree, 'sample.txt'), 'utf8'), 'agent change\n');
    assert.ok(git('worktree', 'list', '--porcelain').includes('branch refs/heads/agent-task'));
    console.log('Worktree checks passed: paths with spaces, branch creation, dirty main preserved, isolated edits, unsafe removal refused.');
} finally {
    // Only the temporary directory created by this test is removed.
    rmSync(root, { recursive: true, force: true });
}
