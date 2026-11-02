MAJOR_SCALE = (0, 2, 4, 5, 7, 9, 11)

# degree (1-7) -> (semitones above root, diatonic triad quality, roman label)
DIATONIC = {
    1: (0, "maj", "I"),
    2: (2, "min", "ii"),
    3: (4, "min", "iii"),
    4: (5, "maj", "IV"),
    5: (7, "maj", "V"),
    6: (9, "min", "vi"),
    7: (11, "dim", "vii"),
}

CHORD_INTERVALS = {"maj": (0, 4, 7), "min": (0, 3, 7), "dim": (0, 3, 6)}

ROMAN_TO_DEGREE = {v[2]: k for k, v in DIATONIC.items()}
