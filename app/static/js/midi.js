/* Web MIDI access + velocity curves. Falls back gracefully when the browser has no Web MIDI. */
(function () {
  const Midi = (window.Midi = {});

  const state = {
    access: null,
    inputs: new Map(),
    activeInputId: null,
    curve: "medium",
    handlers: new Set(),
  };

  const CURVES = {
    linear: (v) => v,
    soft: (v) => Math.round(127 * Math.pow(v / 127, 0.7)),
    medium: (v) => Math.round(127 * Math.pow(v / 127, 1.0)),
    hard: (v) => Math.round(127 * Math.pow(v / 127, 1.45)),
  };

  Midi.applyCurve = function (raw) {
    const fn = CURVES[state.curve] || CURVES.medium;
    return Math.max(1, Math.min(127, fn(Math.max(1, Math.min(127, raw)))));
  };
  Midi.setCurve = (c) => { state.curve = c; };
  Midi.curves = () => Object.keys(CURVES);
  Midi.onMessage = (fn) => { state.handlers.add(fn); return () => state.handlers.delete(fn); };
  Midi.supported = () => Boolean(navigator.requestMIDIAccess);

  function dispatch(event) {
    for (const fn of state.handlers) fn(event);
  }

  function bindInput(input) {
    if (!input) return;
    input.onmidimessage = (msg) => {
      const [status, d1, d2] = msg.data;
      const type = status & 0xf0;
      const channel = status & 0x0f;
      if (type === 0x90 && d2 > 0) {
        dispatch({ kind: "noteon", midi: d1, rawVelocity: d2, velocity: Midi.applyCurve(d2), channel });
      } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
        dispatch({ kind: "noteoff", midi: d1, velocity: 0, channel });
      } else if (type === 0xb0 && (d1 === 64 || d1 === 66)) {
        dispatch({ kind: "sustain", on: d2 >= 64, channel });
      } else if (type === 0xe0) {
        const value = ((d2 << 7) | d1) - 8192;
        if (Math.abs(value) > 400) dispatch({ kind: "bend", value: value / 8192 });
      }
    };
  }

  Midi.connect = async function () {
    if (!Midi.supported()) {
      return { error: "This browser has no Web MIDI. Try Chrome or Edge." };
    }
    if (state.access) return { inputs: Midi.inputs() };
    try {
      state.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      return { error: err.message || "MIDI access denied" };
    }

    const sync = () => {
      state.inputs.clear();
      state.access.inputs.forEach((input) => {
        state.inputs.set(input.id, input.name || "MIDI input");
        bindInput(input);
      });
      if (!state.activeInputId && state.inputs.size) {
        state.activeInputId = state.inputs.keys().next().value;
      }
    };
    state.access.onstatechange = sync;
    sync();
    return { inputs: Midi.inputs() };
  };

  Midi.inputs = () => Array.from(state.inputs, ([id, name]) => ({ id, name }));
  Midi.activeInputId = () => state.activeInputId;
  Midi.selectInput = (id) => {
    state.activeInputId = id;
    const input = state.access && state.access.inputs.get(id);
    if (input) bindInput(input);
  };
})();
