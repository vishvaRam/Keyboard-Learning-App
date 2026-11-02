from app.config import get_settings
from app.schemas import (
    AppConfig,
    ChordAttempt,
    ChordResult,
    ChordStep,
    Progression,
    ProgressionId,
)
from app.services.theory import DIATONIC

# Semitone offsets are measured from the scale root of step.semitones' lowest note.
# Every progression below states its own root, so the same numbers work in any key.

PROGRESSIONS: dict[ProgressionId, Progression] = {
    # ---------------------------------------------------------------- pop
    "pop": Progression(
        id="pop",
        title="Doo-Wop (I-vi-IV-V)",
        family="pop",
        mood="Warm, singable, familiar",
        why=(
            "The most used progression in pop history. The vi in the middle gives it a "
            "small tug at the heart without ever getting sad."
        ),
        tip=(
            "Start the I soft and let each chord land with a little more weight. "
            "Dynamics follow the shape of the phrase."
        ),
        scale_degrees=[1, 6, 4, 5],
        steps=[
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7], tempo_bpm=72),
            ChordStep(roman="vi", name="", degree=6, semitones=[9, 12, 16], tempo_bpm=72),
            ChordStep(roman="IV", name="", degree=4, semitones=[5, 9, 12], tempo_bpm=72),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14], tempo_bpm=72),
        ],
    ),
    "pop-anthem": Progression(
        id="pop-anthem",
        title="Axis / Stadium (I-V-vi-IV)",
        family="pop",
        mood="Big, uplifting, crowd-singing",
        why=(
            "The 'four chords' of a thousand pop songs. The same four chords as doo-wop, "
            "reordered so it opens with the leap to V - that is what makes it feel like a chorus."
        ),
        tip="Push the V chord; it's the lift of the phrase. Let the last IV ring and resolve on I.",
        scale_degrees=[1, 5, 6, 4],
        steps=[
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7], tempo_bpm=76),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14], tempo_bpm=76),
            ChordStep(roman="vi", name="", degree=6, semitones=[9, 12, 16], tempo_bpm=76),
            ChordStep(roman="IV", name="", degree=4, semitones=[5, 9, 12], tempo_bpm=76),
        ],
    ),
    "pop-pachelbel": Progression(
        id="pop-pachelbel",
        title="Canon (I-V-vi-iii-IV-I-IV-V)",
        family="pop",
        mood="Classical, flowing, movie-soundtrack",
        why=(
            "Pachelbel's Canon. Eight chords instead of four, so the phrase has room to breathe - "
            "common in film scores and ballads."
        ),
        tip="Keep it even and let the melody voice move while the chords stay underneath.",
        scale_degrees=[1, 5, 6, 3, 4, 1, 4, 5],
        steps=[
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7], tempo_bpm=70),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14], tempo_bpm=70),
            ChordStep(roman="vi", name="", degree=6, semitones=[9, 12, 16], tempo_bpm=70),
            ChordStep(roman="iii", name="", degree=3, semitones=[4, 7, 11], tempo_bpm=70),
            ChordStep(roman="IV", name="", degree=4, semitones=[5, 9, 12], tempo_bpm=70),
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7], tempo_bpm=70),
            ChordStep(roman="IV", name="", degree=4, semitones=[5, 9, 12], tempo_bpm=70),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14], tempo_bpm=70),
        ],
    ),
    "pop-jazz": Progression(
        id="pop-jazz",
        title="Pop Soul (ii-V-I-vi)",
        family="pop",
        mood="Smooth, warm, Stevie Wonder",
        why=(
            "The jazz turnaround ii-V-I, plus vi so it never fully settles. "
            "Common in soul and pop with a little sophistication."
        ),
        tip="Voice the chords close together so your hand barely moves; let the top note sing.",
        scale_degrees=[2, 5, 1, 6],
        steps=[
            ChordStep(roman="ii", name="", degree=2, semitones=[2, 5, 9], tempo_bpm=80),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14], tempo_bpm=80),
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7], tempo_bpm=80),
            ChordStep(roman="vi", name="", degree=6, semitones=[9, 12, 16], tempo_bpm=80),
        ],
    ),
    # ------------------------------------------------ nostalgic / melancholic
    "nostalgic": Progression(
        id="nostalgic",
        title="Bittersweet (I-V-vi-iv)",
        family="nostalgic",
        mood="Bittersweet, cinematic, memory-like",
        why=(
            "The minor iv borrowed from the minor scale is the 'sad' colour. "
            "Same shape as a pop progression, but that lowered third turns it bittersweet."
        ),
        tip="Hold the pedal through the change and let the final iv ring. Drop the volume slightly on the vi.",
        scale_degrees=[1, 5, 6, 4],
        steps=[
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7], tempo_bpm=64),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14], tempo_bpm=64),
            ChordStep(roman="vi", name="", degree=6, semitones=[9, 12, 16], tempo_bpm=64),
            ChordStep(roman="iv", name="", degree=4, semitones=[5, 8, 12], tempo_bpm=64),
        ],
    ),
    "nostalgic-cry": Progression(
        id="nostalgic-cry",
        title="Heartbreak IV (vi-IV-I-V)",
        family="nostalgic",
        mood="Hopeful melancholy, indie, dramatic",
        why=(
            "Starts on vi, so the key is never established as happy - it opens already aching, "
            "then reaches up to IV and only finds home at the end."
        ),
        tip="Play the first chord soft; it's the whole emotional setup. Save the weight for the V.",
        scale_degrees=[6, 4, 1, 5],
        steps=[
            ChordStep(roman="vi", name="", degree=6, semitones=[9, 12, 16], tempo_bpm=68),
            ChordStep(roman="IV", name="", degree=4, semitones=[5, 9, 12], tempo_bpm=68),
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7], tempo_bpm=68),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14], tempo_bpm=68),
        ],
    ),
    "nostalgic-piano": Progression(
        id="nostalgic-piano",
        title="Ballad Walk (I-iii-vi-IV)",
        family="nostalgic",
        mood="Tender, film score, quiet",
        why=(
            "The iii chord shares two notes with I, so the move feels like a shadow rather than a "
            "change. This is the progression under a lot of sad piano music."
        ),
        tip="Very soft, rolling. Don't rush - let each chord bloom before moving.",
        scale_degrees=[1, 3, 6, 4],
        steps=[
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7], tempo_bpm=60),
            ChordStep(roman="iii", name="", degree=3, semitones=[4, 7, 11], tempo_bpm=60),
            ChordStep(roman="vi", name="", degree=6, semitones=[9, 12, 16], tempo_bpm=60),
            ChordStep(roman="IV", name="", degree=4, semitones=[5, 9, 12], tempo_bpm=60),
        ],
    ),
    "nostalgic-swap": Progression(
        id="nostalgic-swap",
        title="Minor Swell (i-VI-III-VII)",
        family="nostalgic",
        mood="Epic, film-trailer, goosebumps",
        why=(
            "Built in the minor key instead of borrowing: i-VI-III-VII. "
            "Wide and open, the sound of a heroic or devastating scene."
        ),
        tip="Big dynamic contrast between i and III. This one wants volume in the middle.",
        scale_degrees=[1, 6, 3, 7],
        steps=[
            ChordStep(roman="i", name="", degree=1, semitones=[0, 3, 7], tempo_bpm=66),
            ChordStep(roman="VI", name="", degree=6, semitones=[8, 12, 15], tempo_bpm=66),
            ChordStep(roman="III", name="", degree=3, semitones=[3, 7, 10], tempo_bpm=66),
            ChordStep(roman="VII", name="", degree=7, semitones=[10, 14, 17], tempo_bpm=66),
        ],
    ),
    # ------------------------------------------------------- lofi / neo-soul
    "lofi": Progression(
        id="lofi",
        title="ii-V-I (sevenths)",
        family="lofi",
        mood="Mellow, hip-hop, late-night study",
        why=(
            "The jazz resolution voiced as 7th chords. ii and V pull hard toward home, "
            "and the 7ths keep the landing soft instead of final."
        ),
        tip="Play soft (velocity 40-70) and lag slightly behind the beat - that laid-back feel is the whole genre.",
        scale_degrees=[2, 5, 1],
        steps=[
            ChordStep(roman="ii", name="", degree=2, semitones=[2, 5, 9, 12], tempo_bpm=56),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14, 17], tempo_bpm=56),
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7, 11], tempo_bpm=56),
        ],
    ),
    "lofi-turnaround": Progression(
        id="lofi-turnaround",
        title="Turnaround (I-vi-ii-V)",
        family="lofi",
        mood="Loops forever, jazz-tinged",
        why=(
            "The turnaround: it ends on V, which pulls straight back to the top. "
            "That is why it can loop for hours without sounding finished."
        ),
        tip="Great for a loop. Keep the right hand still and let the left hand walk.",
        scale_degrees=[1, 6, 2, 5],
        steps=[
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7, 11], tempo_bpm=58),
            ChordStep(roman="vi", name="", degree=6, semitones=[9, 12, 16, 19], tempo_bpm=58),
            ChordStep(roman="ii", name="", degree=2, semitones=[2, 5, 9, 12], tempo_bpm=58),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14, 17], tempo_bpm=58),
        ],
    ),
    "lofi-descend": Progression(
        id="lofi-descend",
        title="Descending Lift (IVmaj7-iii7-ii7-I)",
        family="lofi",
        mood="Floating, dreamy, descending",
        why=(
            "The bass walks down by step IV-iii-ii-I while every chord stays a 7th. "
            "Smooth and weightless - the classic neo-soul walk."
        ),
        tip="Voice it so the top note stays put; that is what makes the descent feel silky.",
        scale_degrees=[4, 3, 2, 1],
        steps=[
            ChordStep(roman="IV", name="", degree=4, semitones=[5, 9, 12, 16], tempo_bpm=54),
            ChordStep(roman="iii", name="", degree=3, semitones=[4, 7, 11, 14], tempo_bpm=54),
            ChordStep(roman="ii", name="", degree=2, semitones=[2, 5, 9, 12], tempo_bpm=54),
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7, 11], tempo_bpm=54),
        ],
    ),
    "lofi-rnb": Progression(
        id="lofi-rnb",
        title="R&B Slide (vi-ii-V-I)",
        family="lofi",
        mood="Smooth, romantic, slow jam",
        why=(
            "Starting on vi makes the whole loop feel unresolved and longing, "
            "and the ii-V-I finally lands. Tension then release, slowly."
        ),
        tip="Wide spread between hands, soft touch. Add a 9th on the I for extra glow.",
        scale_degrees=[6, 2, 5, 1],
        steps=[
            ChordStep(roman="vi", name="", degree=6, semitones=[9, 12, 16, 19], tempo_bpm=52),
            ChordStep(roman="ii", name="", degree=2, semitones=[2, 5, 9, 12], tempo_bpm=52),
            ChordStep(roman="V", name="", degree=5, semitones=[7, 11, 14, 17], tempo_bpm=52),
            ChordStep(roman="I", name="", degree=1, semitones=[0, 4, 7, 11], tempo_bpm=52),
        ],
    ),
}

