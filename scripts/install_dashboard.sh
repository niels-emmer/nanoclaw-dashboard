#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PYTHON_BIN=${PYTHON_BIN:-python3}
NODE_VERSION="20.19.0"
TOOLS_DIR="$ROOT_DIR/.tools"
NODE_DEST="$TOOLS_DIR/node"
VENV_DIR="$ROOT_DIR/.venv"

log() {
  printf "[install] %s\n" "$*"
}

err() {
  printf "[install][error] %s\n" "$*" >&2
  exit 1
}

ensure_python() {
  if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    err "python binary '$PYTHON_BIN' not found. Set PYTHON_BIN to a Python 3.11+ interpreter."
  fi
}

ensure_python_venv() {
  if [ ! -d "$VENV_DIR" ]; then
    log "Creating virtualenv at $VENV_DIR"
    "$PYTHON_BIN" -m venv "$VENV_DIR"
  else
    log "Virtualenv already exists at $VENV_DIR"
  fi
  source "$VENV_DIR/bin/activate"
  pip install --upgrade pip
  pip install -r "$ROOT_DIR/backend/requirements.txt"
  deactivate
}

detect_node_pkg() {
  local os
  os=$(uname -s)
  local arch
  arch=$(uname -m)
  case "$os" in
    Darwin)
      case "$arch" in
        arm64) echo "node-v${NODE_VERSION}-darwin-arm64" ;;
        x86_64) echo "node-v${NODE_VERSION}-darwin-x64" ;;
        *) err "Unsupported macOS architecture: $arch" ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64) echo "node-v${NODE_VERSION}-linux-x64" ;;
        arm64|aarch64) echo "node-v${NODE_VERSION}-linux-arm64" ;;
        *) err "Unsupported Linux architecture: $arch" ;;
      esac
      ;;
    *) err "Unsupported OS: $os" ;;
  esac
}

ensure_node() {
  mkdir -p "$TOOLS_DIR"
  local current
  if [ -x "$NODE_DEST/bin/node" ]; then
    current=$("$NODE_DEST/bin/node" -v)
    if [ "${current#v}" = "$NODE_VERSION" ]; then
      log "Node $NODE_VERSION already installed"
      return
    fi
    log "Found Node $current but need $NODE_VERSION; replacing"
    rm -rf "$NODE_DEST"
  fi

  local pkg
  pkg=$(detect_node_pkg)
  local url="https://nodejs.org/dist/v${NODE_VERSION}/${pkg}.tar.gz"
  local tmp
  tmp=$(mktemp)
  log "Downloading Node $NODE_VERSION from $url"
  curl -fsSL "$url" -o "$tmp"
  tar -xzf "$tmp" -C "$TOOLS_DIR"
  rm "$tmp"
  mv "$TOOLS_DIR/$pkg" "$NODE_DEST"
}

install_frontend() {
  PATH="$NODE_DEST/bin:$PATH" npm --version >/dev/null || err "Node not installed correctly"
  log "Installing frontend dependencies"
  PATH="$NODE_DEST/bin:$PATH" npm --prefix "$ROOT_DIR/frontend" install
}

run_checks() {
  log "Running backend tests"
  source "$VENV_DIR/bin/activate"
  (cd "$ROOT_DIR/backend" && pytest)
  deactivate

  log "Running frontend lint + build"
  PATH="$NODE_DEST/bin:$PATH" npm --prefix "$ROOT_DIR/frontend" run lint
  PATH="$NODE_DEST/bin:$PATH" npm --prefix "$ROOT_DIR/frontend" run build
}

main() {
  ensure_python
  ensure_python_venv
  ensure_node
  install_frontend
  run_checks
  cat <<'EOF'

Dashboard installation complete.
- Backend virtualenv: .venv (activate with `source .venv/bin/activate`)
- Start backend: `cd backend && uvicorn app.main:app --reload`
- Start frontend: `PATH=$PWD/.tools/node/bin:$PATH && cd frontend && npm run dev`
EOF
}

main "$@"
