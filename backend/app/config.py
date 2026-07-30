"""Application settings using Pydantic BaseSettings."""

import json
from pathlib import Path
from typing import Literal, Optional

from pydantic import Field, field_validator
from pydantic_settings import (
    BaseSettings,
    DotEnvSettingsSource,
    EnvSettingsSource,
    SettingsConfigDict,
)


class LenientEnvSource(EnvSettingsSource):
    """Env source that falls back to raw strings when JSON parsing fails."""

    def decode_complex_value(self, field_name, field, value):  # type: ignore[override]
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return super().decode_complex_value(field_name, field, value)


class LenientDotEnvSource(DotEnvSettingsSource):
    """DotEnv source that falls back to raw strings when JSON parsing fails."""

    def decode_complex_value(self, field_name, field, value):  # type: ignore[override]
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return super().decode_complex_value(field_name, field, value)


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_prefix="NANOCLAW_", env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        return (
            init_settings,
            LenientEnvSource(settings_cls),
            LenientDotEnvSource(settings_cls),
            file_secret_settings,
        )

    app_name: str = Field(default="Nanoclaw Dashboard Backend")
    transport: Literal["websocket", "sse"] = Field(default="websocket")
    mock_agent_names: list[str] = Field(
        default_factory=lambda: [
            "researcher",
            "coder",
            "architect",
            "editor",
            "terminal",
            "plotter",
        ]
    )
    base_interval_ms: int = Field(default=900, ge=100, le=5000)
    jitter_ms: int = Field(default=350, ge=0, le=5000)
    max_clients: int = Field(default=50, ge=1)
    event_buffer_size: int = Field(default=100, ge=0, le=1000)
    allowed_origins: list[str] = Field(default_factory=list)

    # Nanoclaw integration
    enabled: bool = Field(default=False)
    root: str = Field(default=str(Path.home() / "nanoclaw"))
    poll_interval_ms: int = Field(default=750, ge=100, le=10_000)
    history_events: int = Field(default=20, ge=0, le=200)
    orchestrator_group: Optional[str] = Field(default=None)

    @field_validator("mock_agent_names", "allowed_origins", mode="before")
    @classmethod
    def _parse_list_from_str(cls, value: object) -> object:
        if isinstance(value, str):
            items = [item.strip() for item in value.split(",") if item.strip()]
            return items or None
        return value

    @property
    def root_path(self) -> Path:
        return Path(self.root).expanduser()


settings = Settings()
