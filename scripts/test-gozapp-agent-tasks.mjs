import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOZAPP_DEVELOPER_INSTRUCTIONS } from '../src/vs/workbench/contrib/chat/common/gozappDeveloperInstructions.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const userNote = 'User draft: keep this line exactly as written.\n';
const fixtures = {
    feature: {
        source: 'export function total(items) {\n    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);\n}\n',
        checks: `assert.equal(total([]), 0);\nassert.equal(total([{ price: 10, quantity: 2 }]), 20);\nassert.equal(total([{ price: 10, quantity: 2 }], 25), 15);\nassert.equal(total([{ price: 10, quantity: 2 }], 100), 0);\nfor (const discount of [-1, 101, NaN, Infinity, '10', null]) {\n    assert.throws(() => total([], discount), RangeError);\n}\n`,
        task: 'Add optional discountPercent to total(items, discountPercent = 0). Accept only finite numbers from 0 through 100 inclusive; otherwise throw RangeError, including on an empty cart. Apply the percentage to the total without rounding. Preserve existing one-argument behavior. Add a runnable regression test. Do not change notes.md or unrelated files.',
        solution: 'export function total(items, discountPercent = 0) {\n    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) { throw new RangeError("Invalid discount"); }\n    return items.reduce((sum, item) => sum + item.price * item.quantity, 0) * (1 - discountPercent / 100);\n}\n',
    },
    fix: {
        source: 'export function total(items) {\n    return items.reduce((sum, item) => sum + item.price, 0);\n}\n',
        checks: `assert.equal(total([]), 0);\nassert.equal(total([{ price: 10, quantity: 3 }]), 30);\nassert.equal(total([{ price: 7, quantity: 0 }]), 0);\nassert.equal(total([{ price: 2, quantity: 4 }, { price: 3, quantity: 2 }]), 14);\n`,
        task: 'Fix total(items): quantities are ignored. The result must sum price * quantity, including zero quantity and empty carts. Reproduce the bug with a failing regression test before fixing it; rerun it afterward. Preserve the API. Do not change notes.md or unrelated files.',
        solution: 'export function total(items) {\n    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);\n}\n',
    },
};
function git(dir, ...args) { return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }); }
function prepare(parent, name) {
    const dir = join(parent, name);
    mkdirSync(dir);
    writeFileSync(join(dir, 'cart.mjs'), fixtures[name].source);
    writeFileSync(join(dir, 'notes.md'), 'Original user notes.\n');
    writeFileSync(join(dir, 'TASK.md'), fixtures[name].task + '\nPut runnable Node assert tests in test-<name>.mjs at the workspace root, with no new dependencies.\n');
    writeFileSync(join(dir, 'AGENTS.md'), GOZAPP_DEVELOPER_INSTRUCTIONS.replace(/^---\n[\s\S]*?\n---\n/, ''));
    git(dir, 'init', '--quiet');
    git(dir, 'add', '.');
    git(dir, '-c', 'user.name=Gozapp fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Baseline');
    writeFileSync(join(dir, 'notes.md'), userNote);
    return dir;
}
function check(dir, name) {
    const test = `import assert from 'node:assert/strict';\nimport { total } from './cart.mjs';\n${fixtures[name].checks}`;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', test], { cwd: dir, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, `Acceptance checks failed: ${result.error?.message ?? result.stderr}`);
    assert.equal(readFileSync(join(dir, 'notes.md'), 'utf8'), userNote, 'User draft must survive');
    const files = [...git(dir, 'diff', '--name-only', 'HEAD').trim().split('\n'), ...git(dir, 'ls-files', '--others', '--exclude-standard').trim().split('\n')].filter(Boolean);
    assert.ok(files.includes('cart.mjs'), 'Expected source edit');
    for (const file of files) {
        assert.ok(['cart.mjs', 'notes.md'].includes(file) || /^test-[\w-]+\.mjs$/.test(file), `Out-of-scope file: ${file}`);
    }
    const tests = readdirSync(dir).filter(file => /^test-[\w-]+\.mjs$/.test(file));
    assert.ok(tests.length, 'Agent must leave a runnable regression test');
    for (const file of tests) {
        const run = spawnSync(process.execPath, [file], { cwd: dir, encoding: 'utf8', timeout: 10000 });
        assert.equal(run.status, 0, `Regression test failed: ${file}: ${run.error?.message ?? run.stderr}`);
    }
}
const [command, argument] = process.argv.slice(2);
if (command === 'prepare') {
    const parent = mkdtempSync(join(tmpdir(), 'gozapp-agent-tasks-'));
    for (const name of Object.keys(fixtures)) { prepare(parent, name); }
    console.log(`Prepared disposable workspaces: ${parent}\nOpen feature or fix in Gozapp and ask the agent to implement TASK.md.\nVerify afterward: node ${join(root, 'scripts/test-gozapp-agent-tasks.mjs')} verify ${parent}`);
} else if (command === 'verify') {
    assert.ok(argument, 'Provide the disposable workspace parent');
    // Runs code written by the agent: use only on a disposable workspace you trust.
    for (const name of Object.keys(fixtures)) { check(join(resolve(argument), name), name); console.log(`${name}: acceptance, scope and user draft checks passed`); }
} else if (command === '--self-test') {
    const parent = mkdtempSync(join(tmpdir(), 'gozapp-agent-harness-check-'));
    try {
        for (const name of Object.keys(fixtures)) {
            const dir = prepare(parent, name);
            assert.throws(() => check(dir, name), /Acceptance checks failed/);
            writeFileSync(join(dir, 'cart.mjs'), fixtures[name].solution);
            assert.throws(() => check(dir, name), /runnable regression test/);
            writeFileSync(join(dir, 'test-cart.mjs'), `import assert from 'node:assert/strict';\nimport { total } from './cart.mjs';\n${fixtures[name].checks}`);
            check(dir, name);
            writeFileSync(join(dir, 'notes.md'), 'overwritten');
            assert.throws(() => check(dir, name), /User draft/);
            writeFileSync(join(dir, 'notes.md'), userNote);
            writeFileSync(join(dir, 'unrelated.txt'), 'unexpected');
            assert.throws(() => check(dir, name), /Out-of-scope/);
        }
        console.log('Harness self-test passed: failing baseline, working solution, required test, user draft and scope protection (not an agent/model test).');
    } finally { rmSync(parent, { recursive: true, force: true }); }
} else {
    console.log('Usage: node scripts/test-gozapp-agent-tasks.mjs prepare | verify <workspace-parent> | --self-test');
    process.exitCode = 1;
}
