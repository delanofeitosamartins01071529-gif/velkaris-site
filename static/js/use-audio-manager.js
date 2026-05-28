(() => {
  const config = window.VelkarisAudioConfig || {};
  const defaults = config.defaults || {};
  const storageKey = config.storageKey || "velkaris.audio.preferences.v1";
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
  const state = {
    musicEnabled: false,
    effectsEnabled: true,
    musicVolume: 0.42,
    effectsVolume: 0.28,
    ...defaults,
  };

  try {
    Object.assign(state, JSON.parse(localStorage.getItem(storageKey) || "{}"));
  } catch (error) {
    // Preferences are optional.
  }
  state.musicEnabled = false;
  state.musicVolume = clamp(state.musicVolume);
  state.effectsVolume = clamp(state.effectsVolume);

  let audioContext;
  let musicGain;
  let effectsGain;
  let musicNodes = [];
  let pulseTimer = 0;
  let lastHoverAt = 0;

  const panel = document.querySelector("[data-audio-panel]");
  const panelToggle = document.querySelector("[data-audio-panel-toggle]");
  const panelClose = document.querySelector("[data-audio-panel-close]");
  const musicToggle = document.querySelector("[data-music-toggle]");
  const effectsToggle = document.querySelector("[data-effects-toggle]");
  const musicVolume = document.querySelector("[data-music-volume]");
  const effectsVolume = document.querySelector("[data-effects-volume]");

  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify({
      musicEnabled: state.musicEnabled,
      effectsEnabled: state.effectsEnabled,
      musicVolume: state.musicVolume,
      effectsVolume: state.effectsVolume,
    }));
  };

  const ensureAudio = async () => {
    audioContext = audioContext || new AudioContext();
    if (!musicGain) {
      musicGain = audioContext.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(audioContext.destination);
    }
    if (!effectsGain) {
      effectsGain = audioContext.createGain();
      effectsGain.gain.value = state.effectsVolume;
      effectsGain.connect(audioContext.destination);
    }
    if (audioContext.state !== "running") await audioContext.resume();
    return audioContext;
  };

  const updateUi = () => {
    panelToggle?.classList.toggle("is-active", state.musicEnabled || state.effectsEnabled);
    panelToggle?.setAttribute("aria-expanded", String(!panel?.hidden));
    if (musicToggle) {
      musicToggle.textContent = state.musicEnabled ? "Desativar música" : "Ativar música";
      musicToggle.classList.toggle("is-active", state.musicEnabled);
    }
    if (effectsToggle) {
      effectsToggle.textContent = state.effectsEnabled ? "Desativar efeitos" : "Ativar efeitos";
      effectsToggle.classList.toggle("is-active", state.effectsEnabled);
    }
    if (musicVolume) musicVolume.value = String(Math.round(state.musicVolume * 100));
    if (effectsVolume) effectsVolume.value = String(Math.round(state.effectsVolume * 100));
    if (musicGain && audioContext) {
      musicGain.gain.setTargetAtTime(state.musicEnabled ? state.musicVolume : 0.0001, audioContext.currentTime, 0.2);
    }
    if (effectsGain && audioContext) {
      effectsGain.gain.setTargetAtTime(state.effectsEnabled ? state.effectsVolume : 0.0001, audioContext.currentTime, 0.08);
    }
  };

  const stopMusic = () => {
    clearTimeout(pulseTimer);
    pulseTimer = 0;
    if (!audioContext) return;
    const now = audioContext.currentTime;
    musicGain?.gain.setTargetAtTime(0.0001, now, 0.35);
    musicNodes.forEach((node) => {
      try {
        node.stop?.(now + 0.7);
      } catch (error) {
        // Gain/filter nodes do not stop.
      }
      node.disconnect?.();
    });
    musicNodes = [];
  };

  const addDrone = (frequency, gainValue, detune = 0) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = detune;
    gain.gain.value = gainValue;
    oscillator.connect(gain);
    gain.connect(musicGain);
    oscillator.start();
    musicNodes.push(oscillator, gain);
  };

  const playNote = (frequency, start, duration = 2.6) => {
    if (!audioContext || !musicGain || !state.musicEnabled) return;
    const oscillator = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1120, start);
    filter.Q.value = 0.45;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(musicGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.2);
  };

  const schedulePhrase = () => {
    if (!audioContext || !state.musicEnabled) return;
    const now = audioContext.currentTime + 0.08;
    const phrase = [220, 261.63, 329.63, 392, 329.63, 293.66, 246.94, 196];
    phrase.forEach((note, index) => playNote(note, now + index * 0.72, index % 3 === 0 ? 3.4 : 2.1));
    pulseTimer = window.setTimeout(schedulePhrase, 8200);
  };

  const startMusic = async () => {
    await ensureAudio();
    if (musicNodes.length) stopMusic();
    addDrone(55, 0.16, -4);
    addDrone(82.41, 0.08, 3);
    addDrone(110, 0.05, 6);
    schedulePhrase();
    state.musicEnabled = true;
    updateUi();
    save();
  };

  const playHover = async (variant = 0) => {
    if (!state.effectsEnabled) return;
    const nowMs = performance.now();
    if (nowMs - lastHoverAt < (config.hoverCooldownMs || 180)) return;
    lastHoverAt = nowMs;
    await ensureAudio();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime([659.25, 783.99, 987.77, 1174.66][variant % 4], now);
    oscillator.frequency.exponentialRampToValueAtTime([783.99, 987.77, 1174.66, 1318.51][variant % 4], now + 0.11);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(effectsGain);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  };

  panelToggle?.addEventListener("click", () => {
    if (!panel) return;
    panel.hidden = !panel.hidden;
    updateUi();
  });
  panelClose?.addEventListener("click", () => {
    if (panel) panel.hidden = true;
    updateUi();
  });
  musicToggle?.addEventListener("click", async () => {
    if (state.musicEnabled) {
      state.musicEnabled = false;
      stopMusic();
      updateUi();
      save();
    } else {
      await startMusic();
    }
  });
  effectsToggle?.addEventListener("click", () => {
    state.effectsEnabled = !state.effectsEnabled;
    updateUi();
    save();
  });
  musicVolume?.addEventListener("input", () => {
    state.musicVolume = clamp(Number(musicVolume.value) / 100);
    updateUi();
    save();
  });
  effectsVolume?.addEventListener("input", () => {
    state.effectsVolume = clamp(Number(effectsVolume.value) / 100);
    updateUi();
    save();
  });

  document.addEventListener("pointerenter", (event) => {
    const selectors = config.hoverSelectors || [];
    const target = selectors.length ? event.target.closest?.(selectors.join(",")) : null;
    if (!target) return;
    playHover([...document.querySelectorAll(selectors.join(","))].indexOf(target));
  }, true);

  window.VelkarisAudio = { playHover, state };
  updateUi();
})();
