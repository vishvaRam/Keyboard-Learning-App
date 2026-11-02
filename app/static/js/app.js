/* App controller: wires keyboards, MIDI, the analyser, drills and progressions. */
(function () {
  const App = (window.App = {});
  const $ = (id) => document.getElementById(id);

  const state = {
    config: null,
    keyboards: [],
    activeTab: "play",
    velocities: [],
    ghosts: 0,
    releaseAt: new Map(),
    sounding: new Map(), // midi -> stop() for the note currently sounding
    pedalHeld: new Set(), // keys lifted while the pedal is down, still sounding
    lastNoteMidi: 64,
    dockOctaveShift: 0,
  };

  const ROOTS = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72];
  const rootName = (midi) => Audio.midiToName(midi).replace(/-?\d+$/, "");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const pstdev = (values) => {
    if (values.length < 2) return 0;
    const m = mean(values);
    return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
  };

  /* ---------------- notifications ---------------- */
  function toast(message, tone = "info") {
    const colors = {
      info: "border-line bg-panel2 text-slate-200",
      good: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
      bad: "border-rose-400/40 bg-rose-400/10 text-rose-200",
    };
    const el = document.createElement("div");
    el.className = `pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg border px-4 py-2 text-sm shadow-xl transition-opacity duration-300 ${colors[tone]}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }
  App.toast = toast;

  /* ---------------- tab switching ---------------- */
  function showTab(name) {
    state.activeTab = name;
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("hidden", panel.id !== "panel-" + name);
    });
    document.querySelectorAll("#tabs .tab-btn").forEach((btn) => {
      btn.classList.toggle("tab-btn-active", btn.dataset.tab === name);
    });
    if (name !== "prog") ProgTrainer.stopAll();
    refreshHints();
    // canvases in a hidden panel have zero width, so size them once shown
    if (name === "roll" && roll) roll.resize();
    if (name === "prog" && progRoll) progRoll.resize();
  }

  function refreshHints() {
    if (state.activeTab === "prog") {
      const notes = ProgTrainer.stepNotes(ProgTrainer.state.stepIndex);
      freePlay.highlight(notes);
    } else if (state.activeTab === "roll") {
      freePlay.clearHighlight();
    } else {
      freePlay.clearHighlight();
    }
  }

  /* ---------------- keyboards ---------------- */
  function buildKeyboards() {
    freePlay = Piano.create($("keyboard-play"), {
      low: 48,
      high: 84,
      velocityFromPointer: true,
      onNote: (midi, velocity) => handleNoteOn(midi, velocity, "onscreen"),
      onRelease: (midi) => handleNoteOff(midi),
    });
    dock = Piano.create($("keyboard-dock"), {
      low: 48,
      high: 84,
      compact: true,
      velocityFromPointer: true,
      onNote: (midi, velocity) => handleNoteOn(midi, velocity, "dock"),
      onRelease: (midi) => handleNoteOff(midi),
    });
  }

  let freePlay = null;
  let dock = null;
  let roll = null; // Piano Roll tab canvas
  let progRoll = null; // Progressions tab canvas

  function reflectKey(midi, held) {
    // black keys need the black variant, otherwise the highlight never shows
    const cls = Piano.isBlack(midi) ? "key-black-held" : "key-white-held";
    for (const piano of [freePlay, dock]) {
      if (!piano) continue;
      const el = piano.keyEl(midi);
      if (!el) continue;
      if (held) el.classList.add(cls);
      else el.classList.remove("key-white-held", "key-black-held");
    }
  }

  function releaseVisual(piano, midi) {
    const el = piano.keyEl(midi);
    if (!el) return;
    el.classList.remove("key-white-held", "key-black-held");
  }

  /* ---------------- central note handling ---------------- */
  async function handleNoteOn(midi, velocity, source) {
    const now = performance.now();
    const sinceRelease = now - (state.releaseAt.get(midi) || 0);
    const repeated = sinceRelease < 60 && source === "midi";
    state.releaseAt.delete(midi);
    state.lastNoteMidi = midi;

    // keep the stop handle: without it the synth note never ends
    const previous = state.sounding.get(midi);
    if (previous) previous(0.25);
    state.sounding.set(midi, null);
    Audio.play(midi, velocity).then((stop) => {
      if (typeof stop !== "function") return;
      if (state.sounding.get(midi) === null) state.sounding.set(midi, stop);
      else stop(0.1); // key was released before the sample finished loading
    });

    // every note feeds the piano roll and the analyser, regardless of the open tab
    if (roll) roll.noteOn(midi, velocity);
    if (progRoll) progRoll.noteOn(midi, velocity);
    if (!repeated) {
      analyseNote(velocity, midi);
      scheduleRollStats();
    }

    // both on-screen pianos mirror every note, on every tab
    reflectKey(midi, true);
    ProgTrainer.noteOn(midi, velocity);
  }

  function handleNoteOff(midi) {
    state.releaseAt.set(midi, performance.now());
    releaseVisual(freePlay, midi);
    releaseVisual(dock, midi);
    ProgTrainer.noteOff(midi);

    if (lastSustain) {
      // pedal is down: keep the sound and its bar alive until the pedal lifts
      state.pedalHeld.add(midi);
      return;
    }
    releaseNote(midi);
  }

  /** Actually stop a note: audio, roll bar and bookkeeping. */
  function releaseNote(midi) {
    const stop = state.sounding.get(midi);
    if (stop) {
      stop();
      state.sounding.delete(midi);
    }
    if (roll) roll.noteOff(midi);
    if (progRoll) progRoll.noteOff(midi);
    scheduleRollStats();
  }

  function flushPedalHeld() {
    for (const midi of Array.from(state.pedalHeld)) releaseNote(midi);
    state.pedalHeld.clear();
  }

  /* ---------------- analyser ---------------- */
  function analyseNote(velocity) {
    state.velocities.push(velocity);
    if (velocity <= 14) state.ghosts += 1;
    if (state.velocities.length > 160) state.velocities.shift();

    $("a-last").textContent = velocity;
    $("a-ghost").textContent = state.ghosts;
    const span = Math.max(...state.velocities) - Math.min(...state.velocities);
    $("a-range").textContent = `${Math.min(...state.velocities)}-${Math.max(...state.velocities)} (${span})`;
    const consistency = clamp(Math.round(100 - pstdev(state.velocities) * 2.2), 0, 100);
    $("a-consistency").textContent = consistency + "%";

    const strip = $("velocity-strip");
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = clamp((velocity / 127) * 100, 3, 100) + "%";
    bar.style.background = velocity <= 40 ? "#64748b" : velocity >= 100 ? "#ffb36b" : "#a78bfa";
    strip.appendChild(bar);
    while (strip.children.length > 46) strip.firstElementChild.remove();

    $("analyser-verdict").textContent =
      span < 18 && state.velocities.length > 6
        ? "Flat line: almost every note is the same strength. Open the Piano Roll tab to see it."
        : "Good, your dynamics are moving.";
  }

  let statsTimer = null;
  function scheduleRollStats() {
    if (statsTimer) return;
    statsTimer = setTimeout(() => {
      statsTimer = null;
      updateRollStats();
    }, 250);
  }

  function updateRollStats() {
    const stats = roll ? roll.stats() : null;
    const set = (id, value) => {
      const el = $(id);
      if (el) el.textContent = value;
    };
    if (!stats) {
      set("roll-verdict", "Play a phrase and the analysis appears.");
      return;
    }
    set("roll-count", String(stats.count));
    set("roll-min", String(stats.min));
    set("roll-max", String(stats.max));
    set("roll-span", String(stats.span));
    set("roll-ghosts", String(stats.ghosts));
    const verdict =
      stats.span < 18
        ? "Almost every note is the same strength - this is the flat sound you are trying to lose."
        : stats.span < 40
          ? "Some movement. Push the loud ones brighter and let the quiet ones fade further."
          : "Real dynamic range. Now shape it into phrases instead of isolated peaks.";
    set("roll-verdict", verdict);
  }

  function resetAnalysis() {
    state.velocities = [];
    state.ghosts = 0;
    $("velocity-strip").innerHTML = "";
    ["a-last", "a-range", "a-consistency"].forEach((id) => { $(id).textContent = "-"; });
    $("a-ghost").textContent = "0";
    $("analyser-verdict").textContent = "Play a few notes to analyse your touch.";
    if (roll) roll.clear();
    if (progRoll) progRoll.clear();
    updateRollStats();
  }

  /* ---------------- computer keyboard ---------------- */
  const KEYMAP = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
    k: 12, o: 13, l: 14, p: 15, ";": 16, "'": 17,
  };
  const heldComputerKeys = new Map();

  function bindComputerKeyboard() {
    window.addEventListener("keydown", (event) => {
      if (event.target.matches("input, select, textarea")) return;
      const key = event.key.toLowerCase();
      if (key === "z") { state.dockOctaveShift = clamp(state.dockOctaveShift - 12, -24, 12); return; }
      if (key === "x") { state.dockOctaveShift = clamp(state.dockOctaveShift + 12, -24, 12); return; }
      if (!(key in KEYMAP) || event.repeat || heldComputerKeys.has(key)) return;
      const midi = 60 + state.dockOctaveShift + KEYMAP[key];
      const velocity = event.shiftKey ? 112 : 84;
      heldComputerKeys.set(key, midi);
      handleNoteOn(midi, velocity, "computer");
    });
    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (!heldComputerKeys.has(key)) return;
      handleNoteOff(heldComputerKeys.get(key));
      heldComputerKeys.delete(key);
    });
  }

  /* ---------------- MIDI ---------------- */
  async function connectMidi() {
    const result = await Midi.connect();
    if (result.error) {
      $("midi-status").textContent = "n/a";
      $("midi-status").className = "font-semibold text-rose-300";
      toast(result.error, "bad");
      return;
    }
    const inputs = result.inputs || [];
    // keep this to one short word so the fixed-width button never shifts
    $("midi-status").textContent = inputs.length ? "on" : "none";
    $("midi-btn").title = inputs.length
      ? `Connected: ${inputs.map((i) => i.name).join(", ")}`
      : "No MIDI device found - click to search again";
    $("midi-status").className = inputs.length
      ? "font-semibold text-emerald-300"
      : "font-semibold text-yellow-300";
    const select = $("midi-input");
    select.innerHTML = inputs.map((i) => `<option value="${i.id}">${i.name}</option>`).join("");
    select.classList.toggle("hidden", inputs.length < 2);
    toast(inputs.length ? `MIDI connected: ${inputs[0].name}` : "Web MIDI active - plug a keyboard in.", inputs.length ? "good" : "info");

    const curve = state.keyboards[0] ? state.keyboards[0].default_curve : "medium";
    Midi.setCurve($("curve-select").value || curve);
  }

  let lastSustain = false;

  /** Pedal is shared by the audio engine, the roll and the on-screen indicator. */
  function applySustain(on) {
    if (lastSustain === on) return;
    lastSustain = on;
    Audio.setSustain(on);
    if (roll) roll.sustain(on);
    if (progRoll) progRoll.sustain(on);
    if (!on) flushPedalHeld();
    document.querySelectorAll("[data-pedal]").forEach((el) => {
      el.classList.toggle("bg-emerald-400/20", on);
      el.classList.toggle("border-emerald-400/50", on);
      el.classList.toggle("text-emerald-200", on);
    });
  }
  App.applySustain = applySustain;

  Midi.onMessage((event) => {
    if (event.kind === "noteon") {
      handleNoteOn(event.midi, event.velocity, "midi");
    } else if (event.kind === "noteoff") {
      handleNoteOff(event.midi);
    } else if (event.kind === "sustain") {
      applySustain(event.on);
    }
  });
  App.lastSustain = () => lastSustain;

  /* ---------------- keyboard profile ---------------- */
  function warmUpPiano() {
    const status = $("voice-status");
    if (!status) return;
    status.textContent = "Loading piano samples...";
    Audio.prefetchAll()
      .then(() => {
        const r = Audio.sampleReport();
        status.textContent =
          r.failed === 0
            ? `Grand piano ready (${r.loaded} samples).`
            : `${r.failed} of ${r.total} samples failed to load - check your connection.`;
      })
      .catch(() => {
        status.textContent = "Could not load piano samples - check your connection.";
      });
  }

  function setKeyboardProfile(id) {
    const keyboard = state.keyboards.find((k) => k.id === id);
    if (!keyboard) return;
    $("curve-select").innerHTML = keyboard.velocity_curves
      .map((c) => `<option value="${c}">${c}</option>`)
      .join("");
    $("curve-select").value = keyboard.default_curve;
    Midi.setCurve(keyboard.default_curve);
    $("keyboard-note").textContent = keyboard.note;
  }

  /* ---------------- touch drills UI ---------------- */
  /* ---------------- progression UI ---------------- */
  async function loadProgressions() {
    const list = await api(`/api/progressions?root_midi=${ProgTrainer.state.rootMidi}`, []);
    ProgTrainer.state.progressions = list;
    if (!list.length) {
      $("prog-result").textContent = "Could not load progressions from the server. Check that the app is running.";
      return;
    }
    const FAMILY_LABELS = { pop: "Pop", nostalgic: "Nostalgic / Melancholic", lofi: "Lofi / Neo-Soul" };
    $("prog-select").innerHTML = Object.entries(FAMILY_LABELS)
      .map(([family, label]) => {
        const items = list.filter((p) => p.family === family);
        if (!items.length) return "";
        return (
          `<optgroup label="${label}">` +
          items.map((p) => `<option value="${p.id}">${p.title}</option>`).join("") +
          `</optgroup>`
        );
      })
      .join("");
    ProgTrainer.select(list[0].id);
    renderProgression();
  }

  function renderProgression() {
    const prog = ProgTrainer.current();
    if (!prog) return;
    $("prog-title").textContent = `${prog.title} in ${rootName(ProgTrainer.state.rootMidi)}`;
    $("prog-info").innerHTML = `
      <p class="text-xs uppercase tracking-wide text-slate-500">Mood</p>
      <p>${prog.mood}</p>
      <p class="text-xs uppercase tracking-wide text-slate-500">Why it works</p>
      <p class="text-slate-400">${prog.why}</p>`;
    $("prog-tip").textContent = prog.tip;

    const chips = $("prog-chords");
    chips.innerHTML = "";
    prog.steps.forEach((step, i) => {
      const btn = document.createElement("button");
      btn.className = "chord-chip";
      btn.dataset.index = i;
      btn.innerHTML = `<span class="block text-[11px] text-accent/70">${step.roman}</span><span class="block text-base font-semibold text-white">${step.name}</span>`;
      btn.addEventListener("click", () => {
        ProgTrainer.state.stepIndex = i;
        highlightStep(i);
        ProgTrainer.playChord(i);
      });
      chips.appendChild(btn);
    });

    const diagram = $("prog-diagram");
    diagram.innerHTML = "";
    prog.steps.forEach((step, i) => {
      const cell = document.createElement("div");
      cell.className = "cursor-pointer rounded-lg border border-line p-2";
      cell.dataset.index = i;
      cell.innerHTML =
        `<div class="mb-1 text-[11px] text-accent/70">${step.roman} &middot; ${step.name}</div>` +
        `<div class="flex flex-wrap gap-1">${step.semitones
          .map((s) => `<span class="rounded bg-panel2 px-1.5 py-0.5 text-xs text-slate-300">${Audio.midiToName(ProgTrainer.state.rootMidi + s)}</span>`)
          .join("")}</div>`;
      cell.addEventListener("click", () => {
        ProgTrainer.state.stepIndex = i;
        highlightStep(i);
      });
      diagram.appendChild(cell);
    });

    $("prog-voice-tips").innerHTML = [
      "Give the bass note (the lowest) a little more weight than the top notes - that is what makes a chord sound 'played' rather than 'pressed'.",
      "Roll the chord slightly instead of hitting all notes at once. Even 20 ms of spread sounds human.",
      "Keep the same voicing shape as you move between chords so your hand never jumps.",
      "Lift the sustain pedal exactly when the next chord starts. Half-pedalling is the trick.",
    ].map((t) => `<li>${t}</li>`).join("");

    highlightStep(ProgTrainer.state.stepIndex);
  }

  function highlightStep(index) {
    document.querySelectorAll("#prog-chords .chord-chip").forEach((el) => {
      el.classList.toggle("chord-chip-active", Number(el.dataset.index) === index);
    });
    document.querySelectorAll("#prog-diagram > div").forEach((el) => {
      el.classList.toggle("border-accent2", Number(el.dataset.index) === index);
      el.classList.toggle("bg-accent2/10", Number(el.dataset.index) === index);
    });
    refreshHints();
  }

  async function gradeChord() {
    const prog = ProgTrainer.current();
    if (!prog) return;
    if (!ProgTrainer.hasCapture()) {
      $("prog-result").textContent = "Play a chord first (with the loop stopped), then grade it.";
      return;
    }
    const notes = Object.fromEntries(ProgTrainer.state.captured);
    const res = await fetch(`/api/progressions/${prog.id}/attempt?root_midi=${ProgTrainer.state.rootMidi}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step_index: ProgTrainer.state.stepIndex,
        notes,
        ghost_notes: ProgTrainer.state.ghostNotes,
      }),
    });
    if (!res.ok) {
      $("prog-result").textContent = "Could not grade that chord. Check the server log.";
      return;
    }
    const result = await res.json();
    const tone =
      result.grade === "Perfect" ? "text-emerald-300" :
      result.grade === "Good" ? "text-yellow-300" : "text-rose-300";
    $("prog-result").innerHTML =
      `<p class="${tone} font-semibold">${result.grade} - ${result.accuracy}% of the chord</p>` +
      `<ul class="mt-1 list-disc space-y-1 pl-4 text-slate-300">${result.feedback.map((f) => `<li>${f}</li>`).join("")}</ul>`;
    ProgTrainer.captureOn();
  }

  /* ---------------- boot ---------------- */

  /** Show a visible banner instead of failing silently. */
  function showError(where, err) {
    console.error("[" + where + "]", err);
    let bar = $("error-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "error-bar";
      bar.className =
        "fixed inset-x-0 top-0 z-50 border-b border-rose-400/40 bg-rose-500/15 px-4 py-2 text-xs text-rose-100 backdrop-blur";
      document.body.appendChild(bar);
    }
    bar.textContent = `Something broke in ${where}: ${err && err.message ? err.message : err}. Open the browser console (F12) for details.`;
  }
  App.showError = showError;

  async function api(path, fallback) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`${res.status} on ${path}`);
      return await res.json();
    } catch (err) {
      console.warn("api fallback", path, err);
      return fallback;
    }
  }

  function wireUi() {
    document.querySelectorAll("#tabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => showTab(btn.dataset.tab));
    });
    $("midi-btn").addEventListener("click", connectMidi);
    $("midi-input").addEventListener("change", (e) => Midi.selectInput(e.target.value));
    $("keyboard-select").addEventListener("change", (e) => setKeyboardProfile(e.target.value));
    $("curve-select").addEventListener("change", (e) => Midi.setCurve(e.target.value));
    $("reset-analysis").addEventListener("click", resetAnalysis);
    $("audio-sens").addEventListener("input", (e) => Audio.audioInput.setSensitivity(Number(e.target.value) / 100));
    $("audio-btn").addEventListener("click", async () => {
      const ok = await Audio.audioInput.enable();
      if (ok === true) {
        Audio.audioInput.setHandler((velocity) => {
          onVelocityEvent(state.lastNoteMidi, velocity);
          if (state.activeTab === "play") analyseNote(velocity);
        });
        $("audio-btn").textContent = "Audio input: on";
        toast("Audio input on. Play the PSR - loudness becomes velocity.", "good");
      } else {
        toast((ok && ok.error) || "Could not open the audio input.", "bad");
      }
    });

    document.querySelectorAll("[data-demo]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const strip = $("demo-velocity");
        strip.innerHTML = "";
        await Demos.play(btn.dataset.demo, ({ velocity }) => {
          const bar = document.createElement("div");
          bar.className = "min-w-[4px] flex-1 rounded-t-sm";
          bar.style.height = clamp((velocity / 127) * 100, 4, 100) + "%";
          bar.style.background = velocity >= 100 ? "#ffb36b" : velocity <= 45 ? "#64748b" : "#a78bfa";
          strip.appendChild(bar);
        });
      });
    });

    $("roll-clear").addEventListener("click", () => {
      resetAnalysis();
      toast("Cleared.", "info");
    });
    $("roll-pause").addEventListener("click", () => {
      const paused = roll.togglePause();
      $("roll-pause").textContent = paused ? "Resume" : "Freeze";
    });

    $("prog-select").addEventListener("change", (e) => {
      ProgTrainer.select(e.target.value);
      renderProgression();
    });
    $("root-select").addEventListener("change", async (e) => {
      ProgTrainer.setRoot(Number(e.target.value));
      await loadProgressions();
    });
    $("prog-play").addEventListener("click", async () => {
      ProgTrainer.captureOff();
      for (let i = 0; i < ProgTrainer.current().steps.length; i++) {
        highlightStep(i);
        await ProgTrainer.playChord(i, 84, 700);
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    });
    $("prog-metronome").addEventListener("click", () => {
      const on = ProgTrainer.toggleMetronome();
      $("prog-metronome").textContent = `Metronome: ${on ? "on" : "off"}`;
    });
    $("prog-loop").addEventListener("click", () => {
      if (ProgTrainer.state.loopTimer) {
        ProgTrainer.stopLoop();
        $("prog-loop").textContent = "Start loop";
        return;
      }
      ProgTrainer.captureOff();
      $("prog-loop").textContent = "Stop loop";
      ProgTrainer.startLoop((index) => highlightStep(index));
    });
    $("prog-grade").addEventListener("click", async () => {
      ProgTrainer.captureOff();
      await gradeChord();
      ProgTrainer.captureOn();
    });
    ProgTrainer.captureOn();
  }

  async function boot() {
    // 1. wire the UI first: a network hiccup must never leave the page dead
    try {
      buildKeyboards();
      bindComputerKeyboard();
      roll = PianoRoll.create($("roll-canvas"));
      roll.start();
      progRoll = PianoRoll.create($("prog-canvas"));
      progRoll.start();
      PianoRoll.renderLegend($("roll-legend"));
      warmUpPiano();
      wireUi();
      $("root-select").innerHTML = ROOTS.map((m) => `<option value="${m}" ${m === 60 ? "selected" : ""}>${rootName(m)}</option>`).join("");
    } catch (err) {
      showError("setup", err);
    }

    // 2. data: each fetch degrades to a working default
    const config = await api("/api/config", { app_name: "Feel Piano" });
    state.config = config;
    document.title = config.app_name;

    const keyboards = await api("/api/keyboards", [
      { id: "generic", name: "Generic MIDI keyboard", keys: 61, velocity_curves: ["soft", "medium", "hard"], default_curve: "medium", note: "Using default settings." },
    ]);
    state.keyboards = keyboards;
    $("keyboard-select").innerHTML = keyboards.map((k) => `<option value="${k.id}">${k.name} (${k.keys} keys)</option>`).join("");
    setKeyboardProfile(keyboards[0].id);

    await loadProgressions();

    document.addEventListener("pointerdown", () => Audio.init(), { once: true });
    toast("Click anywhere, then play. Press MIDI: off to connect your keyboard.", "info");

    // 3. surface anything that slips through later, on screen rather than only in console
    window.addEventListener("error", (e) => showError("the page", e.error || e.message));
    window.addEventListener("unhandledrejection", (e) => showError("a background task", e.reason));
  }

  App.boot = boot;
  App.handleNoteOn = handleNoteOn;
  boot();
})();
