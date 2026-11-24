#!/bin/bash
# Deploys the FinTrack API (backend/) to a cPanel "Setup Node.js App".
# Edit APP_NAME and NODE_VER to match the app you create in cPanel.
set -e

APP_NAME="fintrack-api"   # Application root folder name in cPanel
NODE_VER="22"             # Node.js version chosen in cPanel
APP_ROOT="$HOME/$APP_NAME"

echo "==> Activating Node $NODE_VER environment"
source "$HOME/nodevenv/$APP_NAME/$NODE_VER/bin/activate"

echo "==> Copying backend files to $APP_ROOT"
mkdir -p "$APP_ROOT"
cp backend/package.json backend/package-lock.json backend/tsconfig.json "$APP_ROOT/"
rm -rf "$APP_ROOT/src"
cp -R backend/src "$APP_ROOT/src"

cd "$APP_ROOT"

echo "==> Installing dependencies (dev included for the TypeScript build)"
# --ignore-scripts: the shared host's process limit blocks esbuild's install-time
# binary check, and nothing in production needs esbuild.
npm install --include=dev --ignore-scripts --no-audit --no-fund

echo "==> Building"
# Limit Go runtime threads in case the TypeScript compiler is a native binary
export GOMAXPROCS=1
npm run build

echo "==> Restarting app"
mkdir -p tmp
touch tmp/restart.txt

echo "==> Done"