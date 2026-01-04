#!/bin/bash

# Build and run GitIDE (cross-platform)
# Usage: ./run.sh [--dev|--prod]
#   --dev   Build and run development version (default)
#   --prod  Build and run production version

set -e

# Parse arguments
BUILD_MODE="dev"
while [[ $# -gt 0 ]]; do
    case $1 in
        --dev)
            BUILD_MODE="dev"
            shift
            ;;
        --prod)
            BUILD_MODE="prod"
            shift
            ;;
        -h|--help)
            echo "Usage: ./run.sh [--dev|--prod]"
            echo "  --dev   Build and run development version (default)"
            echo "  --prod  Build and run production version"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./run.sh [--dev|--prod]"
            exit 1
            ;;
    esac
done

# Check Node.js version (requires 20+)
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Node.js 20 or higher is required. You have Node.js $(node -v)"
    echo "Please upgrade Node.js: https://nodejs.org/"
    exit 1
fi

# Windows-specific: Check for build tools
if [[ "$(uname -s)" == MINGW* ]] || [[ "$(uname -s)" == MSYS* ]] || [[ "$(uname -s)" == CYGWIN* ]]; then
    # Check if Visual Studio Build Tools are available
    if ! command -v cl &> /dev/null; then
        echo ""
        echo "============================================================"
        echo "  Windows Build Tools Required"
        echo "============================================================"
        echo ""
        echo "To build native modules, you need Visual Studio Build Tools."
        echo ""
        echo "Quick install (run as Administrator in PowerShell):"
        echo "  npm install -g windows-build-tools"
        echo ""
        echo "Or install manually:"
        echo "  1. Download Visual Studio Build Tools from:"
        echo "     https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        echo "  2. Install 'Desktop development with C++' workload"
        echo ""
        echo "After installing, restart your terminal and try again."
        echo "============================================================"
        echo ""
        # Don't exit - node-gyp might still find the tools via other paths
        echo "Attempting to continue anyway..."
    fi
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

    case "$(uname -s)" in
        Darwin)
            # macOS - use clang with C++20
            HOME="$HOME" CXX="clang++ -std=c++20" CC="clang" npx node-gyp rebuild \
                --target="$electron_version" \
                --arch="$(uname -m)" \
                --runtime=electron \
                --dist-url=https://electronjs.org/headers
            ;;
        Linux)
            # Linux - use g++ with C++20
            HOME="$HOME" CXX="g++ -std=c++20" CC="gcc" npx node-gyp rebuild \
                --target="$electron_version" \
                --arch="$(uname -m)" \
                --runtime=electron \
                --dist-url=https://electronjs.org/headers
            ;;
        MINGW*|MSYS*|CYGWIN*)
            # Windows - use MSVC (node-gyp default), set C++20 via msvs_settings
            # Determine architecture
            local arch="x64"
            if [ "$PROCESSOR_ARCHITECTURE" = "ARM64" ]; then
                arch="arm64"
            fi
            npx node-gyp rebuild \
                --target="$electron_version" \
                --arch="$arch" \
                --runtime=electron \
                --dist-url=https://electronjs.org/headers \
                --msvs_version=2022
            ;;
        *)
            echo "Unsupported OS for node-pty rebuild: $(uname -s)"
            exit 1
            ;;
    esac

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

# Build based on mode
# Both dev and prod now use the same app name (GitIDE) so they share local storage
if [ "$BUILD_MODE" = "prod" ]; then
    echo "Building production app with $PKG_MANAGER..."
    $PKG_MANAGER run build:prod
else
    echo "Building development app with $PKG_MANAGER..."
    $PKG_MANAGER run build:dev
fi
APP_NAME="GitIDE"

echo "Launching GitIDE ($BUILD_MODE mode)..."

case "$(uname -s)" in
    Darwin)
        # macOS
        if [ "$(uname -m)" = "arm64" ]; then
            open "./dist/${APP_NAME}-darwin-arm64/${APP_NAME}.app"
        else
            open "./dist/${APP_NAME}-darwin-x64/${APP_NAME}.app"
        fi
        ;;
    Linux)
        # Linux
        if [ "$(uname -m)" = "x86_64" ]; then
            "./dist/${APP_NAME}-linux-x64/gitide"
        else
            "./dist/${APP_NAME}-linux-arm64/gitide"
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        # Windows (Git Bash, MSYS, Cygwin)
        if [ "$PROCESSOR_ARCHITECTURE" = "AMD64" ]; then
            "./dist/${APP_NAME}-win32-x64/GitIDE.exe"
        else
            "./dist/${APP_NAME}-win32-arm64/GitIDE.exe"
        fi
        ;;
    *)
        echo "Unsupported operating system: $(uname -s)"
        exit 1
        ;;
esac
