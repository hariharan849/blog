import os
from dataclasses import dataclass
from functools import lru_cache
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class Settings:
    table_name: str
    timezone: ZoneInfo
    lookback_hours: int
    digest_to: list[str]
    digest_from: str
    site_url: str
    revalidate_url: str
    revalidate_secret_param: str
    admin_token_param: str
    ingest_function_name: str


def _list(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@lru_cache(maxsize=1)
def settings() -> Settings:
    env = os.environ
    return Settings(
        table_name=env.get("TABLE_NAME", "DailyDose"),
        timezone=ZoneInfo(env.get("TIMEZONE", "UTC")),
        lookback_hours=int(env.get("LOOKBACK_HOURS", "48")),
        digest_to=_list(env.get("DIGEST_TO", "")),
        digest_from=env.get("DIGEST_FROM", ""),
        site_url=env.get("SITE_URL", "").rstrip("/"),
        revalidate_url=env.get("REVALIDATE_URL", ""),
        revalidate_secret_param=env.get("REVALIDATE_SECRET_PARAM", ""),
        admin_token_param=env.get("ADMIN_TOKEN_PARAM", ""),
        ingest_function_name=env.get("INGEST_FUNCTION_NAME", ""),
    )


@lru_cache(maxsize=8)
def secret(param_name: str) -> str:
    """Read an SSM SecureString once per container. Empty name -> empty secret."""
    if not param_name:
        return ""
    import boto3

    ssm = boto3.client("ssm")
    return ssm.get_parameter(Name=param_name, WithDecryption=True)["Parameter"]["Value"]
