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
const setTreeOpen = (open) => {
  tree?.classList.toggle("is-collapsed", !open);
  document.querySelectorAll(".tree-branch").forEach((branch) => branch.classList.toggle("is-collapsed", !open));
  document.querySelectorAll(".tree-node").forEach((node) => node.classList.toggle("is-open", open));
};
document.querySelector("[data-tree-expand]")?.addEventListener("click", () => setTreeOpen(true));
document.querySelector("[data-tree-collapse]")?.addEventListener("click", () => setTreeOpen(false));
document.querySelectorAll(".tree-node[data-node]").forEach((node) => {
  node.addEventListener("click", () => {
    node.classList.toggle("is-open");
    tree?.classList.toggle("is-collapsed");
  });
});
document.querySelectorAll("[data-tree-toggle]").forEach((node) => {
  node.addEventListener("click", () => {
    const branch = node.closest(".tree-branch");
    if (!branch?.querySelector("ul")) return;
    branch.classList.toggle("is-collapsed");
    node.classList.toggle("is-open", !branch.classList.contains("is-collapsed"));
  });
});

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
let oscillators = [];
const soundButton = document.querySelector("[data-sound-toggle]");
const stopAmbient = () => {
  oscillators.forEach((oscillator) => oscillator.stop());
  oscillators = [];
  masterGain?.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.6);
  soundButton?.classList.remove("is-active");
  soundButton?.setAttribute("aria-label", "Ativar música ambiente");
};
const startAmbient = async () => {
  audioContext = audioContext || new AudioContext();
  await audioContext.resume();
  masterGain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 740;
  masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  masterGain.gain.exponentialRampToValueAtTime(0.07, audioContext.currentTime + 1.4);
  filter.connect(masterGain);
  masterGain.connect(audioContext.destination);

  [82.41, 123.47, 185.0].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = index === 1 ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = index === 0 ? 0.44 : 0.22;
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start();
    oscillators.push(oscillator);
  });
  soundButton?.classList.add("is-active");
  soundButton?.setAttribute("aria-label", "Desativar música ambiente");
};
soundButton?.addEventListener("click", () => {
  if (oscillators.length) {
    stopAmbient();
  } else {
    startAmbient();
  }
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
