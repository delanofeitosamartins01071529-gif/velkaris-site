const root = document.documentElement;
root.classList.add("js");

const loader = document.querySelector("[data-loader]");
let introFinished = false;
const finishIntro = () => {
  if (introFinished) return;
  introFinished = true;
  setTimeout(() => document.body.classList.add("is-loaded"), 360);
  setTimeout(() => loader?.remove(), 1180);
};
if (document.readyState === "complete") {
  finishIntro();
} else {
  window.addEventListener("load", finishIntro, { once: true });
}

const header = document.querySelector("[data-header]");
const onScrollHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 32);
};
onScrollHeader();
window.addEventListener("scroll", onScrollHeader, { passive: true });

const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
navToggle?.addEventListener("click", () => {
  const open = !nav?.classList.contains("is-open");
  nav?.classList.toggle("is-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

const cursor = document.querySelector("[data-cursor]");
let cursorFrame = 0;
let cursorX = 0;
let cursorY = 0;
window.addEventListener("pointermove", (event) => {
  if (!cursor) return;
  cursorX = event.clientX;
  cursorY = event.clientY;
  if (cursorFrame) return;
  cursorFrame = requestAnimationFrame(() => {
    cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
    cursorFrame = 0;
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
);
document.querySelectorAll("[data-reveal]").forEach((element) => revealObserver.observe(element));

const hero = document.querySelector("[data-hero]");
const heroArt = document.querySelector(".hero-art");
window.addEventListener(
  "scroll",
  () => {
    if (!hero || !heroArt) return;
    const progress = Math.min(window.scrollY / Math.max(hero.offsetHeight, 1), 1);
    heroArt.style.transform = `translate3d(0, ${progress * 34}px, 0) scale(${1.05 + progress * 0.04})`;
  },
  { passive: true }
);

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    document.querySelectorAll("[data-member-card]").forEach((card) => {
      const visible = filter === "all" || card.dataset.generation === filter;
      card.classList.toggle("is-filtered", !visible);
    });
  });
});

const openMemberModal = (memberId) => {
  const escapedId = window.CSS?.escape ? CSS.escape(memberId) : memberId.replace(/"/g, '\\"');
  const modal = document.querySelector(`[data-member-modal="${escapedId}"]`);
  if (!modal) return;
  if (typeof modal.showModal === "function") {
    modal.showModal();
  } else {
    modal.setAttribute("open", "");
  }
  document.body.classList.add("modal-open");
};

const closeMemberModal = (modal) => {
  if (!modal) return;
  if (typeof modal.close === "function") {
    modal.close();
  } else {
    modal.removeAttribute("open");
  }
  document.body.classList.remove("modal-open");
};

document.querySelectorAll("[data-member-open]").forEach((card) => {
  card.addEventListener("click", () => openMemberModal(card.dataset.memberOpen));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMemberModal(card.dataset.memberOpen);
    }
  });
});

document.querySelectorAll("[data-stop-modal]").forEach((link) => {
  link.addEventListener("click", (event) => event.stopPropagation());
});

document.querySelectorAll("[data-member-close]").forEach((button) => {
  button.addEventListener("click", () => closeMemberModal(button.closest("dialog")));
});

document.querySelectorAll(".member-modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeMemberModal(modal);
  });
  modal.addEventListener("close", () => document.body.classList.remove("modal-open"));
});

document.querySelectorAll(".member-card, .mini-card").forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--tilt-x", `${(-y * 4).toFixed(2)}deg`);
    card.style.setProperty("--tilt-y", `${(x * 4).toFixed(2)}deg`);
  });
  card.addEventListener("pointerleave", () => {
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
  });
});

const syncDeathCause = (select) => {
  const form = select.closest("form");
  const field = form?.querySelector("[data-death-cause]");
  if (!field) return;
  const shouldShow = select.value === "Morto";
  field.classList.toggle("is-hidden", !shouldShow);
  const input = field.querySelector("input, textarea");
  if (input) {
    input.disabled = !shouldShow;
    if (!shouldShow) input.value = "";
  }
};

document.querySelectorAll("[data-status-select]").forEach((select) => {
  syncDeathCause(select);
  select.addEventListener("change", () => syncDeathCause(select));
});

