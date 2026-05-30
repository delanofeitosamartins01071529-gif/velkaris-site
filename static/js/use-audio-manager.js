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
  state.musicVolume = clamp(state.musicVolume);
  state.effectsVolume = clamp(state.effectsVolume);

  let audioContext;
  let musicGain;
  let effectsGain;
  let roomGain;
  let musicElement;
  let musicNodes = [];
  let pulseTimer = 0;
  let lastHoverAt = 0;
  let lastClickAt = 0;
  let phraseIndex = 0;

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
    if (!roomGain) {
      const delay = audioContext.createDelay(1.2);
      const feedback = audioContext.createGain();
      const tone = audioContext.createBiquadFilter();
      roomGain = audioContext.createGain();
      delay.delayTime.value = 0.18;
      feedback.gain.value = 0.24;
      tone.type = "lowpass";
      tone.frequency.value = 1800;
      roomGain.gain.value = 0.22;
      delay.connect(tone);
      tone.connect(feedback);
      feedback.connect(delay);
      tone.connect(roomGain);
      roomGain.connect(audioContext.destination);
      musicGain.connect(delay);
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
    if (musicElement) musicElement.volume = state.musicEnabled ? state.musicVolume : 0;
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
    if (musicElement) {
      musicElement.pause();
      musicElement.currentTime = 0;
    }
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

  const playStringVoice = ({
    frequency,
    start,
    duration = 2.4,
    gainValue = 0.04,
    attack = 0.18,
    filterStart = 520,
    filterPeak = 920,
    pan = 0,
    detune = 0,
    type = "triangle",
  }) => {
    if (!audioContext || !musicGain || !state.musicEnabled) return;
    const fundamental = audioContext.createOscillator();
    const harmonic = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    const panner = audioContext.createStereoPanner();

    fundamental.type = type;
    harmonic.type = "sine";
    fundamental.frequency.setValueAtTime(frequency, start);
    harmonic.frequency.setValueAtTime(frequency * 2.01, start);
    fundamental.detune.setValueAtTime(detune - 3, start);
    harmonic.detune.setValueAtTime(detune + 4, start);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterStart, start);
    filter.frequency.exponentialRampToValueAtTime(filterPeak, start + Math.max(attack, 0.06));
    filter.frequency.exponentialRampToValueAtTime(Math.max(220, filterStart * 0.66), start + duration);
    filter.Q.value = 0.55;
    panner.pan.value = pan;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + attack);
    gain.gain.setTargetAtTime(gainValue * 0.62, start + attack + 0.18, duration * 0.28);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    fundamental.connect(filter);
    harmonic.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(musicGain);
    fundamental.start(start);
    harmonic.start(start);
    fundamental.stop(start + duration + 0.18);
    harmonic.stop(start + duration + 0.18);
  };

  const playChord = (notes, start, duration, gainValue = 0.022) => {
    notes.forEach((note, index) => {
      playStringVoice({
        frequency: note,
        start: start + index * 0.025,
        duration,
        gainValue,
        attack: 0.46,
        filterStart: 380,
        filterPeak: 760,
        pan: (index - 1) * 0.18,
        detune: index * 2,
      });
    });
  };

  const schedulePhrase = () => {
    if (!audioContext || !state.musicEnabled) return;
    const now = audioContext.currentTime + 0.12;
    const phrases = [
      {
        bass: [98, 123.47, 146.83, 130.81, 110, 130.81, 146.83, 123.47, 116.54, 146.83, 174.61, 164.81],
        inner: [146.83, 164.81, 174.61, 196, 174.61, 164.81, 146.83, 130.81, 146.83, 174.61, 196, 184.99],
        melody: [196, 220, 246.94, 261.63, 293.66, 261.63, 246.94, 220, 207.65, 246.94, 277.18, 246.94],
        chords: [[146.83, 196, 246.94], [130.81, 174.61, 220], [110, 164.81, 220], [123.47, 196, 246.94], [116.54, 174.61, 233.08], [146.83, 196, 261.63]],
      },
      {
        bass: [87.31, 110, 130.81, 146.83, 138.59, 116.54, 103.83, 98, 110, 130.81, 155.56, 146.83],
        inner: [130.81, 146.83, 164.81, 174.61, 184.99, 174.61, 155.56, 146.83, 164.81, 174.61, 207.65, 196],
        melody: [174.61, 196, 220, 246.94, 233.08, 196, 184.99, 174.61, 196, 220, 261.63, 233.08],
        chords: [[130.81, 174.61, 220], [146.83, 196, 233.08], [116.54, 174.61, 220], [98, 146.83, 196], [110, 164.81, 220], [146.83, 196, 246.94]],
      },
    ];
    const phrase = phrases[phraseIndex % phrases.length];
    phraseIndex += 1;

    phrase.bass.forEach((note, index) => {
      const start = now + index * 0.78;
      playStringVoice({
        frequency: note,
        start,
        duration: index % 3 === 0 ? 1.55 : 1.05,
        gainValue: 0.032,
        attack: 0.12,
        filterStart: 320,
        filterPeak: 680,
        pan: -0.22,
      });
      playStringVoice({
        frequency: phrase.inner[index],
        start: start + 0.08,
        duration: 1.75,
        gainValue: 0.019,
        attack: 0.34,
        filterStart: 460,
        filterPeak: 880,
        pan: index % 2 ? 0.12 : -0.06,
      });
      if (index % 2 === 0 || index === 7) {
        playStringVoice({
          frequency: phrase.melody[index],
          start: start + 0.18,
          duration: index === 7 ? 2.4 : 1.85,
          gainValue: 0.026,
          attack: 0.22,
          filterStart: 620,
          filterPeak: 1200,
          pan: 0.28,
        });
      }
    });

    phrase.chords.forEach((chord, index) => {
      playChord(chord, now + index * 1.56 + 0.06, 2.45, 0.015);
    });

    pulseTimer = window.setTimeout(schedulePhrase, 9900);
  };

  const startMusic = async () => {
    if (config.musicSrc) {
      musicElement = musicElement || new Audio(config.musicSrc);
      musicElement.loop = true;
      musicElement.preload = "auto";
      musicElement.volume = state.musicVolume;
      state.musicEnabled = true;
      updateUi();
      save();
      if (!musicElement.paused) return;
      await musicElement.play();
      return;
    }
    await ensureAudio();
    if (musicNodes.length) stopMusic();
    phraseIndex = 0;
    schedulePhrase();
    state.musicEnabled = true;
    updateUi();
    save();
  };

  const playSwordSheen = async (variant = 0, mode = "hover") => {
    if (!state.effectsEnabled) return;
    const nowMs = performance.now();
    if (mode === "hover") {
      const cooldown = Number(config.hoverCooldownMs ?? 180);
      if (cooldown > 0 && nowMs - lastHoverAt < cooldown) return;
      lastHoverAt = nowMs;
    } else {
      if (nowMs - lastClickAt < 130) return;
      lastClickAt = nowMs;
    }
    await ensureAudio();
    const now = audioContext.currentTime;
    const duration = mode === "click" ? 0.36 : 0.42;
    const noiseBuffer = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * duration), audioContext.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let index = 0; index < noise.length; index += 1) {
      const progress = index / Math.max(1, noise.length - 1);
      const envelope = mode === "click" ? progress : 1 - progress;
      noise[index] = (Math.random() * 2 - 1) * envelope;
    }
    const scrape = audioContext.createBufferSource();
    const brightFilter = audioContext.createBiquadFilter();
    const narrowFilter = audioContext.createBiquadFilter();
    const scrapeGain = audioContext.createGain();
    const ring = audioContext.createOscillator();
    const ringGain = audioContext.createGain();
    const panner = audioContext.createStereoPanner();

    const frequencies = [523.25, 587.33, 659.25, 698.46, 783.99];
    const frequency = frequencies[Math.abs(variant) % frequencies.length];
    const startBand = mode === "click" ? 3100 : 620;
    const endBand = mode === "click" ? 620 : 3100;
    const startRing = mode === "click" ? frequency * 1.35 : frequency * 0.72;
    const endRing = mode === "click" ? frequency * 0.72 : frequency * 1.35;

    scrape.buffer = noiseBuffer;
    brightFilter.type = "highpass";
    brightFilter.frequency.setValueAtTime(420, now);
    brightFilter.Q.value = 0.7;
    narrowFilter.type = "bandpass";
    narrowFilter.frequency.setValueAtTime(startBand, now);
    narrowFilter.frequency.exponentialRampToValueAtTime(endBand, now + duration);
    narrowFilter.Q.value = 7.5;
    scrapeGain.gain.setValueAtTime(0.0001, now);
    if (mode === "click") {
      scrapeGain.gain.exponentialRampToValueAtTime(0.024, now + 0.16);
      scrapeGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    } else {
      scrapeGain.gain.exponentialRampToValueAtTime(0.026, now + 0.025);
      scrapeGain.gain.setTargetAtTime(0.015, now + 0.08, 0.16);
      scrapeGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    }

    ring.type = "sine";
    ring.frequency.setValueAtTime(startRing, now);
    ring.frequency.exponentialRampToValueAtTime(endRing, now + duration * 0.72);
    ringGain.gain.setValueAtTime(0.0001, now);
    ringGain.gain.exponentialRampToValueAtTime(mode === "click" ? 0.018 : 0.014, now + (mode === "click" ? 0.12 : 0.03));
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.12);
    panner.pan.value = ((variant % 3) - 1) * 0.16;

    scrape.connect(brightFilter);
    brightFilter.connect(narrowFilter);
    narrowFilter.connect(scrapeGain);
    scrapeGain.connect(effectsGain);
    ring.connect(ringGain);
    ringGain.connect(panner);
    panner.connect(effectsGain);

    scrape.start(now);
    ring.start(now);
    scrape.stop(now + duration);
    ring.stop(now + duration + 0.08);
  };

  const playHover = (variant = 0) => playSwordSheen(variant, "hover");
  const playClick = (variant = 0) => playSwordSheen(variant, "click");
  const playPanelOpen = async () => {
    if (!state.effectsEnabled) return;
    await ensureAudio();
    const now = audioContext.currentTime;
    [392, 523.25, 659.25].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.035);
      filter.type = "bandpass";
      filter.frequency.value = frequency * 1.8;
      filter.Q.value = 2.4;
      gain.gain.setValueAtTime(0.0001, now + index * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.018, now + index * 0.035 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.54 + index * 0.03);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(effectsGain);
      oscillator.start(now + index * 0.035);
      oscillator.stop(now + 0.62 + index * 0.03);
    });
  };

  panelToggle?.addEventListener("click", () => {
    if (!panel) return;
    const willOpen = panel.hidden;
    panel.hidden = !panel.hidden;
    if (willOpen) playPanelOpen();
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

  document.addEventListener("click", (event) => {
    const selectors = config.hoverSelectors || [];
    const target = selectors.length ? event.target.closest?.(selectors.join(",")) : null;
    if (!target) return;
    playClick([...document.querySelectorAll(selectors.join(","))].indexOf(target));
  }, true);

  document.addEventListener("pointerdown", () => {
    if (state.musicEnabled && musicElement?.paused) musicElement.play().catch(() => {});
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.musicEnabled && musicElement?.paused) musicElement.play().catch(() => {});
  });

  window.VelkarisAudio = { playHover, playClick, playPanelOpen, state };
  updateUi();

  if (state.musicEnabled) {
    const startOnGesture = async () => {
      window.removeEventListener("pointerdown", startOnGesture);
      window.removeEventListener("keydown", startOnGesture);
      if (!musicNodes.length) await startMusic();
    };
    window.addEventListener("pointerdown", startOnGesture, { once: true });
    window.addEventListener("keydown", startOnGesture, { once: true });
  }
})();
