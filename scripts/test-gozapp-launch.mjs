import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = mkdtempSync(path.join(tmpdir(), 'gozapp launch '));
try {
    mkdirSync(path.join(root, 'scripts'));
    copyFileSync(new URL('./gozapp-launch.sh', import.meta.url), path.join(root, 'scripts/gozapp-launch.sh'));
    writeFileSync(path.join(root, '.nvmrc'), process.versions.node + '\n');
    writeFileSync(path.join(root, 'scripts/code.sh'), '#!/bin/bash\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
    const env = { ...process.env, NVM_DIR: path.join(root, 'no-nvm'), PATH: path.dirname(process.execPath) + ':' + process.env.PATH };
    const run = () => spawnSync('bash', [path.join(root, 'scripts/gozapp-launch.sh'), 'folder with spaces', '--new-window'], { env, encoding: 'utf8' });
    const ok = run();
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout, 'folder with spaces\n--new-window\n');
    writeFileSync(path.join(root, '.nvmrc'), '0.0.0\n');
    const mismatch = run();
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stderr, /requires Node 0.0.0/);
    console.log('Launcher checks passed: arguments preserved and incompatible Node rejected');
} finally { rmSync(root, { recursive: true, force: true }); }
