"""Restore planning and host-side restore script generation.

The dashboard backend cannot write to the nanoclaw data folder (read-only
mount by design). Restore therefore works in two stages:

1. **Plan** — the backend computes a conflict plan against the current target
   state (create / skip / overwrite / replace per item) for the UI preview.
2. **Apply** — a self-contained ``restore.sh`` is generated next to the backup
   archive. The user runs it on the nanoclaw host, where the data is writable
   and the service can be stopped/restarted. The script re-computes the plan
   on the host (authoritative) and applies it.
"""

from __future__ import annotations

import json
import sqlite3
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..logging import get_logger
from .collect import TABLE_KEYS
from .manifest import Manifest

log = get_logger(__name__)

# Tables applied in dependency order (FK-safe).
APPLY_ORDER = [
    "agent_groups",
    "users",
    "messaging_groups",
    "container_configs",
    "messaging_group_agents",
    "user_roles",
    "agent_group_members",
    "user_dms",
    "agent_destinations",
    "agent_message_policies",
]


def _target_rows(db_path: Path, table: str) -> set:
    """Return the set of primary-key tuples present in the target table."""
    keys = TABLE_KEYS.get(table)
    if not keys:
        return set()
    conn = None
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        cols = ", ".join(keys)
        return {tuple(r[c] for c in keys) for r in conn.execute(f"SELECT {cols} FROM {table}")}
    except sqlite3.DatabaseError as exc:
        log.warning("backup_plan_query_failed", table=table, error=str(exc))
        return set()
    finally:
        if conn is not None:
            conn.close()


def compute_plan(backup_dir: Path, backup_id: str, root: Path) -> Dict[str, Any]:
    """Compute a conflict plan for restoring ``backup_id`` into ``root``.

    Returns ``{"items": [...], "summary": {...}}``. Each item has
    ``category``, ``item``, ``action`` (create/skip/overwrite/replace) and
    ``reason``.
    """
    # Deferred import avoids a cycle (archive.py imports generate_restore_script).
    from .archive import extract_backup, resolve_backup

    archive = resolve_backup(backup_dir, backup_id)
    items: List[Dict[str, str]] = []
    counts = {"create": 0, "skip": 0, "overwrite": 0, "replace": 0}

    # Deferred import avoids a cycle (archive.py imports generate_restore_script).
    from .archive import extract_backup

    with tempfile.TemporaryDirectory(prefix=".plan-", dir=backup_dir) as tmp:
        staging = Path(tmp)
        manifest = extract_backup(archive, staging)
        central_db = root / "data" / "v2.db"

        # Full-system restore: raw central DB replaces the target.
        if (staging / "data" / "v2.db").is_file():
            items.append({
                "category": "full",
                "item": "data/v2.db",
                "action": "replace",
                "reason": "full-system restore — replaces the central database",
            })
            counts["replace"] += 1

        # Table-level rows.
        for table in APPLY_ORDER:
            table_file = staging / "tables" / f"{table}.json"
            if not table_file.is_file():
                continue
            rows = json.loads(table_file.read_text(encoding="utf-8"))
            keys = TABLE_KEYS[table]
            existing = _target_rows(central_db, table) if central_db.is_file() else set()
            for row in rows:
                key = tuple(row.get(c) for c in keys)
                exists = key in existing
                action = "skip" if exists else "create"
                counts[action] += 1
                items.append({
                    "category": "agents" if table in ("agent_groups", "container_configs") else table,
                    "item": f"{table}:{'/'.join(str(k) for k in key)}",
                    "action": action,
                    "reason": "already present on target" if exists else "new row",
                })

        # Group folders (instructions, memory, other files).
        groups_dir = staging / "groups"
        if groups_dir.is_dir():
            for folder in sorted(p.name for p in groups_dir.iterdir() if p.is_dir()):
                target = root / "groups" / folder
                exists = target.is_dir()
                items.append({
                    "category": "agents",
                    "item": f"groups/{folder}/",
                    "action": "skip" if exists else "create",
                    "reason": "folder already exists" if exists else "new folder",
                })
                counts["skip" if exists else "create"] += 1

        # Memory trees.
        memory_dir = staging / "memory"
        if memory_dir.is_dir():
            for folder in sorted(p.name for p in memory_dir.iterdir() if p.is_dir()):
                target = root / "groups" / folder / "memory"
                exists = target.is_dir()
                items.append({
                    "category": "memory",
                    "item": f"groups/{folder}/memory/",
                    "action": "skip" if exists else "create",
                    "reason": "memory already exists" if exists else "new memory tree",
                })
                counts["skip" if exists else "create"] += 1

        # Shared base instructions.
        shared = staging / "container" / "CLAUDE.md"
        if shared.is_file():
            exists = (root / "container" / "CLAUDE.md").is_file()
            items.append({
                "category": "full",
                "item": "container/CLAUDE.md",
                "action": "skip" if exists else "create",
                "reason": "already present" if exists else "new file",
            })
            counts["skip" if exists else "create"] += 1

        # Environment.
        if (staging / "env.enc").is_file():
            exists = (root / ".env").is_file()
            items.append({
                "category": "env",
                "item": ".env",
                "action": "overwrite" if exists else "create",
                "reason": "replaces the current .env (decrypted from backup)" if exists else "new .env",
            })
            counts["overwrite" if exists else "create"] += 1

        # Conversation history.
        sessions_dir = staging / "sessions"
        if sessions_dir.is_dir():
            target_sessions = root / "data" / "v2-sessions"
            exists = target_sessions.is_dir()
            items.append({
                "category": "history",
                "item": "data/v2-sessions/",
                "action": "skip" if exists else "create",
                "reason": "session history already present" if exists else "new session history",
            })
            counts["skip" if exists else "create"] += 1

        # Scheduled tasks.
        tasks_file = staging / "tasks" / "tasks.json"
        if tasks_file.is_file():
            tasks = json.loads(tasks_file.read_text(encoding="utf-8"))
            items.append({
                "category": "tasks",
                "item": f"scheduled tasks ({len(tasks)} rows)",
                "action": "create",
                "reason": "task rows are inserted into their session mailboxes",
            })
            counts["create"] += 1

    return {
        "items": items,
        "summary": {
            "create": counts["create"],
            "skip": counts["skip"],
            "overwrite": counts["overwrite"],
            "replace": counts["replace"],
            "total": len(items),
            "full_restore": any(i["action"] == "replace" for i in items),
            "schema_version": manifest.schema_version,
            "nanoclaw_version": manifest.nanoclaw_version,
        },
    }


