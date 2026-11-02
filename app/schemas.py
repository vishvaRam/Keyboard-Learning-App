from typing import Literal

from pydantic import BaseModel, Field

ProgressionId = Literal[
    # pop
    "pop",
    "pop-anthem",
    "pop-pachelbel",
    "pop-jazz",
    # nostalgic / melancholic
    "nostalgic",
    "nostalgic-cry",
    "nostalgic-piano",
    "nostalgic-swap",
    # lofi / neo-soul
    "lofi",
    "lofi-turnaround",
    "lofi-descend",
    "lofi-rnb",
]


class AppConfig(BaseModel):
    app_name: str
    target_tolerance_ms: int
    weak_velocity_max: int
    strong_velocity_min: int
    default_ghost_floor: int
    rolling_window_seconds: int


class KeyboardInfo(BaseModel):
    id: str
    name: str
    keys: int
    velocity_curves: list[str]
    default_curve: str
    note: str


class ChordStep(BaseModel):
    roman: str
    name: str
    degree: int
    semitones: list[int]
    tempo_bpm: int


class Progression(BaseModel):
    id: ProgressionId
    title: str
    family: str  # "pop" | "nostalgic" | "lofi" - used to group them in the UI
    mood: str
    why: str
    tip: str
    scale_degrees: list[int]
    steps: list[ChordStep]


class NoteEvent(BaseModel):
    midi: int = Field(ge=21, le=108)
    velocity: int = Field(ge=1, le=127)
    # offset in ms from the note's scheduled time (negative = early)
    delta_ms: int = 0


class ChordAttempt(BaseModel):
    step_index: int = Field(ge=0)
    notes: dict[int, int]  # midi -> velocity
    ghost_notes: list[int] = Field(default_factory=list)


class ChordResult(BaseModel):
    step_index: int
    accuracy: int
    grade: str
    feedback: list[str]
    correct: int
    missing: int


class SessionSummary(BaseModel):
    average_velocity: float
    stdev_velocity: float
    consistency: int
    range_span: int
    notes_played: int
    ghost_notes: int
    outliers: int
    verdict: str
    detail: str


class SessionRequest(BaseModel):
    velocities: list[int] = Field(default_factory=list)
    ghosts: int = 0
    outliers: int = 0
