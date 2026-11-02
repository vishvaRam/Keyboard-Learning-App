import pytest

from app.config import get_settings
from app.schemas import ChordAttempt, NoteEvent
from app.services.progressions import (
    PROGRESSIONS,
    chord_midi,
    chord_name,
    evaluate_attempt,
    with_names,
)
from app.services.scoring import score_note, summarize


@pytest.fixture
def cfg():
    return get_settings()


def names(progression_id, root_midi):
    return [s.name for s in with_names(PROGRESSIONS[progression_id], root_midi).steps]


def make_attempt(prog, step_index, root_midi, velocity=90, extra=None, ghosts=None):
    notes = dict.fromkeys(chord_midi(prog, step_index, root_midi), velocity)
    for midi in extra or []:
        notes[midi] = velocity
    return ChordAttempt(step_index=step_index, notes=notes, ghost_notes=ghosts or [])


def test_chord_names_in_c_major():
    assert names("pop", 60) == ["C", "Am", "F", "G"]


def test_chord_names_transpose_with_root():
    assert names("pop", 62) == ["D", "Bm", "G", "A"]


def test_nostalgic_has_borrowed_minor_iv():
    assert names("nostalgic", 60) == ["C", "G", "Am", "Fm"]


def test_lofi_seventh_chords():
    assert names("lofi", 60) == ["Dm7", "G7", "Cmaj7"]


def test_chord_name_from_root_position_intervals():
    assert chord_name(0, [0, 4, 7]) == "C"
    assert chord_name(9, [0, 3, 7]) == "Am"
    assert chord_name(2, [0, 3, 7, 10]) == "Dm7"
    assert chord_name(7, [0, 4, 7, 10]) == "G7"


def test_chord_midi_offsets_from_root():
    assert chord_midi(PROGRESSIONS["pop"], 1, 60) == [69, 72, 76]


def test_grade_perfect_chord(cfg):
    prog = PROGRESSIONS["pop"]
    result = evaluate_attempt(prog, 60, make_attempt(prog, 0, 60), cfg)
    assert result.grade == "Perfect"
    assert result.accuracy == 100
    assert result.missing == 0


def test_grade_detects_missing_note(cfg):
    result = evaluate_attempt(PROGRESSIONS["pop"], 60, ChordAttempt(step_index=0, notes={64: 90, 67: 90}), cfg)
    assert result.grade == "Almost"
    assert result.missing == 1
    assert any("Missing C" in line for line in result.feedback)


def test_grade_detects_extra_note(cfg):
    prog = PROGRESSIONS["pop"]
    result = evaluate_attempt(prog, 60, make_attempt(prog, 0, 60, extra=[61]), cfg)
    assert result.grade == "Good"
    assert any("C#" in line for line in result.feedback)


def test_grade_flags_soft_chord(cfg):
    prog = PROGRESSIONS["pop"]
    result = evaluate_attempt(prog, 60, make_attempt(prog, 0, 60, velocity=30), cfg)
    assert any("arm weight" in line for line in result.feedback)


def test_grade_mentions_ghost_notes(cfg):
    prog = PROGRESSIONS["pop"]
    result = evaluate_attempt(prog, 60, make_attempt(prog, 0, 60, ghosts=[60, 64]), cfg)
    assert any("ghost" in line for line in result.feedback)


def test_score_note_grades_velocity_error():
    perfect = score_note(NoteEvent(midi=60, velocity=80, delta_ms=10), 80, 120)
    close = score_note(NoteEvent(midi=60, velocity=100, delta_ms=10), 80, 120)
    off = score_note(NoteEvent(midi=60, velocity=127, delta_ms=10), 30, 120)
    late = score_note(NoteEvent(midi=60, velocity=80, delta_ms=200), 80, 120)

    assert perfect["grade"] == "perfect" and perfect["timing_ok"]
    assert close["grade"] == "close"
    assert off["grade"] == "off"
    assert late["grade"] != "perfect"
    assert late["timing_ok"] is False


def test_summary_flags_flat_playing():
    summary = summarize([80] * 20, 0, 0)
    assert summary.verdict == "Flat line"
    assert summary.range_span == 0


def test_summary_rewards_range():
    summary = summarize([40, 60, 80, 100, 110, 90, 70, 50] * 3, 0, 0)
    assert summary.verdict == "Expressive playing"
    assert summary.consistency > 20


def test_summary_flags_whisper_zone():
    summary = summarize([20, 25, 30, 35, 40, 22], 0, 0)
    assert summary.verdict == "Mostly in the whisper zone"


def test_summary_empty():
    summary = summarize([], 0, 0)
    assert summary.notes_played == 0
    assert summary.verdict == "No notes yet"


def test_all_progressions_name_every_chord_in_every_key():
    """No chord may fall through to the unnamed fallback in any key."""
    for root in (48, 53, 58, 60, 62, 65, 69):
        for prog in PROGRESSIONS.values():
            for step in with_names(prog, root).steps:
                assert "(" not in step.name, f"{prog.id} {step.roman} in midi {root}: {step.name}"


def test_all_progressions_have_four_notes_or_more_and_valid_ranges():
    for prog in PROGRESSIONS.values():
        assert prog.steps, prog.id
        for step in prog.steps:
            assert 0 <= step.semitones[0] < 12, f"{prog.id} {step.roman} is not rooted in the octave"
            assert len(step.semitones) >= 3
            assert step.semitones == sorted(step.semitones), f"{prog.id} {step.roman} notes out of order"


def test_new_progressions_are_in_the_expected_families():
    expected = {
        "pop": {"pop", "pop-anthem", "pop-pachelbel", "pop-jazz"},
        "nostalgic": {"nostalgic", "nostalgic-cry", "nostalgic-piano", "nostalgic-swap"},
        "lofi": {"lofi", "lofi-turnaround", "lofi-descend", "lofi-rnb"},
    }
    for family, ids in expected.items():
        assert {p.id for p in PROGRESSIONS.values() if p.family == family} == ids
