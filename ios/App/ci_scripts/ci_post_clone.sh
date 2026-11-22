#!/bin/bash
set -euo pipefail
cd "${CI_PRIMARY_REPOSITORY_PATH:?}"

if ! command -v node >/dev/null || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  brew install node@24
  export PATH="$(brew --prefix node@24)/bin:$PATH"
fi

: "${OWNJOURNAL_IOS_CONFIG:?Set the private release configuration in Xcode Cloud}"
umask 077
printf '%s' "$OWNJOURNAL_IOS_CONFIG" | base64 -D > .env
unset OWNJOURNAL_IOS_CONFIG
trap 'rm -f .env' EXIT

export ELECTRON_SKIP_BINARY_DOWNLOAD=1
npm ci --legacy-peer-deps --no-audit --no-fund
npm test -- --run
npm run ios:sync
test -s ios/App/App/public/index.html
