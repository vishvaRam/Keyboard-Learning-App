from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Feel Piano"
    debug: bool = True
    host: str = "127.0.0.1"
    port: int = 4567

    # --- scoring thresholds (also consumed by the frontend via /api/config) ---
    target_tolerance_ms: int = 120
    weak_velocity_max: int = 30
    strong_velocity_min: int = 128
    default_ghost_floor: int = 12
    rolling_window_seconds: int = 20

    @property
    def static_dir(self) -> Path:
        return BASE_DIR / "app" / "static"


@lru_cache
def get_settings() -> Settings:
    return Settings()
