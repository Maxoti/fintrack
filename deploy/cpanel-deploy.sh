#!/bin/bash
# Deploys the FinTrack API (backend/) to a cPanel "Setup Node.js App".
# Edit APP_NAME and NODE_VER to match the app you create in cPanel.
set -e

APP_NAME="fintrack-api"   # Application root folder name in cPanel
NODE_VER="20"             # Node.js version chosen in cPanel
APP_ROOT="$HOME/$APP_NAME"

echo "==> Activating Node $NODE_VER environment"
source "$HOME/nodevenv/$APP_NAME/$NODE_VER/bin/activate"

echo "==> Copying backend files to $APP_ROOT"
mkdir -p "$APP_ROOT"
cp backend/package.json backend/package-lock.json backend/tsconfig.json "$APP_ROOT/"
rm -rf "$APP_ROOT/src"
cp -R backend/src "$APP_ROOT/src"

cd "$APP_ROOT"

echo "==> Installing dependencies (including dev, needed for the TypeScript build)"
npm install --include=dev

echo "==> Building"
npm run build

echo "==> Restarting app"
mkdir -p tmp
touch tmp/restart.txt

echo "==> Done"