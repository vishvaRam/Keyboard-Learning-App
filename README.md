# Feel Piano

A web app for a pianist who can already play with both hands but plays flat —
no dynamics, no phrasing. It makes your touch **visible** and teaches the chord
progressions behind pop, nostalgic/melancholic and lofi music.

No drills, no stars, no scores. You play; the app shows you what your hands
actually did.

![status](https://img.shields.io/badge/python-3.12-blue)
![status](https://img.shields.io/badge/FastAPI-serving_the_UI-009688)
![status](https://img.shields.io/badge/Tailwind-CDN-38bdf8)
![status](https://img.shields.io/badge/docker-compose_up-2496ed)

---

## What's inside

| Tab | What it does |
| --- | --- |
| **Play** | Velocity-sensitive on-screen piano, velocity curves per keyboard, a flat vs. medium vs. phrased comparison of the same phrase, and a live analyser (last velocity, range, ghost touches, consistency). |
| **Piano Roll** | Every note you play is drawn as a bar whose **brightness is how hard you pressed**. Time runs bottom → top, pitch runs left → right. Sustain pedal is drawn as a band. Freeze it and study your own phrasing. |
| **Progressions** | 12 progressions grouped into pop / nostalgic / lofi, in any key. Roman-numeral labels, chord diagrams, playback, a metronome, a second piano roll, and a server-side chord grading of what you actually played. |

Both on-screen keyboards (the panel one and the one docked across the bottom)
mirror every note on every tab.

## Requirements

- Python **3.12+** (or Docker)
- Desktop **Chrome or Edge** — the app uses the **Web MIDI API**, which these
  browsers ship. Firefox and Safari do not expose it, and mobile/Android is not
  a supported target.
- A touch-sensitive MIDI keyboard (tested with a **Yamaha PSR-E473** and an
  **Arturia MiniLab 3**), or the app's audio-input mode over a line-in/mic cable.

## Quick start

### With `uv` (recommended)

```bash
uv sync
cp .env.example .env      # optional - every value has a default
uv run python -m app.main
```

Open <http://127.0.0.1:4567>.

> `uv run app.main` does **not** work — `uv run` treats the first token as a
> program name. Use `python -m`, or `uv run uvicorn app.main:app --reload`.

### With plain venv

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.main
```

### With Docker

```bash
docker compose up --build
```

Open <http://localhost:4567>. The container binds `0.0.0.0:4567` and runs with
reload off.

> **MIDI inside Docker:** Web MIDI runs in your **browser**, not in the
> container, so this works as long as the browser and the keyboard are on the
> same machine — the container can be local or remote, it only serves the files.
> If port `4567` is already taken on the host, change the left side of the
> `ports` mapping (e.g. `"8080:4567"`).

### First run

1. Click **MIDI: off** in the header and allow the browser's MIDI permission prompt.
2. Pick your device in the dropdown that appears next to it.
3. Pick your keyboard profile and velocity curve on the **Play** tab.
4. Press a key. Samples load on first use (they are fetched from the web, so
   the first note after a hard reload may be slightly late).

If keys do not light up at all and the app persists an error banner at the top,
open the DevTools console — the banner shows the message it caught.

## Configuration

Settings come from `app/config/settings.py` (pydantic-settings). Every value can
be overridden by an environment variable or a `.env` file in the project root;
see `.env.example`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_NAME` | `Feel Piano` | Shown in the page title and API docs |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` inside Docker) |
| `PORT` | `4567` | Bind port |
| `DEBUG` | `true` | Reload + verbose FastAPI errors; Docker sets `false` |
| `TARGET_TOLERANCE_MS` | `120` | How far before/after a note you may hit it |
| `WEAK_VELOCITY_MAX` | `45` | Below this a hit counts as "too soft" |
| `STRONG_VELOCITY_MIN` | `110` | Above this a hit counts as "too loud" |
| `DEFAULT_GHOST_FLOOR` | `12` | Quieter/less pressed than this = ghost touch |
| `ROLLING_WINDOW_SECONDS` | `20` | History window for the consistency figure |

`.env` is git-ignored.

## API

Interactive docs at `/docs` while running.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/config` | Frontend-visible thresholds |
| `GET` | `/api/keyboards` | Keyboard profiles (PSR-E473, MiniLab 3) |
| `GET` | `/api/progressions?root_midi=60` | All 12 progressions, chords named in the chosen key |
| `GET` | `/api/progressions/{id}` | One progression |
| `GET` | `/api/progressions/{id}/midi` | Raw MIDI note numbers per chord |
| `POST` | `/api/progressions/{id}/attempt` | Grade a chord you played |
| `POST` | `/api/progressions/{id}/summary` | Summarise a practice session |
| `POST` | `/api/session/summary` | Summarise any free-play session |

## The progressions

All 12 are transposable to any key (C by default).

**Pop** — Doo-Wop (`I-vi-IV-V`), Axis / Stadium (`I-V-vi-IV`),
Canon (`I-V-vi-iii-IV-I-IV-V`), Pop Soul (`ii-V-I-vi`)

**Nostalgic / melancholic** — Bittersweet (`I-V-vi-iv`, borrowed minor iv),
Heartbreak (`vi-IV-I-V`), Ballad Walk (`I-iii-vi-IV`),
Minor Swell (`i-VI-III-VII`)

**Lofi / neo-soul** — `ii-V-I` sevenths, Turnaround (`I-vi-ii-V`),
Descending Lift (`IVmaj7-iii7-ii7-I`), R&B Slide (`vi-ii-V-I`)

Each one ships with a plain-language "why this works" note and a dynamic
phrasing hint (which chord to lean on, which to let fall).

## Project layout

```
app/
├── main.py                 # app factory, static mount, uvicorn entry point
├── schemas.py              # pydantic request/response models
├── config/settings.py      # pydantic-settings, reads .env
├── api/
│   ├── __init__.py         # /api router
│   └── routes/             # config, keyboard, progressions, session
├── services/
│   ├── progressions.py     # 12-progression catalogue, chord naming, grading
│   ├── scoring.py          # session summary + chord grading
│   ├── theory.py           # diatonic degrees
│   └── profiles.py         # keyboard profiles
└── static/
    ├── index.html          # single page, Tailwind CDN, three tabs
    └── js/
        ├── audio.js        # sampled piano (Salamander), sustain, audio input
        ├── midi.js         # Web MIDI input + CC64 pedal
        ├── keyboard-ui.js  # on-screen piano factory
        ├── roll.js         # canvas piano roll
        ├── demos.js        # "Hear the difference"
        ├── progressions.js # progression trainer UI
        └── app.js          # controller: tabs, note routing, state
tests/                      # pytest + TestClient
```

## Development

```bash
uv run ruff check app tests     # lint
uv run pytest -q                # tests
```

Styling is **Tailwind only** (CDN + `@layer components` in `index.html`); there is
no separate stylesheet. The piano sound is real sampled grand piano — no
synthetic substitute.

## Browser notes

- **Samples** come from `tonejs.github.io/audio/salamander/` and are fetched
  lazily on first use. If that host is unreachable you get silence (and a
  `piano sample unavailable` warning in the console) rather than a fake synth —
  the UI stays responsive. Connect to the internet for real piano sound.
- **Sustain (CC64)** is supported and drawn on the piano roll.
- **Audio input mode** (`Enable audio input`) lets the PSR control velocity over a
  line-in/mic cable when no MIDI notes arrive.
