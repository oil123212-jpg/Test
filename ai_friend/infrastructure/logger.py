"""Structured, allowlisted operational logs; never accepts free-form payloads."""
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

EVENTS = {"program_start", "program_end", "devices_ready", "recording_complete",
          "playback_complete", "operation_failed", "operation_complete"}
FIELDS = {"sample_rate", "frames", "duration_ms", "input_count", "output_count", "clipped"}
ERRORS = {"AudioDeviceError", "AudioFormatError", "AuthenticationError", "ConfigurationError",
          "PrivacyPermissionError", "KeyboardInterrupt", "UnexpectedError"}


class OperationalFilter(logging.Filter):
    def filter(self, record):
        return getattr(record, "operational", False) and record.msg in EVENTS and not record.args and not record.exc_info and not record.stack_info


class OperationalFormatter(logging.Formatter):
    def format(self, record):
        # Format only validated fields, regardless of arbitrary LogRecord extras.
        fields = getattr(record, "metrics", {})
        safe = {k: v for k, v in fields.items() if k in FIELDS and type(v) in (int, float, bool)}
        error = getattr(record, "error_type", None)
        if error in ERRORS:
            safe["error_type"] = error
        return f"{self.formatTime(record)} {record.levelname} {record.msg} {safe}"


def configure_logging(level="INFO", log_dir: Path | None = None):
    logger = logging.getLogger("ai_friend")
    for old in logger.handlers[:]:
        logger.removeHandler(old)
        old.close()
    logger.setLevel(level)
    logger.propagate = False
    handlers = [logging.StreamHandler()]
    if log_dir is not None:
        log_dir.mkdir(parents=True, exist_ok=True)
        handlers.append(RotatingFileHandler(log_dir / "operations.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8"))
    for handler in handlers:
        handler.addFilter(OperationalFilter())
        handler.setFormatter(OperationalFormatter())
        logger.addHandler(handler)
    return logger


def log_event(event, *, error_type=None, **metrics):
    if event not in EVENTS:
        raise ValueError("Unknown operational event")
    safe = {k: v for k, v in metrics.items() if k in FIELDS and type(v) in (int, float, bool)}
    error = error_type if error_type in ERRORS else "UnexpectedError" if error_type else None
    logging.getLogger("ai_friend").info(event, extra={"operational": True, "metrics": safe, "error_type": error})
