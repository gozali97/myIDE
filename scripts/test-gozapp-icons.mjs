import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureIconFont } from '../build/lib/preLaunch.ts';

const root = await mkdtemp(path.join(tmpdir(), 'gozapp-icons-'));
try {
    const source = path.join(root, 'node_modules/@vscode/codicons/dist');
    const output = path.join(root, 'out/vs/base/browser/ui/codicons/codicon/codicon.ttf');
    await assert.rejects(ensureIconFont(root), { code: 'ENOENT' });
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'codicon.ttf'), 'font-v1');
    await ensureIconFont(root);
    assert.equal(await readFile(output, 'utf8'), 'font-v1');
    await writeFile(path.join(source, 'codicon.ttf'), 'font-v2');
    await ensureIconFont(root);
    assert.equal(await readFile(output, 'utf8'), 'font-v2');
    console.log('Icon asset checks passed: missing dependency, clean build, updated font.');
} finally {
    await rm(root, { recursive: true, force: true });
}
