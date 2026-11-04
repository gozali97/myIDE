#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
read -r version < .nvmrc
version="${version#v}"
node_dir="${NVM_DIR:-$HOME/.nvm}/versions/node/v${version}/bin"
if [[ -x "$node_dir/node" ]]; then
    export PATH="$node_dir:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
    echo "Gozapp requires Node $version. Install the version in $ROOT/.nvmrc." >&2
    exit 1
fi
actual="$(node -p 'process.versions.node')"
if [[ "$actual" != "$version" ]]; then
    echo "Gozapp requires Node $version; found $actual. Install the version in $ROOT/.nvmrc." >&2
    exit 1
fi
exec ./scripts/code.sh "$@"
