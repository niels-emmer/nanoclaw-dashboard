#!/usr/bin/env bash
# Print the GitHub owner/repo identifier for the current repo.
set -euo pipefail
git remote get-url origin 2>/dev/null \
  | sed -n 's|.*github.com[:\/]\(.*\)\.git.*|\1|p'
