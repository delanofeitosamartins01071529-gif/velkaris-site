(() => {
  const config = window.VelkarisAudioConfig || {};
  const defaults = config.defaults || {};
  const storageKey = config.storageKey || "velkaris.audio.preferences.v1";
  const playbackStorageKey = `${storageKey}.playback`;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value) || 0));
  const state = {
    musicEnabled: false,
    effectsEnabled: true,
    musicVolume: 0.42,
    windVolume: 0.18,
    ...defaults,
  };

  try {
    Object.assign(state, JSON.parse(localStorage.getItem(storageKey) || "{}"));
  } catch (error) {
    // Preferences are optional.
  }
  state.musicEnabled = true;
  state.musicVolume = 0.3;
  state.windVolume = clamp(state.windVolume ?? state.effectsVolume ?? 0.18);

  let audioContext;
  let musicGain;
  let effectsGain;
  let roomGain;
  let musicElement = document.querySelector("[data-background-music]");
  let musicNodes = [];
  let pulseTimer = 0;
  let lastHoverAt = 0;
  let lastClickAt = 0;
  let phraseIndex = 0;
  let playbackTimer = 0;
  let musicElementReady = false;
  let fadeFrame = 0;
  let isFadingMusic = false;
  const windPlayers = [];
  let windPlayerIndex = 0;

  const panel = document.querySelector("[data-audio-panel]");
  const panelToggle = document.querySelector("[data-audio-panel-toggle]");
  const panelClose = document.querySelector("[data-audio-panel-close]");
  const musicToggle = document.querySelector("[data-music-toggle]");
  const musicVolume = document.querySelector("[data-music-volume]");
  const windVolume = document.querySelector("[data-wind-volume]");

  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify({
      musicEnabled: state.musicEnabled,
      effectsEnabled: state.effectsEnabled,
      musicVolume: state.musicVolume,
      windVolume: state.windVolume,
    }));
  };

  const persistMusicPosition = () => {
    if (!musicElement || !Number.isFinite(musicElement.currentTime)) return;
    localStorage.setItem(playbackStorageKey, JSON.stringify({
      currentTime: musicElement.currentTime,
      savedAt: Date.now(),
      playing: state.musicEnabled && !musicElement.paused,
    }));
  };

  const restoreMusicPosition = () => {
    if (!musicElement) return;
    try {
      const saved = JSON.parse(localStorage.getItem(playbackStorageKey) || "{}");
      const elapsed = saved.playing && state.musicEnabled ? (Date.now() - Number(saved.savedAt || Date.now())) / 1000 : 0;
      const target = Math.max(0, Number(saved.currentTime || 0) + elapsed);
      musicElement.currentTime = musicElement.duration ? target % musicElement.duration : target;
    } catch (error) {
      // Playback continuity is a progressive enhancement.
    }
  };

  const ensureMusicElement = () => {
    if (!musicElement) {
      if (!config.musicSrc) return null;
      musicElement = new Audio(config.musicSrc);
    }
    if (musicElementReady) return musicElement;
    musicElement.loop = true;
    musicElement.preload = "auto";
    musicElement.addEventListener("loadedmetadata", restoreMusicPosition, { once: true });
    restoreMusicPosition();
    playbackTimer = window.setInterval(persistMusicPosition, 1000);
    musicElementReady = true;
    return musicElement;
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
      effectsGain.gain.value = state.windVolume;
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
    if (musicVolume) musicVolume.value = String(Math.round(state.musicVolume * 100));
    if (windVolume) windVolume.value = String(Math.round(state.windVolume * 100));
    if (musicElement && !isFadingMusic) musicElement.volume = state.musicEnabled ? state.musicVolume : 0;
    if (musicGain && audioContext) {
      musicGain.gain.setTargetAtTime(state.musicEnabled ? state.musicVolume : 0.0001, audioContext.currentTime, 0.2);
    }
    if (effectsGain && audioContext) {
      effectsGain.gain.setTargetAtTime(state.effectsEnabled ? state.windVolume : 0.0001, audioContext.currentTime, 0.08);
    }
  };

  const stopMusic = () => {
    window.cancelAnimationFrame(fadeFrame);
    isFadingMusic = false;
    clearTimeout(pulseTimer);
    pulseTimer = 0;
    if (musicElement) {
      persistMusicPosition();
      musicElement.pause();
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

  const fadeInMusic = (duration = 3000) => {
    if (!musicElement || !state.musicEnabled) return;
    window.cancelAnimationFrame(fadeFrame);
    const startedAt = performance.now();
    const targetVolume = state.musicVolume;
    isFadingMusic = true;
    musicElement.volume = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      musicElement.volume = targetVolume * progress;
      if (progress < 1 && state.musicEnabled && !musicElement.paused) {
        fadeFrame = window.requestAnimationFrame(tick);
        return;
      }
      isFadingMusic = false;
      musicElement.volume = state.musicEnabled ? state.musicVolume : 0;
    };
    fadeFrame = window.requestAnimationFrame(tick);
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

  const startMusic = async ({ fadeIn = false } = {}) => {
    if (config.musicSrc) {
      ensureMusicElement();
      state.musicEnabled = true;
      isFadingMusic = fadeIn;
      musicElement.volume = fadeIn ? 0 : state.musicVolume;
      updateUi();
      save();
      if (!musicElement.paused) {
        if (fadeIn) fadeInMusic();
        return;
      }
      try {
        await musicElement.play();
        if (fadeIn) fadeInMusic();
      } catch (error) {
        isFadingMusic = false;
        musicElement.volume = 0;
        throw error;
      }
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
    const roughFilter = audioContext.createBiquadFilter();
    const steelFilter = audioContext.createBiquadFilter();
    const roughGain = audioContext.createGain();
    const steelGain = audioContext.createGain();
    const resonance = audioContext.createOscillator();
    const resonanceGain = audioContext.createGain();
    const panner = audioContext.createStereoPanner();

    const frequencies = [293.66, 329.63, 349.23, 392, 440];
    const frequency = frequencies[Math.abs(variant) % frequencies.length];
    const startBand = mode === "click" ? 2850 : 960;
    const endBand = mode === "click" ? 960 : 2850;
    const startSteel = mode === "click" ? 4200 : 1900;
    const endSteel = mode === "click" ? 1900 : 4200;

    scrape.buffer = noiseBuffer;
    roughFilter.type = "bandpass";
    roughFilter.frequency.setValueAtTime(startBand, now);
    roughFilter.frequency.exponentialRampToValueAtTime(endBand, now + duration);
    roughFilter.Q.value = 2.8;
    steelFilter.type = "bandpass";
    steelFilter.frequency.setValueAtTime(startSteel, now);
    steelFilter.frequency.exponentialRampToValueAtTime(endSteel, now + duration);
    steelFilter.Q.value = 8.6;
    roughGain.gain.setValueAtTime(0.0001, now);
    steelGain.gain.setValueAtTime(0.0001, now);
    if (mode === "click") {
      roughGain.gain.exponentialRampToValueAtTime(0.02, now + 0.14);
      steelGain.gain.exponentialRampToValueAtTime(0.014, now + 0.12);
    } else {
      roughGain.gain.exponentialRampToValueAtTime(0.02, now + 0.035);
      steelGain.gain.exponentialRampToValueAtTime(0.016, now + 0.05);
    }
    roughGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    steelGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    resonance.type = "sine";
    resonance.frequency.setValueAtTime(frequency, now);
    resonance.frequency.exponentialRampToValueAtTime(frequency * (mode === "click" ? 0.92 : 1.06), now + duration);
    resonanceGain.gain.setValueAtTime(0.0001, now);
    resonanceGain.gain.exponentialRampToValueAtTime(0.008, now + 0.04);
    resonanceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.1);
    panner.pan.value = ((variant % 3) - 1) * 0.16;

    scrape.connect(roughFilter);
    scrape.connect(steelFilter);
    roughFilter.connect(roughGain);
    steelFilter.connect(steelGain);
    roughGain.connect(panner);
    steelGain.connect(panner);
    resonance.connect(resonanceGain);
    resonanceGain.connect(panner);
    panner.connect(effectsGain);

    scrape.start(now);
    resonance.start(now);
    scrape.stop(now + duration);
    resonance.stop(now + duration + 0.1);
  };

  const playHover = (variant = 0) => playSwordSheen(variant, "hover");
  const playClick = (variant = 0) => playSwordSheen(variant, "click");
  const playWindWhisper = async () => {
    if (!state.effectsEnabled || state.windVolume <= 0) return;
    const nowMs = performance.now();
    if (nowMs - lastClickAt < 90) return;
    lastClickAt = nowMs;
    if (!config.windSrc) return;
    if (!windPlayers.length) {
      for (let index = 0; index < 3; index += 1) {
        const player = new Audio(config.windSrc);
        player.preload = "auto";
        windPlayers.push(player);
      }
    }
    const player = windPlayers[windPlayerIndex % windPlayers.length];
    windPlayerIndex += 1;
    player.pause();
    player.currentTime = 0;
    player.volume = state.windVolume * 0.3;
    await player.play().catch(() => {});
  };
  const playPanelOpen = () => playWindWhisper();

  panelToggle?.addEventListener("click", () => {
    if (!panel) return;
    const willOpen = panel.hidden;
    if (willOpen) {
      panel.hidden = false;
      panel.classList.remove("is-closing");
      panel.classList.add("is-opening");
      window.setTimeout(() => panel.classList.remove("is-opening"), 360);
      playPanelOpen();
    } else {
      panel.classList.remove("is-opening");
      panel.classList.add("is-closing");
      window.setTimeout(() => {
        panel.hidden = true;
        panel.classList.remove("is-closing");
        updateUi();
      }, 220);
    }
    updateUi();
  });
  panelClose?.addEventListener("click", () => {
    if (!panel || panel.hidden) return;
    panel.classList.add("is-closing");
    window.setTimeout(() => {
      panel.hidden = true;
      panel.classList.remove("is-closing");
      updateUi();
    }, 220);
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
  musicVolume?.addEventListener("input", () => {
    state.musicVolume = clamp(Number(musicVolume.value) / 100);
    updateUi();
    save();
  });
  windVolume?.addEventListener("input", () => {
    state.windVolume = clamp(Number(windVolume.value) / 100);
    updateUi();
    save();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("a, button, summary, [role='button'], input[type='range']")) return;
    playWindWhisper();
  }, true);

  document.addEventListener("pointerdown", () => {
    if (state.musicEnabled && musicElement?.paused) startMusic({ fadeIn: true }).catch(() => {});
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.musicEnabled && musicElement?.paused) startMusic({ fadeIn: true }).catch(() => {});
  });
  window.addEventListener("pagehide", persistMusicPosition);

  window.VelkarisAudio = { playPanelOpen, playWindWhisper, state };
  updateUi();

  if (state.musicEnabled) {
    startMusic({ fadeIn: true }).catch(() => {});
    const startOnGesture = async () => {
      window.removeEventListener("pointerdown", startOnGesture);
      window.removeEventListener("keydown", startOnGesture);
      if (!musicNodes.length && musicElement?.paused) await startMusic({ fadeIn: true });
    };
    window.addEventListener("pointerdown", startOnGesture, { once: true });
    window.addEventListener("keydown", startOnGesture, { once: true });
  }
})();
