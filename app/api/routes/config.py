from fastapi import APIRouter

from app.config import get_settings
from app.schemas import AppConfig

router = APIRouter()


@router.get("/config", response_model=AppConfig)
def read_config() -> AppConfig:
    s = get_settings()
    return AppConfig(
        app_name=s.app_name,
        target_tolerance_ms=s.target_tolerance_ms,
        weak_velocity_max=s.weak_velocity_max,
        strong_velocity_min=s.strong_velocity_min,
        default_ghost_floor=s.default_ghost_floor,
        rolling_window_seconds=s.rolling_window_seconds,
    )
