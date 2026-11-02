from fastapi import APIRouter

from app.schemas import KeyboardInfo
from app.services.profiles import KEYBOARD_PROFILES

router = APIRouter()


@router.get("/keyboards", response_model=list[KeyboardInfo])
def list_keyboards() -> list[KeyboardInfo]:
    return [KeyboardInfo(**p.model_dump()) for p in KEYBOARD_PROFILES]
