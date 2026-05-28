(() => {
  const drawPedigreeLines = () => {
    const board = document.querySelector("[data-pedigree]");
    const svg = document.querySelector("[data-pedigree-lines]");
    if (!board || !svg) return;

    const boardRect = board.getBoundingClientRect();
    const width = Math.max(board.scrollWidth, board.clientWidth);
    const height = Math.max(board.scrollHeight, board.clientHeight);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.innerHTML = "";

    const point = (rect, xRatio, yRatio) => ({
      x: rect.left - boardRect.left + board.scrollLeft + rect.width * xRatio,
      y: rect.top - boardRect.top + board.scrollTop + rect.height * yRatio,
    });
    const makePath = (className, d) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", className);
      path.setAttribute("d", d);
      svg.appendChild(path);
    };

    board.querySelectorAll("[data-pedigree-couple]").forEach((couple) => {
      const nodes = [...couple.querySelectorAll(":scope > .tree-node")];
      if (nodes.length > 1) {
        const first = point(nodes[0].getBoundingClientRect(), 1, 0.42);
        const last = point(nodes[nodes.length - 1].getBoundingClientRect(), 0, 0.42);
        makePath("spouse-line", `M ${first.x} ${first.y} L ${last.x} ${last.y}`);
      }

      const children = couple.parentElement?.querySelector(":scope > [data-pedigree-children]");
      const visibleChildren = children && getComputedStyle(children).display !== "none" ? [...children.children] : [];
      if (!visibleChildren.length) return;

      const parent = point(couple.getBoundingClientRect(), 0.5, 1);
      const childTops = visibleChildren
        .map((child) => {
          const childCouple = child.querySelector(":scope > [data-pedigree-couple]");
          const anchorNode = child.querySelector(":scope > [data-pedigree-couple] > .tree-node.is-line-anchor") || childCouple;
          return anchorNode ? point(anchorNode.getBoundingClientRect(), 0.5, 0) : null;
        })
        .filter(Boolean);
      if (!childTops.length) return;

      const junctionY = parent.y + Math.min(46, Math.max(28, (Math.min(...childTops.map((child) => child.y)) - parent.y) * 0.52));
      makePath("descent-line", `M ${parent.x} ${parent.y} L ${parent.x} ${junctionY}`);
      if (childTops.length > 1) {
        makePath("descent-line", `M ${Math.min(...childTops.map((child) => child.x))} ${junctionY} L ${Math.max(...childTops.map((child) => child.x))} ${junctionY}`);
      }
      childTops.forEach((child) => makePath("descent-line", `M ${child.x} ${junctionY} L ${child.x} ${child.y}`));
    });
  };

  const schedulePedigreeDraw = () => requestAnimationFrame(drawPedigreeLines);
  window.addEventListener("load", schedulePedigreeDraw);
  window.addEventListener("resize", schedulePedigreeDraw);
  window.addEventListener("scroll", schedulePedigreeDraw, { passive: true });
  document.fonts?.ready.then(drawPedigreeLines);
  document.querySelectorAll("[data-pedigree] img").forEach((image) => {
    if (!image.complete) image.addEventListener("load", schedulePedigreeDraw, { once: true });
  });
  document.querySelector("[data-pedigree]")?.addEventListener("scroll", schedulePedigreeDraw, { passive: true });
  document.querySelectorAll("[data-tree-toggle], [data-tree-expand], [data-tree-collapse]").forEach((control) => {
    control.addEventListener("click", () => setTimeout(drawPedigreeLines, 80));
  });

  let audioContext;
  let masterGain;
  let ambientNodes = [];
  let hoverSoundReady = false;
  const originalButton = document.querySelector("[data-sound-toggle]");
  const soundButton = originalButton?.cloneNode(true);
  originalButton?.replaceWith(soundButton);

  const ensureAudioContext = async () => {
    audioContext = audioContext || new AudioContext();
    if (audioContext.state !== "running") await audioContext.resume();
    return audioContext;
  };
  const stopAmbient = () => {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    masterGain?.gain.cancelScheduledValues(now);
    masterGain?.gain.linearRampToValueAtTime(0.0001, now + 0.8);
    ambientNodes.forEach((node) => {
      try {
        node.stop?.(now + 1);
      } catch (error) {
        // Filters and gain nodes do not expose stop().
      }
      node.disconnect?.();
    });
    ambientNodes = [];
    soundButton?.classList.remove("is-active");
    soundButton?.setAttribute("aria-label", "Ativar música ambiente");
  };
  const startAmbient = async () => {
    await ensureAudioContext();
    stopAmbient();
    const now = audioContext.currentTime;
    masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.095, now + 1.8);
    masterGain.connect(audioContext.destination);

    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(720, now);
    const windGain = audioContext.createGain();
    windGain.gain.value = 0.18;
    const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 3, audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = (Math.random() * 2 - 1) * 0.42;
    const wind = audioContext.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;
    wind.connect(filter);
    filter.connect(windGain);
    windGain.connect(masterGain);
    wind.start();
    ambientNodes.push(wind, filter, windGain);

    [55, 82.41, 110, 164.81].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = index % 2 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 3 - 4;
      gain.gain.value = index === 0 ? 0.18 : 0.08;
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start();
      ambientNodes.push(oscillator, gain);
    });

    const chime = () => {
      if (!ambientNodes.length || !audioContext) return;
      const start = audioContext.currentTime + Math.random() * 0.9;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.setValueAtTime([440, 554.37, 659.25, 880][Math.floor(Math.random() * 4)], start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.035, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
      oscillator.connect(gain);
      gain.connect(masterGain);
      oscillator.start(start);
      oscillator.stop(start + 1.25);
      setTimeout(chime, 5200 + Math.random() * 6400);
    };
    setTimeout(chime, 1800);
    hoverSoundReady = true;
    soundButton?.classList.add("is-active");
    soundButton?.setAttribute("aria-label", "Desativar música ambiente");
  };
  const playHoverTone = async (variant = 0) => {
    if (!hoverSoundReady || !audioContext) return;
    await ensureAudioContext();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscillator = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    oscillator.type = variant % 2 ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime([523.25, 659.25, 783.99, 987.77][variant % 4], now);
    oscillator.frequency.exponentialRampToValueAtTime([659.25, 783.99, 987.77, 1174.66][variant % 4], now + 0.16);
    filter.type = "bandpass";
    filter.frequency.value = 1200 + variant * 180;
    filter.Q.value = 7;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  };

  soundButton?.addEventListener("click", () => {
    if (ambientNodes.length) stopAmbient();
    else startAmbient();
  });
  document.querySelectorAll(".member-card, .mini-card, .tree-node, .territory-list article, .gallery-grid figure").forEach((element, index) => {
    element.addEventListener("pointerenter", () => playHoverTone(index), { passive: true });
  });
})();
