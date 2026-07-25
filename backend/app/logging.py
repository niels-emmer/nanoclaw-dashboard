"""Structured logging helpers."""

from __future__ import annotations

import logging
from typing import Any

import structlog


def setup_logging() -> None:
    """Configure structlog for JSON output."""

    timestamper = structlog.processors.TimeStamper(fmt="iso")

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            timestamper,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )


def get_logger(*args: Any, **kwargs: Any) -> structlog.stdlib.BoundLogger:
    setup_logging()
    return structlog.get_logger(*args, **kwargs)
