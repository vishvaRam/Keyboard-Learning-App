from fastapi import APIRouter

from app.schemas import SessionRequest, SessionSummary
from app.services.scoring import summarize

router = APIRouter()


@router.post("/session/summary", response_model=SessionSummary)
def session_summary(payload: SessionRequest) -> SessionSummary:
    velocities = [v for v in payload.velocities if 1 <= v <= 127]
    return summarize(velocities, payload.ghosts, payload.outliers)
