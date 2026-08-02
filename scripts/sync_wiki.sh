#!/usr/bin/env bash
# Sync docs/ folder to GitHub Wiki.
# Usage: ./scripts/sync_wiki.sh
#
# Prerequisites:
#   1. Create the first wiki page via the GitHub web UI
#      (https://github.com/<owner>/<repo>/wiki/_new) to initialize the wiki repo.
#   2. Then run this script to mirror docs/ into the wiki.

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIKI_DIR="$(mktemp -d)"
OWNER_REPO="$("$ROOT_DIR/scripts/repo_id.sh" 2>/dev/null || echo "niels-emmer/nanoclaw-dashboard")"

cleanup() { rm -rf "$WIKI_DIR"; }
trap cleanup EXIT

log() { printf "[sync-wiki] %s\n" "$*"; }
err() { printf "[sync-wiki][error] %s\n" "$*" >&2; exit 1; }

# Clone wiki repo
log "Cloning wiki repo: $OWNER_REPO"
git clone "https://github.com/${OWNER_REPO}.wiki.git" "$WIKI_DIR"

cd "$WIKI_DIR"

# Remove existing pages
git rm -rf . 2>/dev/null || true

# Copy markdown docs from repo, rename for flat wiki structure
SYNCED=0
while IFS= read -r -d '' src; do
  rel="${src#$ROOT_DIR/}"
  # Skip non-markdown files and threat models (they stay in the repo only)
  case "$rel" in
    docs/threat-models/*) continue ;;
    docs/*.md) ;;
    *) continue ;;
  esac
  # Map docs/ARCHITECTURE.md → Architecture.md, docs/decision-log.md → Decision-Log.md
  basename="$(basename "$rel" .md)"
  case "$basename" in
    ARCHITECTURE) target="Architecture.md" ;;
    decision-log) target="Decision-Log.md" ;;
    *)            target="${basename}.md" ;;
  esac
  cp "$src" "$WIKI_DIR/$target"
  log "  synced $rel → $target"
  SYNCED=$((SYNCED + 1))
done < <(find "$ROOT_DIR/docs" -name '*.md' -print0)

# Update Home.md with index of wiki pages
cat > Home.md <<'HOME'
# Nanoclaw Dashboard

Welcome to the Nanoclaw Dashboard wiki. This wiki is automatically synced
from the repository `docs/` folder — do not edit pages directly here.
Edit the source files in `docs/` instead.

## Pages

- [Architecture](Architecture) — System design, data flow, component responsibilities
- [Decision-Log](Decision-Log) — Architecture Decision Record (ADR) log

## Quick links

- [Repository README](https://github.com/OWNER_REPO_PLACEHOLDER#readme)
- [Contributing](https://github.com/OWNER_REPO_PLACEHOLDER/blob/main/CONTRIBUTING.md)
- [Security](https://github.com/OWNER_REPO_PLACEHOLDER/blob/main/SECURITY.md)
HOME
sed -i '' "s|OWNER_REPO_PLACEHOLDER|${OWNER_REPO}|g" Home.md
SYNCED=$((SYNCED + 1))

if [ "$SYNCED" -eq 0 ]; then
  err "No markdown files found in docs/ to sync."
fi

git add -A
if git diff --cached --quiet; then
  log "Wiki is already up to date."
  exit 0
fi

git commit -m "Sync wiki from repo docs/ ($(date +%Y-%m-%d))"
git push
log "Wiki synced successfully ($SYNCED pages)."
