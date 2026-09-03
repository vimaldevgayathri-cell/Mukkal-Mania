// ============================================================
// MUKKAL-MANIA — AUDIO
// ============================================================
// Zero-conflict rule: everything under window.MukkalAudio.

window.MukkalAudio = (function () {

  let ctx = null;

  /**
   * Web Audio API blocks sound until a real user gesture occurs.
   * Call this from the FIRST click/keydown anywhere on the intro
   * screen (wired in ui.js). Playing a silent buffer immediately
   * unlocks the context for every sound that follows.
   */
  function unlockOnFirstGesture() {
    if (window.MukkalState.audioUnlocked) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContext();

    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    window.MukkalState.audioUnlocked = true;
    console.log('[MukkalAudio] Context unlocked');
  }

  /**
   * Play a preloaded <audio> element by its key in
   * MukkalEngine.assets.audio. Safe no-op if not loaded yet.
   */
  function play(key, { volume = 1.0, loop = false } = {}) {
    const clip = window.MukkalEngine.assets.audio[key];
    if (!clip) {
      console.warn(`[MukkalAudio] Missing audio asset: ${key}`);
      return;
    }
    const instance = clip.cloneNode(); // allow overlapping triggers
    instance.volume = volume;
    instance.loop = loop;
    instance.play().catch(err => console.warn('[MukkalAudio] play blocked:', err));
  }

  return {
    unlockOnFirstGesture,
    play,
  };
})();