NOTE_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")


def chord_name(chord_root_pc: int, semitones: list[int]) -> str:
    """Name a chord from the pitch class of its root and the intervals above that root."""
    root = NOTE_NAMES[chord_root_pc % 12]
    bass_offset = semitones[0]
    # intervals measured from the chord root, so inversions keep their real name
    relative = tuple(sorted({s % 12 for s in semitones}))
    qualities = {
        (0, 3, 6): "dim",
        (0, 3, 7): "m",
        (0, 4, 7): "",
        (0, 3, 7, 10): "m7",
        (0, 4, 7, 10): "7",
        (0, 4, 7, 11): "maj7",
        (0, 3, 7, 11): "m(maj7)",
    }
    suffix = qualities.get(relative)
    if suffix is None:
        return f"{root}({','.join(map(str, relative))})"
    if bass_offset == 0:
        return f"{root}{suffix}"
    # inversion: still the same chord, with a slash bass
    bass = NOTE_NAMES[(chord_root_pc + bass_offset) % 12]
    return f"{root}{suffix}/{bass}"


def with_names(prog: Progression, root_midi: int) -> Progression:
    root_pc = root_midi % 12
    steps = [
        # semitones are relative to the scale root, so name each chord from its own root
        step.model_copy(
            update={
                "name": chord_name(
                    root_pc + step.semitones[0],
                    [(s - step.semitones[0]) % 12 for s in step.semitones],
                )
            }
        )
        for step in prog.steps
    ]
    return prog.model_copy(update={"steps": steps})


