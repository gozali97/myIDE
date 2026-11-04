#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, copyFileSync, chmodSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

export function packagingTasks(target, platform, arch) {
    if (!['x64', 'arm64'].includes(arch)) throw new Error('Supported architectures: x64, arm64');
    if (target === 'deb' && platform === 'linux') return [
        `vscode-linux-${arch}-min`, `vscode-linux-${arch}-prepare-deb`, `vscode-linux-${arch}-build-deb`,
    ];
    if (target === 'windows' && platform === 'win32') return [
        `vscode-win32-${arch}-min`, `vscode-win32-${arch}-inno-updater`, `vscode-win32-${arch}-user-setup`,
    ];
    throw new Error('Build deb on Linux, or windows on Windows. Cross-platform native installers are not supported by this script.');
}
function linuxCliPath(arch) {
    return path.join('cli', 'target', `${arch === 'x64' ? 'x86_64' : 'aarch64'}-unknown-linux-gnu`, 'release', 'code');
}
function validateLinuxCli(file, arch) {
    let bytes;
    try { bytes = readFileSync(file); }
    catch { throw new Error(`Missing local tunnel CLI: ${file}. Build it from cli/ with cargo build --release --locked --target ${arch === 'x64' ? 'x86_64' : 'aarch64'}-unknown-linux-gnu --bin code, then retry packaging.`); }
    assert.ok(bytes.length >= 64 && bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) && bytes[4] === 2 && bytes[5] === 1, 'Tunnel CLI must be a 64-bit little-endian ELF binary');
    assert.equal(bytes.readUInt16LE(18), arch === 'x64' ? 62 : 183, 'Tunnel CLI architecture does not match packaging target');
}
const args = process.argv.slice(2);
if (args[0] === '--self-test') {
    assert.equal(packagingTasks('deb', 'linux', 'x64').at(-1), 'vscode-linux-x64-build-deb');
    assert.equal(packagingTasks('windows', 'win32', 'arm64').at(-1), 'vscode-win32-arm64-user-setup');
    assert.throws(() => packagingTasks('windows', 'linux', 'x64'));
    assert.throws(() => packagingTasks('deb', 'linux', '../bad'));
    const temp = mkdtempSync(path.join(tmpdir(), 'gozapp-cli-check-'));
    try {
        const file = path.join(temp, 'code');
        assert.throws(() => validateLinuxCli(file, 'x64'), /Missing local tunnel CLI/);
        writeFileSync(file, 'not a binary');
        assert.throws(() => validateLinuxCli(file, 'x64'), /ELF/);
        const elf = Buffer.alloc(64);
        Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1]).copy(elf);
        elf.writeUInt16LE(62, 18);
        writeFileSync(file, elf);
        validateLinuxCli(file, 'x64');
        assert.throws(() => validateLinuxCli(file, 'arm64'), /architecture/);
    } finally { rmSync(temp, { recursive: true, force: true }); }
    console.log('Packaging tasks and tunnel CLI preflight checks passed');
} else {
    try {
        if (!args[0] || args.includes('--help')) {
            console.log('Usage: node scripts/package-gozapp.mjs deb|windows [--dry-run]\nBuilds for the current machine architecture. Run npm ci first.');
        } else {
            const root = fileURLToPath(new URL('../', import.meta.url));
            process.chdir(root);
            const tasks = packagingTasks(args[0], process.platform, process.arch);
            if (args.some(arg => ![args[0], '--dry-run'].includes(arg))) throw new Error('Unknown argument');
            const required = readFileSync('.nvmrc', 'utf8').trim().replace(/^v/, '');
            if (!args.includes('--dry-run') && process.versions.node !== required) throw new Error(`Use Node ${required}; found ${process.versions.node}`);
            const run = (cmd, argv) => {
                const result = spawnSync(cmd, argv, { stdio: 'inherit' });
                if (result.error || result.status !== 0) throw new Error(`${cmd} failed (${result.status}): ${result.error?.message ?? 'see output above'}`);
            };
            if (args[0] === 'deb' && !args.includes('--dry-run')) {
                validateLinuxCli(linuxCliPath(process.arch), process.arch);
                for (const cmd of ['fakeroot', 'dpkg-deb']) run(cmd, ['--version']);
            }
            for (const task of tasks) {
                console.log(`Packaging task: ${task}`);
                if (!args.includes('--dry-run')) {
                    if (args[0] === 'deb' && task.endsWith('-prepare-deb')) {
                        const product = JSON.parse(readFileSync('product.json', 'utf8'));
                        const destination = path.join(root, `../VSCode-linux-${process.arch}/bin`, product.tunnelApplicationName);
                        validateLinuxCli(linuxCliPath(process.arch), process.arch);
                        copyFileSync(linuxCliPath(process.arch), destination);
                        chmodSync(destination, 0o755);
                    }
                    run(process.execPath, ['--max-old-space-size=8192', path.join(root, 'node_modules/gulp/bin/gulp.js'), task]);
                }
            }
            console.log(args.includes('--dry-run') ? 'Dry run only; no artifact built.' : args[0] === 'deb'
                ? 'Build complete. Packages: .build/linux/deb/'
                : `Build complete. Unsigned user installer: .build/win32-${process.arch}/user-setup/`);
        }
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
