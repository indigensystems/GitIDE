#!/bin/bash

# Build and run GitHub Desktop in production mode (cross-platform)

set -e

echo "Building production app..."
npm run build:prod

echo "Launching GitHub Desktop..."

case "$(uname -s)" in
    Darwin)
        # macOS
        if [ "$(uname -m)" = "arm64" ]; then
            open "./dist/GitHub Desktop-darwin-arm64/GitHub Desktop.app"
        else
            open "./dist/GitHub Desktop-darwin-x64/GitHub Desktop.app"
        fi
        ;;
    Linux)
        # Linux
        if [ "$(uname -m)" = "x86_64" ]; then
            "./dist/GitHub Desktop-linux-x64/github-desktop"
        else
            "./dist/GitHub Desktop-linux-arm64/github-desktop"
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        # Windows (Git Bash, MSYS, Cygwin)
        if [ "$PROCESSOR_ARCHITECTURE" = "AMD64" ]; then
            "./dist/GitHub Desktop-win32-x64/GitHub Desktop.exe"
        else
            "./dist/GitHub Desktop-win32-arm64/GitHub Desktop.exe"
        fi
        ;;
    *)
        echo "Unsupported operating system: $(uname -s)"
        exit 1
        ;;
esac