def roman_label(prog: Progression, degree: int) -> str:
    for step in prog.steps:
        if step.degree == degree:
            return step.roman
    return DIATONIC[degree][2]


def chord_midi(prog: Progression, step_index: int, root_midi: int) -> list[int]:
    return [root_midi + s for s in prog.steps[step_index % len(prog.steps)].semitones]


def evaluate_attempt(
    prog: Progression, root_midi: int, attempt: ChordAttempt, cfg: AppConfig | None = None
) -> ChordResult:
    cfg = cfg or get_settings()
    step = prog.steps[attempt.step_index % len(prog.steps)]
    expected = {root_midi + s for s in step.semitones}
    played = set(attempt.notes)
    correct = expected & played
    missing = expected - played
    extra = played - expected
    accuracy = round(100 * len(correct) / len(expected))
    feedback: list[str] = []

    if not missing:
        grade = "Perfect" if not extra else "Good"
    elif len(missing) == 1 and len(correct) >= 2 and not extra:
        grade = "Almost"
    else:
        grade = "Keep going"

    if missing:
        names = ", ".join(NOTE_NAMES[m % 12] for m in sorted(missing))
        feedback.append(f"Missing {names} - {step.roman} is a {len(expected)}-note chord.")
    if extra:
        names = ", ".join(NOTE_NAMES[m % 12] for m in sorted(extra))
        feedback.append(f"{names} does not belong in {step.roman}.")
    if any(v <= cfg.weak_velocity_max for v in attempt.notes.values()) and not extra:
        feedback.append("Right notes, but from the fingers only. Let the arm weight sink the keys down.")
    if attempt.ghost_notes:
        feedback.append(f"{len(attempt.ghost_notes)} ghost touch(es): the key barely moved, no tone came out.")
    if not feedback:
        feedback.append("Clean voicing - all tones arrived together.")

    return ChordResult(
        step_index=attempt.step_index,
        accuracy=accuracy,
        grade=grade,
        feedback=feedback,
        correct=len(correct),
        missing=len(missing),
    )
