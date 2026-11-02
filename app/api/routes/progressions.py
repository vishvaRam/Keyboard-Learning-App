from fastapi import APIRouter, HTTPException

from app.schemas import ChordAttempt, ChordResult, Progression, SessionRequest, SessionSummary
from app.services import progressions as svc
from app.services.scoring import grade_chord, summarize

router = APIRouter(prefix="/progressions")


def _get(progression_id: str) -> Progression:
    prog = svc.PROGRESSIONS.get(progression_id)  # type: ignore[arg-type]
    if prog is None:
        raise HTTPException(status_code=404, detail="Unknown progression")
    return prog


@router.get("", response_model=list[Progression])
def list_progressions(root_midi: int = 60) -> list[Progression]:
    return [svc.with_names(p, root_midi) for p in svc.PROGRESSIONS.values()]


@router.get("/{progression_id}", response_model=Progression)
def get_progression(progression_id: str, root_midi: int = 60) -> Progression:
    return svc.with_names(_get(progression_id), root_midi)


@router.get("/{progression_id}/midi")
def progression_midi(progression_id: str, root_midi: int = 60) -> dict:
    prog = _get(progression_id)
    return {
        "root_midi": root_midi,
        "chords": [{"roman": s.roman, "notes": svc.chord_midi(prog, i, root_midi)} for i, s in enumerate(prog.steps)],
    }


@router.post("/{progression_id}/attempt", response_model=ChordResult)
def attempt_chord(progression_id: str, attempt: ChordAttempt, root_midi: int = 60) -> ChordResult:
    return grade_chord(_get(progression_id), root_midi, attempt)


@router.post("/{progression_id}/summary", response_model=SessionSummary)
def practice_summary(progression_id: str, payload: SessionRequest) -> SessionSummary:
    _get(progression_id)
    velocities = [v for v in payload.velocities if 1 <= v <= 127]
    return summarize(velocities, payload.ghosts, payload.outliers)
