"""Validated configuration. Phase 0 does not require API credentials or models."""
from dataclasses import dataclass, field
from pathlib import Path
from collections.abc import Mapping
import os
from urllib.parse import urlsplit
from dotenv import dotenv_values
from infrastructure.exceptions import ConfigurationError


@dataclass(frozen=True)
class Config:
    app_env: str = "development"
    log_level: str = "INFO"
    audio_sample_rate: int = 24000
    audio_channels: int = 1
    audio_input_device: int | None = None
    audio_output_device: int | None = None
    ai_provider: str = "openai"
    openai_realtime_model: str = ""
    gemini_live_model: str = ""
    auth_server_url: str = field(default="", repr=False)
    device_id: str = field(default="", repr=False)
    enable_audio_storage: bool = False
    enable_transcript_storage: bool = False

    @classmethod
    def load(cls, env: Mapping[str, str] | None = None, env_file: Path | None = None):
        values = dict(dotenv_values(env_file or Path(__file__).with_name(".env"), interpolate=False))
        values.update(os.environ if env is None else env)

        def integer(name, default, low, high):
            try:
                value = int(values.get(name, str(default)))
                if not low <= value <= high:
                    raise ValueError
                return value
            except (ValueError, TypeError):
                raise ConfigurationError(f"{name}: integer in [{low}, {high}] required") from None

        def choice(name, default, choices):
            value = values.get(name, default)
            if value not in choices:
                raise ConfigurationError(f"{name}: expected one of {', '.join(choices)}")
            return value

        def boolean(name):
            value = values.get(name, "false")
            if not isinstance(value, str) or value.lower() not in {"true", "false"}:
                raise ConfigurationError(f"{name}: true or false required")
            return value.lower() == "true"

        def device(name):
            return None if not values.get(name) else integer(name, 0, 0, 65535)

        url = values.get("AUTH_SERVER_URL", "") or ""
        if url:
            try:
                parsed = urlsplit(url)
                valid = parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password and not parsed.fragment
                parsed.port
            except ValueError:
                valid = False
            if not valid:
                raise ConfigurationError("AUTH_SERVER_URL: HTTPS URL without embedded credentials required")
        return cls(
            app_env=choice("APP_ENV", "development", ("development", "test", "production")),
            log_level=choice("LOG_LEVEL", "INFO", ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")),
            audio_sample_rate=integer("AUDIO_SAMPLE_RATE", 24000, 8000, 192000),
            audio_channels=integer("AUDIO_CHANNELS", 1, 1, 2),
            audio_input_device=device("AUDIO_INPUT_DEVICE"),
            audio_output_device=device("AUDIO_OUTPUT_DEVICE"),
            ai_provider=choice("AI_PROVIDER", "openai", ("openai", "gemini")),
            openai_realtime_model=values.get("OPENAI_REALTIME_MODEL", "") or "",
            gemini_live_model=values.get("GEMINI_LIVE_MODEL", "") or "",
            auth_server_url=url, device_id=values.get("DEVICE_ID", "") or "",
            enable_audio_storage=boolean("ENABLE_AUDIO_STORAGE"),
            enable_transcript_storage=boolean("ENABLE_TRANSCRIPT_STORAGE"),
        )
