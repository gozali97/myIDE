# Gozapp native installers

Run from the repository root. Uses the upstream packaging tasks, not a repackaged development Electron binary. Build output contains your local source modifications. Installers are unsigned.

## Linux Debian/Ubuntu

Prerequisites: Git, Python, compiler/make, pkg-config, development libraries required by VS Code, fakeroot and dpkg-deb. Use the Node version in `.nvmrc`. Allow substantial RAM and disk headroom.

```bash
source ~/.nvm/nvm.sh
nvm install
nvm use
npm ci
node scripts/package-gozapp.mjs deb
```

Artifacts: `.build/linux/deb/` (including architecture subdirectories).
Only after a successful build, inspect the resulting package with `dpkg-deb --info <file.deb>` and `dpkg-deb --contents <file.deb>`, then test installation in a disposable VM before installing on a work machine.

## Windows user installer

Build on Windows, with Git, Python, Visual Studio Build Tools C++ workload and the Windows SDK. Install the exact Node version from `.nvmrc`. Dependency installation provides the upstream Inno Setup package. Do not reuse Linux node_modules on Windows.

```powershell
npm ci
node scripts/package-gozapp.mjs windows
```

Artifacts: `.build/win32-x64/user-setup/` (or `win32-arm64` for an ARM64 host).
The script runs native packaging, prepares the Inno updater, then builds a user installer. Windows SmartScreen may warn because it is not signed. Windows execution and prerequisites have not yet been verified on a Windows runner.

## Checks without building

```bash
node scripts/package-gozapp.mjs --self-test
node scripts/package-gozapp.mjs deb --dry-run
```

Dry-run still enforces the target OS/architecture; use `windows --dry-run` on Windows.

## Current Linux build blocker

The earlier Copilot SDK/shim packaging issue has been fixed by explicitly including the SDK in the extension package. Metadata, version parity and a non-empty SDK entrypoint have been checked in both staging and the Linux distribution:

```bash
node scripts/test-gozapp-packaged-sdk.mjs
node scripts/test-gozapp-packaged-sdk.mjs ../VSCode-linux-x64/resources/app/extensions/copilot
```

These checks do not prove that every SDK runtime dependency works.

Before packaging, build the local Rust CLI (requires Cargo/Rust and native build prerequisites; these are not installed automatically):

```bash
cd cli
cargo build --release --locked --target x86_64-unknown-linux-gnu --bin code
cd ..
```

Use `aarch64-unknown-linux-gnu` on Linux ARM64. The packaging script now checks the local CLI ELF header/architecture before starting the expensive app build, then copies it into the distribution as the tunnel executable before `prepare-deb`, following the upstream CLI mix-in step. Header checks do not prove runtime compatibility. Cargo is not currently available on this host, so CLI compilation and the mix-in have not been tested end-to-end.

The remaining known blocker is Debian dependency analysis: `vscode-linux-x64-prepare-deb` expects `../VSCode-linux-x64/bin/gozapp-tunnel`, but that binary is absent. The tunnel build/inclusion path must be diagnosed before release; do not substitute a fake binary or silently exclude a required executable. Previous failure log: `/tmp/gozapp-deb-final.log`.

Run prepare and build tasks sequentially, not as concurrent gulp arguments. No successful `.deb` or Windows installer has been verified yet. Distribution staging also predates recent UI changes and must be rebuilt before release.
