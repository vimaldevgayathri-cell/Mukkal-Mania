// =============================================================================
// MUKKAL-MANIA AUDIO MANAGER (Synthesizer Fallback)
// =============================================================================
window.MukkalAudio = (function () {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  function playTone(freq, type, duration) {
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioContext.currentTime);
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + duration);
  }

  return {
    playSFX: function (key) {
      if (key === "button_hover") playTone(440, "sine", 0.05);
      else if (key === "button_click") playTone(880, "square", 0.1);
      else playTone(587, "triangle", 0.15);
    },
    playBGM: function () {},
    playMemeFail: function () {
      playTone(150, "sawtooth", 0.4);
    },
    playVictory: function () {
      playTone(523, "square", 0.2);
    }
  };
})();s