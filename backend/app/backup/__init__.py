"""Nanoclaw backup / restore support.

Backups read the read-only nanoclaw mount and write archives + restore scripts
into the dashboard's own writable backup folder. Restore is executed by a
host-side script (``restore.sh``) because the nanoclaw data folder is
read-only from the dashboard's perspective.
"""

from .archive import create_backup, list_backups
from .manifest import CATEGORIES, CATEGORY_LABELS
from .restore import compute_plan, generate_restore_script

__all__ = [
    "CATEGORIES",
    "CATEGORY_LABELS",
    "compute_plan",
    "create_backup",
    "generate_restore_script",
    "list_backups",
]