# ---------------------------------------------------------------------------
# Restore script generation
# ---------------------------------------------------------------------------

def generate_restore_script(backup_id: str, archive_name: str) -> str:
    """Return the self-contained host-side restore script for a backup."""
    return _RESTORE_TEMPLATE.replace("__BACKUP_ID__", backup_id).replace(
        "__ARCHIVE_NAME__", archive_name
    )


_RESTORE_TEMPLATE = r"""#!/usr/bin/env bash
# ============================================================================
# Nanoclaw backup restore — __BACKUP_ID__
#
# Restores a nanoclaw backup archive into a nanoclaw install. Run this script
# from the nanoclaw-dashboard folder ON THE NANOCLAW HOST — the archive sits
# next to this script in backups/.
#
# Usage:
#   bash backups/__BACKUP_ID__.sh plan   [--passphrase ...]
#   bash backups/__BACKUP_ID__.sh restore [--yes] [--overwrite] [--passphrase ...]
#   bash backups/__BACKUP_ID__.sh import  [--yes] [--overwrite] [--passphrase ...]
#
#   plan     — dry-run: show what would be created / skipped / overwritten.
#   restore  — full restore: stops the service, replaces state, restarts.
#              Intended for a fresh/empty instance (use --yes to force onto a
#              populated one).
#   import   — partial import into an existing instance: stops the service,
#              applies the backup's categories, restarts.
#
# Options:
#   --overwrite   replace existing rows/files instead of skipping them
#   --yes         skip the confirmation prompt
#   --passphrase  passphrase for the encrypted .env (prompts if omitted)
#
# Environment:
#   NANOCLAW_ROOT  path to the nanoclaw checkout (auto-detected if unset)
#
# Notes:
#   - The OneCLI Agent Vault is NOT part of this backup. After restoring to a
#     fresh host, reconnect the vault (ONECLI_URL / ONECLI_API_KEY in .env)
#     before agents can reach their providers.
#   - data/upgrade-state.json is never restored. After a full restore, re-stamp
#     it from the nanoclaw checkout:  pnpm exec tsx scripts/upgrade-state.ts set
# ============================================================================
set -euo pipefail

BACKUP_ID="__BACKUP_ID__"
ARCHIVE_NAME="__ARCHIVE_NAME__"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE="$SCRIPT_DIR/$ARCHIVE_NAME"

MODE="${1:-plan}"
shift || true

OVERWRITE=0
YES=0
PASSPHRASE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --overwrite) OVERWRITE=1 ;;
    --yes) YES=1 ;;
    --passphrase)
      if [[ $# -lt 2 || "$2" == -* ]]; then
        echo "error: --passphrase requires a value" >&2; exit 2
      fi
      PASSPHRASE="$2"; shift ;;
    *) echo "error: unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

case "$MODE" in
  plan|restore|import) ;;
  *) echo "error: usage: $0 {plan|restore|import} [--yes] [--overwrite] [--passphrase ...]" >&2; exit 2 ;;
esac

# ---- Locate the nanoclaw checkout ------------------------------------------
if [[ -z "${NANOCLAW_ROOT:-}" ]]; then
  for d in "$PWD" "$PWD/.." "$PWD/../.." "$HOME/nanoclaw"; do
    if [[ -f "$d/data/v2.db" ]]; then NANOCLAW_ROOT="$d"; break; fi
  done
fi
if [[ -z "${NANOCLAW_ROOT:-}" || ! -f "$NANOCLAW_ROOT/data/v2.db" ]]; then
  echo "error: cannot locate the nanoclaw checkout (set NANOCLAW_ROOT)" >&2
  exit 2
fi
echo "nanoclaw root: $NANOCLAW_ROOT"

# ---- Extract + verify integrity --------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "extracting $ARCHIVE_NAME ..."
# Reject traversal and non-regular members before extracting (GNU tar does
# not by default): '..' paths and symlinks/hardlinks/devices. Absolute paths
# are stripped by tar on extraction and additionally neutralized by the
# helper's relative-path copies.
if tar -tvzf "$ARCHIVE" | grep -E '(^|/)\.\.(/|$)|^[lhbcp]' >/dev/null; then
  echo "error: archive contains unsafe paths or member types — refusing to extract" >&2
  exit 2
fi
tar -xzf "$ARCHIVE" -C "$TMP"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required (the nanoclaw host runs Node 22+)" >&2
  exit 2
fi
if [[ ! -d "$NANOCLAW_ROOT/node_modules/better-sqlite3" ]]; then
  echo "error: better-sqlite3 not found in $NANOCLAW_ROOT/node_modules — run 'pnpm install' in the nanoclaw checkout first" >&2
  exit 2
fi

# ---- Locate a node that can load the checkout's better-sqlite3 ----------------
# The nanoclaw service often runs an nvm-managed Node (e.g. v22) while the
# system `node` is newer; the pnpm-store native binding is compiled for the
# service's ABI and fails to dlopen under a mismatched Node. Probe candidates
# and pick the first that loads better-sqlite3.
find_node() {
  local candidates=()
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    [[ -x "$d/node" ]] && candidates+=("$d/node")
  done
  candidates+=("$(command -v node || true)")
  local n
  for n in "${candidates[@]}"; do
    # Probe with an actual open: better-sqlite3 defers the native binding load
    # to the constructor, so require() alone passes even when the binding
    # cannot dlopen under a mismatched Node ABI.
    if [[ -n "$n" ]] && (cd "$NANOCLAW_ROOT" && "$n" -e "const D=require('better-sqlite3'); new D(':memory:')" >/dev/null 2>&1); then
      echo "$n"
      return 0
    fi
  done
  echo ""
}
NODE_BIN="$(find_node)"
if [[ -z "$NODE_BIN" ]]; then
  echo "error: no node binary can load better-sqlite3 from $NANOCLAW_ROOT — run 'pnpm install' with the nanoclaw service's node" >&2
  exit 2
fi
echo "using node: $NODE_BIN"

echo "verifying archive integrity ..."
(cd "$TMP" && "$NODE_BIN" -e "
  const fs = require('fs'), crypto = require('crypto');
  const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  let bad = 0;
  for (const f of m.files) {
    const h = crypto.createHash('sha256');
    h.update(fs.readFileSync(f.path));
    if (h.digest('hex') !== f.sha256) { console.error('checksum mismatch: ' + f.path); bad++; }
  }
  if (bad) process.exit(1);
  console.log('ok (' + m.files.length + ' files)');
")

# ---- Mode semantics ----------------------------------------------------------
IS_FULL=0
[[ -f "$TMP/data/v2.db" ]] && IS_FULL=1
if [[ "$MODE" = "restore" && "$IS_FULL" != 1 ]]; then
  echo "error: 'restore' requires a full-system backup (contains data/v2.db). Use 'import' for partial category backups." >&2
  exit 2
fi
if [[ "$MODE" = "import" && "$IS_FULL" = 1 ]]; then
  echo "warning: this is a full-system backup — 'import' will replace the central database. Use 'restore' for fresh-instance restores." >&2
fi

# ---- Node helper (plan + apply) --------------------------------------------
cat > "$TMP/helper.cjs" <<'NODE'
const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const [root, staging, mode, policy] = process.argv.slice(2)
const manifest = JSON.parse(fs.readFileSync(path.join(staging, 'manifest.json'), 'utf8'))
const dbPath = path.join(root, 'data', 'v2.db')

const TABLE_KEYS = {
  agent_groups: ['id'],
  container_configs: ['agent_group_id'],
  messaging_groups: ['id'],
  messaging_group_agents: ['id'],
  users: ['id'],
  user_roles: ['user_id', 'role', 'agent_group_id'],
  agent_group_members: ['user_id', 'agent_group_id'],
  user_dms: ['user_id', 'channel_type'],
  agent_destinations: ['agent_group_id', 'local_name'],
  agent_message_policies: ['from_agent_group_id', 'to_agent_group_id'],
}
const APPLY_ORDER = ['agent_groups','users','messaging_groups','container_configs','messaging_group_agents','user_roles','agent_group_members','user_dms','agent_destinations','agent_message_policies']

const isFull = fs.existsSync(path.join(staging, 'data', 'v2.db'))
const plan = []
const counts = { create: 0, skip: 0, overwrite: 0, replace: 0 }

// Full-system restore: replace the central database wholesale (before opening
// a connection, so the new file is the one we read).
if (isFull) {
  if (mode === 'plan') {
    plan.push({ category: 'full', item: 'data/v2.db', action: 'replace', reason: 'full-system restore — replaces the central database' })
    counts.replace++
  } else {
    fs.copyFileSync(path.join(staging, 'data', 'v2.db'), dbPath)
    counts.replace++
  }
}

const db = new Database(dbPath, { readonly: mode === 'plan' })
try {
  if (!isFull) {
    // Partial import: recreate any tables missing on the target (fresh DB).
    // Only CREATE TABLE statements for the known config tables are allowed —
    // archive-supplied SQL is never executed verbatim.
    const schemaFile = path.join(staging, 'tables', 'schema.sql')
    if (fs.existsSync(schemaFile)) {
      const allowed = new Set(APPLY_ORDER)
      const stmts = fs.readFileSync(schemaFile, 'utf8').split(';').map(s => s.trim()).filter(Boolean)
      for (const stmt of stmts) {
        const m = /^CREATE TABLE IF NOT EXISTS (\w+)\b/i.exec(stmt)
        if (!m || !allowed.has(m[1])) {
          throw new Error('schema.sql contains disallowed statements — refusing to apply')
        }
      }
      db.exec(stmts.join(';'))
    }
    for (const table of APPLY_ORDER) {
      const file = path.join(staging, 'tables', table + '.json')
      if (!fs.existsSync(file)) continue
      const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
      const keyCols = TABLE_KEYS[table]
      const targetCols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
      const cols = Object.keys(rows[0] || {}).filter(c => targetCols.includes(c))
      if (!cols.length) continue
      const existsStmt = db.prepare(`SELECT 1 FROM ${table} WHERE ${keyCols.map(c => `${c} = ?`).join(' AND ')} LIMIT 1`)
      const insert = db.prepare(`INSERT OR ${policy === 'overwrite' ? 'REPLACE' : 'IGNORE'} INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      for (const row of rows) {
        const key = keyCols.map(c => row[c])
        const exists = !!existsStmt.get(...key)
        if (mode === 'plan') {
          const action = exists ? 'skip' : 'create'
          counts[action]++
          plan.push({ category: table, item: `${table}:${key.join('/')}`, action, reason: exists ? 'already present on target' : 'new row' })
        } else {
          insert.run(...cols.map(c => row[c]))
          if (exists && policy === 'overwrite') counts.overwrite++
          else if (!exists) counts.create++
          else counts.skip++
        }
      }
    }
  }

  // Group folders + memory + shared base + sessions (file copies).
  const fileItems = [
    ['groups', path.join(root, 'groups')],
    ['memory', path.join(root, 'groups')],
    ['container', path.join(root, 'container')],
    ['sessions', path.join(root, 'data', 'v2-sessions')],
  ]
  for (const [cat, targetBase] of fileItems) {
    const srcBase = path.join(staging, cat)
    if (!fs.existsSync(srcBase)) continue
    for (const entry of fs.readdirSync(srcBase)) {
      const src = path.join(srcBase, entry)
      const target = cat === 'memory' ? path.join(targetBase, entry, 'memory') : path.join(targetBase, entry)
      const exists = fs.existsSync(target)
      if (mode === 'plan') {
        const action = exists ? 'skip' : 'create'
        counts[action]++
        plan.push({ category: cat, item: `${cat}/${entry}/`, action, reason: exists ? 'already present on target' : 'new' })
      } else if (exists) {
        if (policy !== 'overwrite') { counts.skip++; continue }
        fs.rmSync(target, { recursive: true, force: true })
        fs.cpSync(src, target, { recursive: true })
        counts.overwrite++
      } else {
        fs.cpSync(src, target, { recursive: true })
        counts.create++
      }
    }
  }

  // Scheduled tasks → session mailboxes.
  const tasksFile = path.join(staging, 'tasks', 'tasks.json')
  if (fs.existsSync(tasksFile)) {
    const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'))
    if (mode === 'plan') {
      counts.create += tasks.length
      plan.push({ category: 'tasks', item: `scheduled tasks (${tasks.length} rows)`, action: 'create', reason: 'task rows are inserted into their session mailboxes' })
    } else {
      let inserted = 0, skipped = 0
      for (const t of tasks) {
        const rel = t.session_path
        // Reject traversal: session paths are server-generated
        // (<agent_group_id>/<session_id>) and must stay under v2-sessions.
        if (!rel || typeof rel !== 'string' || rel.startsWith('/') || rel.split(/[\\/]/).includes('..')) { skipped++; continue }
        const inbound = path.join(root, 'data', 'v2-sessions', rel, 'inbound.db')
        if (!fs.existsSync(inbound)) { skipped++; continue }
        const sdb = new Database(inbound)
        try {
          const cols = Object.keys(t).filter(c => c !== 'session_path')
          const targetCols = sdb.prepare('PRAGMA table_info(messages_in)').all().map(c => c.name)
          const use = cols.filter(c => targetCols.includes(c))
          const exists = sdb.prepare('SELECT 1 FROM messages_in WHERE id = ?').get(t.id)
          if (exists && policy !== 'overwrite') { skipped++; continue }
          sdb.prepare(`INSERT OR ${policy === 'overwrite' ? 'REPLACE' : 'IGNORE'} INTO messages_in (${use.join(',')}) VALUES (${use.map(() => '?').join(',')})`).run(...use.map(c => t[c]))
          inserted++
        } finally { sdb.close() }
      }
      counts.create += inserted
      counts.skip += skipped
    }
  }
} finally {
  db.close()
}

if (mode === 'plan') {
  console.log('\nRestore plan for ' + manifest.backup_id + ':')
  console.log('  ' + '-'.repeat(72))
  for (const p of plan) {
    console.log(`  [${p.action.padEnd(9)}] ${p.item} — ${p.reason}`)
  }
  console.log('  ' + '-'.repeat(72))
  console.log(`  summary: ${counts.create} create, ${counts.skip} skip, ${counts.overwrite} overwrite, ${counts.replace} replace`)
  if (isFull) console.log('  note: this is a FULL-SYSTEM restore (replaces the central database).')
} else {
  console.log(`applied: ${counts.create} created, ${counts.skip} skipped, ${counts.overwrite} overwritten, ${counts.replace} replaced`)
}
NODE

POLICY="skip"
[[ "$OVERWRITE" = 1 ]] && POLICY="overwrite"

# ---- Version compatibility check -------------------------------------------
BACKUP_SCHEMA="$("$NODE_BIN" -e "const m=require('$TMP/manifest.json'); console.log(m.schema_version || '')")"
TARGET_SCHEMA="$(cd "$NANOCLAW_ROOT" && "$NODE_BIN" -e "const D=require('better-sqlite3'); const db=new D('data/v2.db',{readonly:true}); try{console.log(db.prepare('SELECT MAX(version) v FROM schema_version').get().v||'')}catch(e){console.log('')}")"
if [[ -n "$BACKUP_SCHEMA" && -n "$TARGET_SCHEMA" && "$BACKUP_SCHEMA" -gt "$TARGET_SCHEMA" ]]; then
  echo "error: backup schema v$BACKUP_SCHEMA is newer than target v$TARGET_SCHEMA — refusing to downgrade" >&2
  exit 3
fi
if [[ -n "$BACKUP_SCHEMA" && -n "$TARGET_SCHEMA" && "$BACKUP_SCHEMA" -lt "$TARGET_SCHEMA" ]]; then
  echo "warning: backup schema v$BACKUP_SCHEMA is older than target v$TARGET_SCHEMA — nanoclaw migrations will upgrade it on startup"
fi

# ---- Plan mode --------------------------------------------------------------
if [[ "$MODE" = "plan" ]]; then
  NODE_PATH="$NANOCLAW_ROOT/node_modules" "$NODE_BIN" "$TMP/helper.cjs" "$NANOCLAW_ROOT" "$TMP" plan "$POLICY"
  exit 0
fi

# ---- Service control ---------------------------------------------------------
detect_service() {
  local plist
  plist="$(ls "$HOME/Library/LaunchAgents/"com.nanoclaw-v2-*.plist 2>/dev/null | head -1 || true)"
  if [[ -n "$plist" ]]; then echo "launchd:$plist"; return 0; fi
  if command -v systemctl >/dev/null 2>&1 && systemctl --user list-units 'nanoclaw-v2-*' >/dev/null 2>&1; then echo "systemd-user"; return 0; fi
  if [[ -f "$NANOCLAW_ROOT/nanoclaw.pid" ]]; then echo "nohup"; return 0; fi
  echo "unknown"
}

SERVICE="$(detect_service)"
echo "service: $SERVICE"

stop_service() {
  case "$SERVICE" in
    launchd:*)
      local plist="${SERVICE#launchd:}"
      launchctl unload "$plist" ;;
    systemd-user)
      systemctl --user stop 'nanoclaw-v2-*' ;;
    nohup)
      if [[ -f "$NANOCLAW_ROOT/nanoclaw.pid" ]]; then
        kill "$(cat "$NANOCLAW_ROOT/nanoclaw.pid")" 2>/dev/null || true
      fi ;;
    *)
      echo "warning: unknown service type — assuming nanoclaw is not running" ;;
  esac
}

start_service() {
  case "$SERVICE" in
    launchd:*)
      local plist="${SERVICE#launchd:}"
      launchctl load "$plist" ;;
    systemd-user)
      systemctl --user start 'nanoclaw-v2-*' ;;
    nohup)
      (cd "$NANOCLAW_ROOT" && bash start-nanoclaw.sh >/dev/null 2>&1 &) ;;
    *)
      echo "warning: unknown service type — start nanoclaw manually" ;;
  esac
}

health_check() {
  local tries=0
  while [[ $tries -lt 30 ]]; do
    if (cd "$NANOCLAW_ROOT" && ./bin/ncl groups list >/dev/null 2>&1); then
      echo "health check OK"
      return 0
    fi
    tries=$((tries + 1))
    sleep 2
  done
  echo "warning: health check did not pass within 60s — inspect $NANOCLAW_ROOT/logs/nanoclaw.log" >&2
  return 1
}

# ---- Confirmation ------------------------------------------------------------
if [[ "$YES" != 1 ]]; then
  echo ""
  echo "This will STOP the nanoclaw service and apply the backup."
  read -r -p "Continue? [y/N] " answer
  if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "aborted"
    exit 1
  fi
fi

# ---- Stop first, then snapshot (WAL-safe), then apply -------------------------
# The service must be stopped before snapshotting so the copied v2.db is
# consistent. The restart trap is installed BEFORE stopping so any failure in
# the stop/snapshot/apply window still brings the service back up.
restart_on_failure() {
  echo "error: restore failed — restarting nanoclaw service" >&2
  start_service
}
trap 'restart_on_failure' ERR

echo "stopping nanoclaw service ..."
stop_service
sleep 2

SNAPSHOT_DIR="$SCRIPT_DIR/pre-restore-$BACKUP_ID-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SNAPSHOT_DIR"
chmod 700 "$SNAPSHOT_DIR"
echo "snapshotting current state to $SNAPSHOT_DIR ..."
if [[ -f "$NANOCLAW_ROOT/data/v2.db" ]]; then cp "$NANOCLAW_ROOT/data/v2.db" "$SNAPSHOT_DIR/v2.db"; fi
if [[ -d "$NANOCLAW_ROOT/groups" ]]; then cp -R "$NANOCLAW_ROOT/groups" "$SNAPSHOT_DIR/groups"; fi
if [[ -f "$NANOCLAW_ROOT/.env" ]]; then cp "$NANOCLAW_ROOT/.env" "$SNAPSHOT_DIR/.env" && chmod 600 "$SNAPSHOT_DIR/.env"; fi

echo "applying backup ..."
NODE_PATH="$NANOCLAW_ROOT/node_modules" "$NODE_BIN" "$TMP/helper.cjs" "$NANOCLAW_ROOT" "$TMP" apply "$POLICY"

# .env (encrypted) — decrypt with the passphrase (via stdin, not argv, so it
# does not show up in the process list).
if [[ -f "$TMP/env.enc" ]]; then
  if [[ -z "$PASSPHRASE" ]]; then
    read -r -s -p "Passphrase for encrypted .env: " PASSPHRASE
    echo ""
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    echo "error: openssl is required to decrypt .env" >&2
    exit 2
  fi
  openssl enc -d -aes-256-cbc -pbkdf2 -pass stdin -in "$TMP/env.enc" -out "$NANOCLAW_ROOT/.env" <<< "$PASSPHRASE"
  chmod 600 "$NANOCLAW_ROOT/.env"
  echo "restored .env (decrypted)"
fi

trap - ERR

echo "starting nanoclaw service ..."
start_service

if [[ "$SERVICE" != "unknown" ]]; then
  if ! health_check; then
    echo "restore applied but the service did not come up cleanly — snapshot kept at $SNAPSHOT_DIR" >&2
    exit 1
  fi
else
  echo "note: no managed service detected — skipping health check (start nanoclaw manually if needed)"
fi

echo ""
echo "restore complete."
echo "  snapshot of previous state: $SNAPSHOT_DIR"
echo "  next steps:"
echo "    - If this was a fresh host, reconnect the OneCLI Agent Vault (ONECLI_URL / ONECLI_API_KEY)."
echo "    - Re-stamp the upgrade marker if prompted:  (cd $NANOCLAW_ROOT && pnpm exec tsx scripts/upgrade-state.ts set)"
echo "    - Verify each channel with a test message."
"""


def plan_to_text(plan: Dict[str, Any]) -> str:
    """Render a plan dict as human-readable text (for API responses)."""
    lines = [f"Restore plan: {plan['summary']['total']} items"]
    for item in plan["items"]:
        lines.append(f"  [{item['action']:<9}] {item['item']} — {item['reason']}")
    s = plan["summary"]
    lines.append(
        f"  summary: {s['create']} create, {s['skip']} skip, "
        f"{s['overwrite']} overwrite, {s['replace']} replace"
    )
    return "\n".join(lines)