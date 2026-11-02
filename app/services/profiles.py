from app.schemas import KeyboardInfo

KEYBOARD_PROFILES = [
    KeyboardInfo(
        id="yamaha-psr-e473",
        name="Yamaha PSR-E473",
        keys=61,
        velocity_curves=["soft", "medium", "hard"],
        default_curve="medium",
        note=(
            "61 keys, touch-sensitive (velocity 1-127 over USB-MIDI or the "
            "audio input). Put it in 'Grand Piano' and turn OFF the built-in "
            "reverb/chorus for practice - dry sound shows dynamics far better."
        ),
    ),
    KeyboardInfo(
        id="arturia-minilab-3",
        name="Arturia MiniLab 3",
        keys=25,
        velocity_curves=["linear", "soft", "hard"],
        default_curve="linear",
        note=(
            "25 keys, so use the octave buttons (or the virtual keyboard) to "
            "reach the voicings. Linear curve tracks your hand most honestly "
            "for dynamics practice."
        ),
    ),
]