const tree = document.querySelector("[data-tree]");
const pedigreeBoard = document.querySelector("[data-pedigree]");
const familyTreeCanvas = pedigreeBoard?.querySelector(".family-tree");
let pedigreeScale = 1;
let hasUserMovedPedigree = false;

const schedulePedigreeDraw = () => requestAnimationFrame(drawPedigreeLines);

const setTreeOpen = (open) => {
  tree?.classList.toggle("is-collapsed", !open);
  document.querySelectorAll(".tree-branch").forEach((branch) => branch.classList.toggle("is-collapsed", !open));
  document.querySelectorAll(".tree-node").forEach((node) => node.classList.toggle("is-open", open));
  document.querySelectorAll("[data-tree-toggle]").forEach((control) => control.classList.toggle("is-open", open));
};
document.querySelector("[data-tree-expand]")?.addEventListener("click", () => setTreeOpen(true));
document.querySelector("[data-tree-collapse]")?.addEventListener("click", () => setTreeOpen(false));
document.querySelectorAll("[data-tree-toggle]").forEach((node) => {
  node.addEventListener("click", () => {
    const branch = node.closest(".tree-branch");
    if (!branch?.querySelector("ul")) return;
    branch.classList.toggle("is-collapsed");
    node.classList.toggle("is-open", !branch.classList.contains("is-collapsed"));
    node.setAttribute("aria-expanded", String(!branch.classList.contains("is-collapsed")));
    schedulePedigreeDraw();
  });
});

const setPedigreeScale = (nextScale, shouldCenter = false) => {
  pedigreeScale = Math.min(1.35, Math.max(0.62, Number(nextScale) || 1));
  pedigreeBoard?.style.setProperty("--tree-scale", pedigreeScale.toFixed(2));
  const label = document.querySelector("[data-tree-zoom-reset]");
  if (label) label.textContent = `${Math.round(pedigreeScale * 100)}%`;
  if (shouldCenter) requestAnimationFrame(() => centerPedigree(false));
  schedulePedigreeDraw();
};

const centerPedigree = (smooth = true) => {
  if (!pedigreeBoard || !familyTreeCanvas) return;
  const left = Math.max(0, (pedigreeBoard.scrollWidth - pedigreeBoard.clientWidth) / 2);
  const top = Math.max(0, Math.min(pedigreeBoard.scrollTop, pedigreeBoard.scrollHeight - pedigreeBoard.clientHeight));
  pedigreeBoard.scrollTo({ left, top, behavior: smooth ? "smooth" : "auto" });
  schedulePedigreeDraw();
};

document.querySelector("[data-tree-zoom-out]")?.addEventListener("click", () => setPedigreeScale(pedigreeScale - 0.1, true));
document.querySelector("[data-tree-zoom-in]")?.addEventListener("click", () => setPedigreeScale(pedigreeScale + 0.1, true));
document.querySelector("[data-tree-zoom-reset]")?.addEventListener("click", () => setPedigreeScale(1, true));
document.querySelector("[data-tree-center]")?.addEventListener("click", () => centerPedigree(true));

if (pedigreeBoard) {
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let isPanning = false;

  pedigreeBoard.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, a, input, select, textarea, label")) return;
    isPanning = true;
    hasUserMovedPedigree = true;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = pedigreeBoard.scrollLeft;
    startTop = pedigreeBoard.scrollTop;
    pedigreeBoard.classList.add("is-panning");
    pedigreeBoard.setPointerCapture?.(event.pointerId);
  });

  pedigreeBoard.addEventListener("pointermove", (event) => {
    if (!isPanning) return;
    event.preventDefault();
    pedigreeBoard.scrollLeft = startLeft - (event.clientX - startX);
    pedigreeBoard.scrollTop = startTop - (event.clientY - startY);
    schedulePedigreeDraw();
  });

  const stopPanning = (event) => {
    if (!isPanning) return;
    isPanning = false;
    pedigreeBoard.classList.remove("is-panning");
    pedigreeBoard.releasePointerCapture?.(event.pointerId);
  };
  pedigreeBoard.addEventListener("pointerup", stopPanning);
  pedigreeBoard.addEventListener("pointercancel", stopPanning);
  pedigreeBoard.addEventListener("wheel", () => {
    hasUserMovedPedigree = true;
  }, { passive: true });
}

