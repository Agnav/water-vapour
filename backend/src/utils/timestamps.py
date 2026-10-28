"""UTC timestamp parsing and validation helpers."""

from datetime import datetime, timezone

from fastapi import HTTPException


def parse_source_utc(value: str, field_name: str) -> datetime:
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise RuntimeError(f"Invalid {field_name} timestamp in source data: {value!r}") from error
    if timestamp.tzinfo is None or timestamp.utcoffset() != timezone.utc.utcoffset(timestamp):
        raise RuntimeError(f"{field_name} timestamp must be UTC: {value!r}")
    return timestamp.astimezone(timezone.utc)


def require_whole_hour_utc(timestamp: datetime, parameter_name: str) -> datetime:
    if timestamp.tzinfo is None or timestamp.utcoffset() != timezone.utc.utcoffset(timestamp):
        raise HTTPException(status_code=422, detail=f"{parameter_name} must be a UTC timestamp")
    timestamp = timestamp.astimezone(timezone.utc)
    if any((timestamp.minute, timestamp.second, timestamp.microsecond)):
        raise HTTPException(status_code=422, detail=f"{parameter_name} must be aligned to a whole UTC hour")
    return timestamp
