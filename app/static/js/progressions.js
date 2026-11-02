/* Chord progression browser, playback, held-note capture and grading via the API. */
(function () {
  const Prog = (window.ProgTrainer = {});

  const state = {
    progressions: [],
    current: null,
    rootMidi: 60,
    stepIndex: 0,
    captured: new Map(),
    ghostNotes: [],
    captureOpen: false,
    loopTimer: null,
    metronome: null,
    tempo: 72,
    onPlayChord: null,
    onCaptureChange: null,
  };

  Prog.state = state;
  Prog.current = () => state.current;

  /** Build the chord from the MIDI the user is physically holding right now. */
  Prog.captureOn = function () {
    state.captured.clear();
    state.ghostNotes = [];
    state.captureOpen = true;
  };

  Prog.captureOff = function () {
    state.captureOpen = false;
  };

  Prog.noteOn = function (midi, velocity) {
    if (!state.captureOpen) return;
    if (velocity <= 14) {
      state.ghostNotes.push(midi);
      return;
    }
    state.captured.set(midi, Math.max(velocity, state.captured.get(midi) || 0));
    if (state.onCaptureChange) state.onCaptureChange(Array.from(state.captured.keys()));
  };

  Prog.noteOff = function (midi) {
    // notes stay captured until grading; the user lifts keys before pressing "grade"
  };

  Prog.hasCapture = () => state.captured.size > 0;

  Prog.select = function (id) {
    const prog = state.progressions.find((p) => p.id === id);
    if (prog) {
      state.current = prog;
      state.stepIndex = 0;
    }
    return state.current;
  };

  Prog.setRoot = function (rootMidi) {
    state.rootMidi = rootMidi;
  };

  Prog.step = function (index) {
    if (!state.current) return null;
    const steps = state.current.steps;
    return steps[index % steps.length];
  };

  Prog.stepNotes = function (index) {
    const step = Prog.step(index);
    if (!step) return [];
    return step.semitones.map((s) => state.rootMidi + s);
  };

  Prog.playChord = async function (index, velocity = 82, holdMs = 900) {
    const notes = Prog.stepNotes(index);
    await Audio.prefetch(notes);
    await Promise.all(notes.map((m) => Audio.playBlocking(m, velocity, holdMs)));
  };

  Prog.startLoop = function (onStep) {
    Prog.stopLoop();
    if (!state.current) return;
    const bpm = state.current.steps[0].tempo_bpm;
    const beat = 60000 / bpm;
    let i = 0;
    const tick = async () => {
      state.stepIndex = i % state.current.steps.length;
      if (onStep) onStep(state.stepIndex);
      await Prog.playChord(state.stepIndex, 78, beat * 0.9);
      i += 1;
    };
    tick();
    state.loopTimer = setInterval(tick, beat);
  };

  Prog.stopLoop = function () {
    if (state.loopTimer) clearInterval(state.loopTimer);
    state.loopTimer = null;
  };

  Prog.toggleMetronome = function (onTick) {
    if (state.metronome) {
      clearInterval(state.metronome);
      state.metronome = null;
      return false;
    }
    const bpm = state.current ? state.current.steps[0].tempo_bpm : state.tempo;
    const period = 60000 / bpm;
    let count = 0;
    const tick = () => {
      // a high, short click - audible above the piano
      Audio.playBlocking(96, count % 4 === 0 ? 70 : 45, 40);
      count += 1;
      if (onTick) onTick(count);
    };
    tick();
    state.metronome = setInterval(tick, period);
    return true;
  };

  Prog.stopAll = function () {
    Prog.stopLoop();
    if (state.metronome) {
      clearInterval(state.metronome);
      state.metronome = null;
    }
  };
})();
