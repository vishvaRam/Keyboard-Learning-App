import statistics

from app.config import get_settings
from app.schemas import (
    AppConfig,
    ChordAttempt,
    ChordResult,
    NoteEvent,
    Progression,
    SessionSummary,
)
from app.services.progressions import evaluate_attempt


def score_note(event: NoteEvent, target_velocity: int, tolerance_ms: int) -> dict:
    velocity_error = abs(event.velocity - target_velocity)
    timing_ok = abs(event.delta_ms) <= tolerance_ms
    if velocity_error <= 14 and timing_ok:
        grade = "perfect"
    elif velocity_error <= 28:
        grade = "close"
    else:
        grade = "off"
    return {
        "midi": event.midi,
        "target": target_velocity,
        "velocity": event.velocity,
        "grade": grade,
        "velocity_error": velocity_error,
        "timing_ok": timing_ok,
        "delta_ms": event.delta_ms,
    }


def _verdict(velocities: list[int], ghosts: int, outliers: int) -> tuple[str, str]:
    settings = get_settings()
    avg = statistics.fmean(velocities)
    span = max(velocities) - min(velocities)
    ghost_ratio = ghosts / len(velocities)

    if avg < settings.weak_velocity_max:
        return (
            "Mostly in the whisper zone",
            "Soft playing is expressive, but you are leaving the loud half of the keyboard unused.",
        )
    if span < 18:
        return (
            "Flat line",
            "Almost every note landed at the same strength. Push the peaks up and let the ends fall away.",
        )
    if ghost_ratio > 0.2:
        return (
            "Watch the shallow presses",
            f"{ghosts} ghost touches out of {len(velocities)} notes - "
            "get the key to bottom out even when playing softly.",
        )
    if outliers > len(velocities) * 0.3:
        return (
            "Right idea, uneven control",
            "Your intentions are clear but some notes land far from the target. Play the motion, not the note.",
        )
    return (
        "Expressive playing",
        "Good dynamic range and consistency. Now take it into the chord progressions.",
    )


def summarize(velocities: list[int], ghosts: int, outliers: int) -> SessionSummary:
    if not velocities:
        return SessionSummary(
            average_velocity=0,
            stdev_velocity=0,
            consistency=0,
            range_span=0,
            notes_played=0,
            ghost_notes=ghosts,
            outliers=outliers,
            verdict="No notes yet",
            detail="Play a few notes and the analysis will fill in.",
        )

    verdict, detail = _verdict(velocities, ghosts, outliers)
    stdev = statistics.pstdev(velocities) if len(velocities) > 1 else 0.0
    return SessionSummary(
        average_velocity=round(statistics.fmean(velocities), 1),
        stdev_velocity=round(stdev, 1),
        consistency=max(0, min(100, round(100 - stdev * 2.2))),
        range_span=max(velocities) - min(velocities),
        notes_played=len(velocities),
        ghost_notes=ghosts,
        outliers=outliers,
        verdict=verdict,
        detail=detail,
    )


def grade_chord(prog: Progression, root_midi: int, attempt: ChordAttempt) -> ChordResult:
    return evaluate_attempt(prog, root_midi, attempt, get_settings())


def config_snapshot() -> AppConfig:
    s = get_settings()
    return AppConfig(
        app_name=s.app_name,
        target_tolerance_ms=s.target_tolerance_ms,
        weak_velocity_max=s.weak_velocity_max,
        strong_velocity_min=s.strong_velocity_min,
        default_ghost_floor=s.default_ghost_floor,
        rolling_window_seconds=s.rolling_window_seconds,
    )