const drawPedigreeLines = () => {
  const board = pedigreeBoard;
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

    const coupleRect = couple.getBoundingClientRect();
    const parent = point(coupleRect, 0.5, 1);
    const childTops = visibleChildren.map((child) => {
      const childCouple = child.querySelector(":scope > [data-pedigree-couple]");
      const anchorNode = child.querySelector(":scope > [data-pedigree-couple] > .tree-node.is-line-anchor") || childCouple;
      return anchorNode ? point(anchorNode.getBoundingClientRect(), 0.5, 0) : null;
    }).filter(Boolean);
    if (!childTops.length) return;

    const junctionY = parent.y + Math.min(46, Math.max(28, (Math.min(...childTops.map((child) => child.y)) - parent.y) * 0.52));
    makePath("descent-line", `M ${parent.x} ${parent.y} L ${parent.x} ${junctionY}`);
    if (childTops.length > 1) {
      makePath("descent-line", `M ${Math.min(...childTops.map((child) => child.x))} ${junctionY} L ${Math.max(...childTops.map((child) => child.x))} ${junctionY}`);
    }
    childTops.forEach((child) => makePath("descent-line", `M ${child.x} ${junctionY} L ${child.x} ${child.y}`));
  });
};

window.addEventListener("load", () => {
  if (pedigreeBoard && !hasUserMovedPedigree) centerPedigree(false);
  schedulePedigreeDraw();
});
window.addEventListener("resize", schedulePedigreeDraw);
pedigreeBoard?.addEventListener("scroll", schedulePedigreeDraw, { passive: true });
document.querySelector("[data-tree-expand]")?.addEventListener("click", schedulePedigreeDraw);
document.querySelector("[data-tree-collapse]")?.addEventListener("click", schedulePedigreeDraw);

document.querySelectorAll("[data-preview-input]").forEach((input) => {
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    const card = input.closest(".tree-editor-row, .admin-member-card, .admin-list-card, .admin-card");
    const img = card?.querySelector("[data-preview-target]");
    if (!file || !img) return;
    img.src = URL.createObjectURL(file);
  });
});

const bulkTreeButton = document.querySelector("[data-tree-bulk-save]");
bulkTreeButton?.addEventListener("click", async () => {
  const forms = Array.from(document.querySelectorAll("[data-tree-editor-form]"));
  const status = document.querySelector("[data-tree-bulk-status]");
  const csrf = document.querySelector("#tree-bulk-csrf")?.value;
  if (!forms.length || !csrf) return;

  const payload = new FormData();
  payload.append("csrf_token", csrf);

  forms.forEach((form) => {
    const memberId = form.dataset.memberId;
    if (!memberId) return;
    payload.append("member_ids", memberId);
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      if (!field.name || field.name === "csrf_token") return;
      const key = `${memberId}__${field.name}`;
      if (field.type === "file") {
        if (field.files?.[0]) payload.append(key, field.files[0]);
        return;
      }
      if (field.type === "checkbox") {
        if (field.checked) payload.append(key, field.value || "on");
        return;
      }
      payload.append(key, field.value);
    });
  });

  bulkTreeButton.disabled = true;
  if (status) status.textContent = "Salvando toda a arvore...";
  try {
    const response = await fetch("/admin/tree/bulk", {
      method: "POST",
      body: payload,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Falha ao salvar");
    const result = await response.json();
    window.location.href = result.redirect || "/admin#arvore";
  } catch (error) {
    bulkTreeButton.disabled = false;
    if (status) status.textContent = "Nao foi possivel salvar tudo. Tente novamente.";
  }
});

const bulkMemberButton = document.querySelector("[data-member-bulk-save]");
bulkMemberButton?.addEventListener("click", async () => {
  const forms = Array.from(document.querySelectorAll("[data-member-editor-form]"));
  const status = document.querySelector("[data-member-bulk-status]");
  const csrf = document.querySelector("#member-bulk-csrf")?.value;
  if (!forms.length || !csrf) return;

  const payload = new FormData();
  payload.append("csrf_token", csrf);

  forms.forEach((form) => {
    const memberId = form.dataset.memberId;
    if (!memberId) return;
    payload.append("member_ids", memberId);
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      if (!field.name || field.name === "csrf_token" || field.disabled) return;
      const key = `${memberId}__${field.name}`;
      if (field.type === "file") {
        if (field.files?.[0]) payload.append(key, field.files[0]);
        return;
      }
      if (field.type === "checkbox") {
        if (field.checked) payload.append(key, field.value || "on");
        return;
      }
      payload.append(key, field.value);
    });
  });

  bulkMemberButton.disabled = true;
  if (status) status.textContent = "Salvando familiares...";
  try {
    const response = await fetch("/admin/members/bulk", {
      method: "POST",
      body: payload,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Falha ao salvar");
    const result = await response.json();
    window.location.href = result.redirect || "/admin#editar-familiares";
  } catch (error) {
    bulkMemberButton.disabled = false;
    if (status) status.textContent = "Nao foi possivel salvar os familiares. Tente novamente.";
  }
});

