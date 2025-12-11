#!/bin/bash

# Build and run GitIDE in production mode (cross-platform)

set -e

# Check Node.js version (requires 20+)
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Node.js 20 or higher is required. You have Node.js $(node -v)"
    echo "Please upgrade Node.js: https://nodejs.org/"
    exit 1
fi

# Detect package manager (prefer yarn, fall back to npm)
if command -v yarn &> /dev/null; then
    PKG_MANAGER="yarn"
else
    PKG_MANAGER="npm"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "app/node_modules" ]; then
    echo "Installing dependencies with $PKG_MANAGER..."
    if [ "$PKG_MANAGER" = "npm" ]; then
        $PKG_MANAGER install --legacy-peer-deps
    else
        $PKG_MANAGER install
    fi
fi

# Check if node-pty needs to be rebuilt for Electron
check_node_pty() {
    local pty_node="app/node_modules/node-pty/build/Release/pty.node"
    local marker_file="app/node_modules/.pty-electron-version"
    local electron_version=$(node -p "require('./package.json').devDependencies.electron")

    # Check if pty.node exists
    if [ ! -f "$pty_node" ]; then
        echo "node-pty not built, rebuilding for Electron $electron_version..."
        rebuild_node_pty "$electron_version"
        echo "$electron_version" > "$marker_file"
        return
    fi

    # Check if built for current Electron version
    if [ -f "$marker_file" ]; then
        local built_version=$(cat "$marker_file")
        if [ "$built_version" = "$electron_version" ]; then
            return  # Already built for this version
        fi
    fi

    echo "Rebuilding node-pty for Electron $electron_version..."
    rebuild_node_pty "$electron_version"
    echo "$electron_version" > "$marker_file"
}

# Rebuild node-pty with C++20 support for Electron
rebuild_node_pty() {
    local electron_version="$1"
    cd app/node_modules/node-pty
    rm -rf build
    HOME="$HOME" CXX="clang++ -std=c++20" CC="clang" npx node-gyp rebuild \
        --target="$electron_version" \
        --arch="$(uname -m)" \
        --runtime=electron \
        --dist-url=https://electronjs.org/headers
    cd ../../..
}

check_node_pty

# Kill any running instances of the app
echo "Checking for running instances..."
case "$(uname -s)" in
    Darwin)
        # Check if app is running and kill it
        if pgrep -f "GitIDE" > /dev/null 2>&1; then
            echo "Closing GitIDE..."
            # Try graceful quit first
            osascript -e 'quit app "GitIDE"' 2>/dev/null || true
            sleep 1
            # Force kill if still running
            pkill -9 -f "GitIDE" 2>/dev/null || true
            sleep 1
        fi
        ;;
    Linux)
        if pgrep -f "gitide" > /dev/null 2>&1; then
            echo "Closing GitIDE..."
            pkill -9 -f "gitide" 2>/dev/null || true
            sleep 1
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        taskkill /F /IM "GitIDE.exe" 2>/dev/null || true
        sleep 1
        ;;
esac

echo "Building production app with $PKG_MANAGER..."
$PKG_MANAGER run build:prod

echo "Launching GitIDE..."

case "$(uname -s)" in
    Darwin)
        # macOS
        if [ "$(uname -m)" = "arm64" ]; then
            open "./dist/GitIDE-darwin-arm64/GitIDE.app"
        else
            open "./dist/GitIDE-darwin-x64/GitIDE.app"
        fi
        ;;
    Linux)
        # Linux
        if [ "$(uname -m)" = "x86_64" ]; then
            "./dist/GitIDE-linux-x64/gitide"
        else
            "./dist/GitIDE-linux-arm64/gitide"
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        # Windows (Git Bash, MSYS, Cygwin)
        if [ "$PROCESSOR_ARCHITECTURE" = "AMD64" ]; then
            "./dist/GitIDE-win32-x64/GitIDE.exe"
        else
            "./dist/GitIDE-win32-arm64/GitIDE.exe"
        fi
        ;;
    *)
        echo "Unsupported operating system: $(uname -s)"
        exit 1
        ;;
esac
