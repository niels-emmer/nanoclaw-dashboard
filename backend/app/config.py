"""Application settings using Pydantic BaseSettings."""

import json
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, EnvSettingsSource, SettingsConfigDict


class LenientEnvSource(EnvSettingsSource):
    """Env source that falls back to raw strings when JSON parsing fails."""

    def decode_complex_value(self, field_name, field, value):  # type: ignore[override]
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return super().decode_complex_value(field_name, field, value)


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_prefix="NANOCLAW_", env_file=".env", env_file_encoding="utf-8")

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
            dotenv_settings,
            file_secret_settings,
        )

    app_name: str = Field(default="Nanoclaw Dashboard Backend")
    transport: Literal["websocket", "sse"] = Field(default="websocket")
    mock_agent_names: list[str] = Field(
        default_factory=lambda: [
            "seer",
            "navigator",
            "scribe",
            "smith",
            "warden",
        ]
    )
    base_interval_ms: int = Field(default=900, ge=100, le=5000)
    jitter_ms: int = Field(default=350, ge=0, le=5000)
    max_clients: int = Field(default=50, ge=1)

    @field_validator("mock_agent_names", mode="before")
    @classmethod
    def _parse_mock_agents(cls, value: object) -> object:
        if isinstance(value, str):
            items = [item.strip() for item in value.split(",") if item.strip()]
            return items or None
        return value


settings = Settings()