document.querySelectorAll("[data-territory-target]").forEach((marker) => {
  marker.addEventListener("click", () => {
    const target = marker.dataset.territoryTarget;
    document.querySelectorAll("[data-territory-target]").forEach((item) => item.classList.toggle("is-active", item === marker));
    document.querySelectorAll("[data-territory-card]").forEach((card) => {
      const active = card.dataset.territoryCard === target;
      card.classList.toggle("is-active", active);
      if (active) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  });
});

const reorderList = document.querySelector("[data-reorder-list]");
const reorderValue = document.querySelector("[data-reorder-value]");
const syncReorderValue = () => {
  if (!reorderList || !reorderValue) return;
  reorderValue.value = [...reorderList.querySelectorAll("[data-member-id]")].map((item) => item.dataset.memberId).join(",");
};
if (reorderList) {
  let draggedItem;
  reorderList.addEventListener("dragstart", (event) => {
    draggedItem = event.target.closest("[data-member-id]");
    draggedItem?.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
  });
  reorderList.addEventListener("dragend", () => {
    draggedItem?.classList.remove("is-dragging");
    draggedItem = null;
    syncReorderValue();
  });
  reorderList.addEventListener("dragover", (event) => {
    event.preventDefault();
    const afterElement = [...reorderList.querySelectorAll("[data-member-id]:not(.is-dragging)")].find((item) => {
      const box = item.getBoundingClientRect();
      return event.clientY <= box.top + box.height / 2;
    });
    if (!draggedItem) return;
    if (afterElement) {
      reorderList.insertBefore(draggedItem, afterElement);
    } else {
      reorderList.appendChild(draggedItem);
    }
    syncReorderValue();
  });
}

let audioContext;
let masterGain;
let ambientNodes = [];
let hoverSoundReady = false;
const soundButton = document.querySelector("[data-sound-toggle]");
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
  filter.Q.value = 0.7;

  const windGain = audioContext.createGain();
  windGain.gain.value = 0.18;
  const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 3, audioContext.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseData.length; index += 1) {
    noiseData[index] = (Math.random() * 2 - 1) * 0.42;
  }
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
    gain.gain.value = index === 0 ? 0.18 : 0.08;
    oscillator.detune.value = index * 3 - 4;
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
    oscillator.type = "sine";
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
  if (ambientNodes.length) {
    stopAmbient();
  } else {
    startAmbient();
  }
});

document.querySelectorAll(".member-card, .mini-card, .tree-node, .territory-list article, .gallery-grid figure").forEach((element, index) => {
  element.addEventListener("pointerenter", () => playHoverTone(index), { passive: true });
});

const canvas = document.querySelector("[data-particles]");
const context = canvas?.getContext("2d");
let particles = [];
const resizeParticles = () => {
  if (!canvas || !context) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const count = Math.min(95, Math.floor(window.innerWidth / 18));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.7 + 0.3,
    vx: (Math.random() - 0.5) * 0.15,
    vy: Math.random() * -0.18 - 0.02,
    alpha: Math.random() * 0.55 + 0.12,
    gold: Math.random() > 0.58,
  }));
};
const drawParticles = () => {
  if (!canvas || !context) return;
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.y < -10) particle.y = window.innerHeight + 10;
    if (particle.x < -10) particle.x = window.innerWidth + 10;
    if (particle.x > window.innerWidth + 10) particle.x = -10;
    context.beginPath();
    context.fillStyle = particle.gold
      ? `rgba(202, 163, 91, ${particle.alpha})`
      : `rgba(123, 156, 191, ${particle.alpha * 0.75})`;
    context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    context.fill();
  });
  requestAnimationFrame(drawParticles);
};
resizeParticles();
drawParticles();
window.addEventListener("resize", resizeParticles);
