const root = document.documentElement;
root.classList.add("js");

const loader = document.querySelector("[data-loader]");
const pageTransition = document.querySelector("[data-page-transition]");
let transitionTimer = 0;
const MODAL_MOTION_MS = 640;
const playPageTransition = (duration = MODAL_MOTION_MS) => {
  if (!pageTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.clearTimeout(transitionTimer);
  pageTransition.classList.remove("is-active");
  pageTransition.offsetHeight;
  pageTransition.classList.add("is-active");
  transitionTimer = window.setTimeout(() => pageTransition.classList.remove("is-active"), duration);
};
window.VelkarisTransition = { play: playPageTransition };
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

const cursor = document.querySelector("[data-cursor]");
const finePointer = false;
let syncCursorLayer = () => {};
const cursorTargets = [
  "a",
  "button",
  "summary",
  "label",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[data-member-open]",
  "[data-territory-target]",
  ".portrait-preview-avatar",
  ".member-card",
  ".mini-card",
  ".newspaper-grid figure",
  ".gallery-grid figure",
].join(",");

if (cursor && finePointer) {
  root.classList.add("custom-cursor-enabled");
  const cursorDefaultParent = cursor.parentElement;
  const cursorPosition = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };

  syncCursorLayer = () => {
    const openDialogs = [...document.querySelectorAll("dialog[open]")];
    const topDialog = openDialogs.at(-1);
    const host = topDialog || cursorDefaultParent || document.body;
    if (cursor.parentElement !== host) {
      host.appendChild(cursor);
      cursor.style.transform = `translate3d(${cursorPosition.x}px, ${cursorPosition.y}px, 0) translate(-50%, -50%)`;
    }
  };

  window.addEventListener("pointermove", (event) => {
    cursorPosition.x = event.clientX;
    cursorPosition.y = event.clientY;
    cursor.style.transform = `translate3d(${cursorPosition.x}px, ${cursorPosition.y}px, 0) translate(-50%, -50%)`;
    cursor.classList.add("is-visible");
    cursor.classList.toggle("is-hovering", Boolean(event.target.closest(cursorTargets)));
  });

  window.addEventListener("pointerdown", () => cursor.classList.add("is-pressing"));
  window.addEventListener("pointerup", () => cursor.classList.remove("is-pressing"));
  document.addEventListener("pointerleave", () => cursor.classList.add("is-hidden"));
  document.addEventListener("pointerenter", () => cursor.classList.remove("is-hidden"));
  document.addEventListener("click", (event) => {
    const burst = document.createElement("span");
    burst.className = "cursor-click-burst";
    burst.style.left = `${event.clientX}px`;
    burst.style.top = `${event.clientY}px`;
    (cursor.parentElement || document.body).appendChild(burst);
    burst.addEventListener("animationend", () => burst.remove(), { once: true });
    window.setTimeout(() => burst.remove(), 900);
    requestAnimationFrame(syncCursorLayer);
  }, true);
  document.addEventListener("close", () => requestAnimationFrame(syncCursorLayer), true);
  new MutationObserver(syncCursorLayer).observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: ["open"],
  });
}

const openDialogWithMotion = (dialog) => {
  if (!dialog) return;
  dialog.classList.remove("is-closing");
  if (!dialog.open) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  dialog.classList.remove("is-opening");
  dialog.offsetHeight;
  dialog.classList.add("is-opening");
  window.setTimeout(() => dialog.classList.remove("is-opening"), MODAL_MOTION_MS);
  document.body.classList.add("modal-open");
  requestAnimationFrame(syncCursorLayer);
};

const closeDialogWithMotion = (dialog) => {
  if (!dialog || !dialog.open || dialog.classList.contains("is-closing")) return;
  dialog.classList.remove("is-opening");
  dialog.classList.add("is-closing");
  window.setTimeout(() => {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    dialog.classList.remove("is-closing");
    document.body.classList.remove("modal-open");
    requestAnimationFrame(syncCursorLayer);
  }, MODAL_MOTION_MS);
};

window.VelkarisModalMotion = { open: openDialogWithMotion, close: closeDialogWithMotion };

const hydrateLazyImages = (rootNode) => {
  rootNode?.querySelectorAll("img[data-lazy-src]").forEach((image) => {
    const src = image.dataset.lazySrc;
    if (!src || image.getAttribute("src") === src) return;
    image.setAttribute("src", src);
  });
};

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialogWithMotion(dialog);
  });
});

const portraitsSection = document.querySelector("[data-portraits-section]");
const portraitsContent = document.querySelector("[data-portraits-content]");
const portraitsToggle = document.querySelector("[data-portraits-toggle]");
const portraitsToggleLabel = document.querySelector("[data-portraits-toggle-label]");
let isPortraitsExpanded = false;
let portraitsAnimation = null;

const clearPortraitAnimationStyles = () => {
  if (!portraitsContent) return;
  portraitsContent.style.height = "";
  portraitsContent.style.opacity = "";
  portraitsContent.style.transform = "";
  portraitsContent.style.overflow = "";
};

const setPortraitsExpanded = (expanded, animate = true) => {
  if (!portraitsSection || !portraitsContent || !portraitsToggle) return;
  if (portraitsAnimation) portraitsAnimation.cancel();
  isPortraitsExpanded = expanded;
  if (expanded) {
    window.VelkarisAudio?.playPanelOpen?.();
  }
  portraitsToggle.setAttribute("aria-expanded", String(expanded));
  portraitsToggleLabel && (portraitsToggleLabel.textContent = expanded ? "Recolher retratos" : "Expandir retratos");
  portraitsSection.classList.toggle("is-expanded", expanded);
  portraitsSection.classList.toggle("is-collapsed", !expanded);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (expanded) portraitsContent.hidden = false;
  if (!animate || reduceMotion || typeof portraitsContent.animate !== "function") {
    portraitsContent.hidden = !expanded;
    clearPortraitAnimationStyles();
    return;
  }

  const startHeight = expanded ? 0 : portraitsContent.scrollHeight;
  const endHeight = expanded ? portraitsContent.scrollHeight : 0;
  portraitsContent.style.overflow = "hidden";
  portraitsContent.style.height = `${startHeight}px`;
  portraitsContent.style.opacity = expanded ? "0" : "1";
  portraitsContent.style.transform = expanded ? "translateY(-10px)" : "translateY(0)";
  portraitsContent.offsetHeight;

  const animation = portraitsContent.animate(
    [
      { height: `${startHeight}px`, opacity: expanded ? 0 : 1, transform: expanded ? "translateY(-10px)" : "translateY(0)" },
      { height: `${endHeight}px`, opacity: expanded ? 1 : 0, transform: expanded ? "translateY(0)" : "translateY(-8px)" },
    ],
    {
      duration: expanded ? 540 : 360,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "forwards",
    }
  );
  portraitsAnimation = animation;
  animation.onfinish = () => {
    if (portraitsAnimation !== animation) return;
    portraitsContent.hidden = !expanded;
    animation.cancel();
    portraitsAnimation = null;
    clearPortraitAnimationStyles();
  };
  animation.oncancel = () => {
    if (portraitsAnimation === animation) portraitsAnimation = null;
  };
};

portraitsToggle?.addEventListener("click", () => {
  setPortraitsExpanded(!isPortraitsExpanded);
});

const openMemberModal = (memberId) => {
  const escapedId = window.CSS?.escape ? CSS.escape(memberId) : memberId.replace(/"/g, '\\"');
  const modal = document.querySelector(`[data-member-modal="${escapedId}"]`);
  if (!modal) return;
  hydrateLazyImages(modal);
  openDialogWithMotion(modal);
  fitMemberModalPortrait(modal);
  window.VelkarisAudio?.playPanelOpen?.();
  requestAnimationFrame(() => {
    fitMemberModalPortrait(modal);
    modal.scrollTop = 0;
    syncCursorLayer?.();
  });
};

const closeMemberModal = (modal) => {
  closeDialogWithMotion(modal);
};

const fitMemberModalPortrait = (modal) => {
  const shell = modal?.querySelector(".member-modal-shell");
  const image = modal?.querySelector(".member-modal-portrait img");
  if (!shell || !image) return;

  const applyWidth = () => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const shellHeight = shell.getBoundingClientRect().height;
    if (!shellHeight) return;

    const ratio = image.naturalWidth / image.naturalHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1200;
    const minWidth = Math.min(300, viewportWidth - 32);
    const maxWidth = Math.min(560, viewportWidth * 0.48);
    const portraitWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(shellHeight * ratio)));
    shell.style.setProperty("--member-portrait-width", `${portraitWidth}px`);
  };

  if (image.complete) {
    applyWidth();
  } else {
    image.addEventListener("load", applyWidth, { once: true });
  }
};

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-stop-modal]")) return;
  const trigger = event.target.closest("[data-member-open]");
  if (!trigger) return;
  event.preventDefault();
  openMemberModal(trigger.dataset.memberOpen);
});

document.addEventListener("keydown", (event) => {
  const trigger = event.target.closest?.("[data-member-open]");
  if (!trigger || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  openMemberModal(trigger.dataset.memberOpen);
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

window.addEventListener("resize", () => {
  document.querySelectorAll(".member-modal[open]").forEach(fitMemberModalPortrait);
});

const galleryModal = document.querySelector("[data-gallery-modal]");
const closeGalleryModal = () => {
  closeDialogWithMotion(galleryModal);
};
const openGalleryModal = (figure) => {
  if (!galleryModal || !figure) return;
  const source = figure.querySelector("img");
  const image = galleryModal.querySelector("[data-gallery-modal-image]");
  const caption = galleryModal.querySelector("[data-gallery-modal-caption]");
  if (!source || !image || !caption) return;
  image.src = source.src;
  image.alt = source.alt;
  caption.textContent = figure.querySelector("figcaption")?.textContent || source.alt;
  openDialogWithMotion(galleryModal);
  window.VelkarisAudio?.playPanelOpen?.();
};
document.querySelectorAll("[data-gallery-open]").forEach((figure) => {
  figure.addEventListener("click", () => openGalleryModal(figure));
  figure.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openGalleryModal(figure);
  });
});
document.querySelector("[data-gallery-close]")?.addEventListener("click", closeGalleryModal);
galleryModal?.addEventListener("click", (event) => {
  if (event.target === galleryModal) closeGalleryModal();
});
galleryModal?.addEventListener("close", () => document.body.classList.remove("modal-open"));

const gallerySection = document.querySelector("[data-gallery-section]");
const galleryRecords = document.querySelector("[data-gallery-records]");
const galleryToggle = document.querySelector("[data-gallery-toggle]");
const galleryToggleLabel = document.querySelector("[data-gallery-toggle-label]");
let isGalleryExpanded = false;
let galleryAnimation = null;

const clearGalleryAnimationStyles = () => {
  if (!galleryRecords) return;
  galleryRecords.style.height = "";
  galleryRecords.style.opacity = "";
  galleryRecords.style.transform = "";
  galleryRecords.style.overflow = "";
};

const setGalleryExpanded = (expanded, animate = true) => {
  if (!gallerySection || !galleryRecords || !galleryToggle) return;
  if (galleryAnimation) galleryAnimation.cancel();
  isGalleryExpanded = expanded;
  if (expanded) window.VelkarisAudio?.playPanelOpen?.();
  galleryToggle.setAttribute("aria-expanded", String(expanded));
  if (galleryToggleLabel) galleryToggleLabel.textContent = expanded ? "Recolher galeria" : "Expandir galeria";
  gallerySection.classList.toggle("is-expanded", expanded);
  gallerySection.classList.toggle("is-collapsed", !expanded);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (expanded) galleryRecords.hidden = false;
  if (!animate || reduceMotion || typeof galleryRecords.animate !== "function") {
    galleryRecords.hidden = !expanded;
    clearGalleryAnimationStyles();
    return;
  }

  const startHeight = expanded ? 0 : galleryRecords.scrollHeight;
  const endHeight = expanded ? galleryRecords.scrollHeight : 0;
  galleryRecords.style.overflow = "hidden";
  galleryRecords.style.height = `${startHeight}px`;
  galleryRecords.style.opacity = expanded ? "0" : "1";
  galleryRecords.style.transform = expanded ? "translateY(-10px)" : "translateY(0)";
  galleryRecords.offsetHeight;

  const animation = galleryRecords.animate(
    [
      { height: `${startHeight}px`, opacity: expanded ? 0 : 1, transform: expanded ? "translateY(-10px)" : "translateY(0)" },
      { height: `${endHeight}px`, opacity: expanded ? 1 : 0, transform: expanded ? "translateY(0)" : "translateY(-8px)" },
    ],
    {
      duration: expanded ? 540 : 360,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "forwards",
    }
  );
  galleryAnimation = animation;
  animation.onfinish = () => {
    if (galleryAnimation !== animation) return;
    galleryRecords.hidden = !expanded;
    animation.cancel();
    galleryAnimation = null;
    clearGalleryAnimationStyles();
  };
  animation.oncancel = () => {
    if (galleryAnimation === animation) galleryAnimation = null;
  };
};

galleryToggle?.addEventListener("click", () => setGalleryExpanded(!isGalleryExpanded));

const newspaperModal = document.querySelector("[data-newspaper-modal]");
const newspaperImage = newspaperModal?.querySelector("[data-newspaper-modal-image]");
const newspaperReader = newspaperModal?.querySelector("[data-newspaper-reader]");
const newspaperZoomLabel = newspaperModal?.querySelector("[data-newspaper-zoom-reset]");
let newspaperZoom = 1;

const getNewspaperBaseWidth = () => newspaperImage?.naturalWidth || newspaperImage?.clientWidth || 1;

const setNewspaperZoom = (zoom, originX, originY) => {
  const oldZoom = newspaperZoom;
  const nextZoom = Math.min(3, Math.max(0.6, zoom));
  const readerX = originX ?? (newspaperReader?.clientWidth || 0) / 2;
  const readerY = originY ?? (newspaperReader?.clientHeight || 0) / 2;
  const oldBaseWidth = getNewspaperBaseWidth() * oldZoom;
  const worldX = ((newspaperReader?.scrollLeft || 0) + readerX) / Math.max(1, oldBaseWidth);
  const worldY = ((newspaperReader?.scrollTop || 0) + readerY) / Math.max(1, oldBaseWidth);
  newspaperZoom = nextZoom;
  const nextWidth = getNewspaperBaseWidth() * newspaperZoom;
  if (newspaperImage) newspaperImage.style.width = `${nextWidth}px`;
  if (newspaperZoomLabel) newspaperZoomLabel.textContent = `${Math.round(newspaperZoom * 100)}%`;
  if (newspaperReader) {
    newspaperReader.scrollLeft = worldX * nextWidth - readerX;
    newspaperReader.scrollTop = worldY * nextWidth - readerY;
  }
};
const resetNewspaperView = () => {
  setNewspaperZoom(1);
  if (!newspaperReader) return;
  newspaperReader.scrollTop = 0;
  newspaperReader.scrollLeft = 0;
};
const closeNewspaperModal = () => closeDialogWithMotion(newspaperModal);
const openNewspaperModal = (figure) => {
  if (!newspaperModal || !newspaperImage || !figure) return;
  const source = figure.querySelector("img");
  if (!source) return;
  newspaperImage.src = source.src;
  newspaperImage.alt = source.alt;
  newspaperModal.querySelector("[data-newspaper-modal-title]").textContent = figure.dataset.title || source.alt;
  newspaperModal.querySelector("[data-newspaper-modal-meta]").textContent = figure.dataset.meta || "";
  newspaperModal.querySelector("[data-newspaper-modal-description]").textContent = figure.dataset.description || "";
  if (newspaperImage.complete) resetNewspaperView();
  else newspaperImage.addEventListener("load", resetNewspaperView, { once: true });
  openDialogWithMotion(newspaperModal);
  window.VelkarisAudio?.playPanelOpen?.();
};
document.querySelectorAll("[data-newspaper-open]").forEach((figure) => {
  figure.addEventListener("click", () => openNewspaperModal(figure));
  figure.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openNewspaperModal(figure);
  });
});
document.querySelector("[data-newspaper-close]")?.addEventListener("click", closeNewspaperModal);
document.querySelector("[data-newspaper-zoom-out]")?.addEventListener("click", () => setNewspaperZoom(newspaperZoom - 0.2));
document.querySelector("[data-newspaper-zoom-reset]")?.addEventListener("click", resetNewspaperView);
document.querySelector("[data-newspaper-zoom-in]")?.addEventListener("click", () => setNewspaperZoom(newspaperZoom + 0.2));
if (newspaperReader) {
  let isPanningNewspaper = false;
  let newspaperPointerX = 0;
  let newspaperPointerY = 0;
  let newspaperScrollLeft = 0;
  let newspaperScrollTop = 0;

  newspaperReader.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    isPanningNewspaper = true;
    newspaperPointerX = event.clientX;
    newspaperPointerY = event.clientY;
    newspaperScrollLeft = newspaperReader.scrollLeft;
    newspaperScrollTop = newspaperReader.scrollTop;
    newspaperReader.classList.add("is-panning");
    newspaperReader.setPointerCapture?.(event.pointerId);
  });

  newspaperReader.addEventListener("pointermove", (event) => {
    if (!isPanningNewspaper) return;
    event.preventDefault();
    newspaperReader.scrollLeft = newspaperScrollLeft - (event.clientX - newspaperPointerX);
    newspaperReader.scrollTop = newspaperScrollTop - (event.clientY - newspaperPointerY);
  });

  const stopNewspaperPanning = (event) => {
    if (!isPanningNewspaper) return;
    isPanningNewspaper = false;
    newspaperReader.classList.remove("is-panning");
    newspaperReader.releasePointerCapture?.(event.pointerId);
  };
  newspaperReader.addEventListener("pointerup", stopNewspaperPanning);
  newspaperReader.addEventListener("pointercancel", stopNewspaperPanning);
}
newspaperModal?.addEventListener("click", (event) => {
  if (event.target === newspaperModal) closeNewspaperModal();
});
newspaperModal?.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  resetNewspaperView();
});

const timelineSection = document.querySelector("[data-timeline-section]");
const timelineRecords = document.querySelector("[data-timeline-records]");
const timelineOverview = document.querySelector("[data-timeline-overview]");
const timelineToggle = document.querySelector("[data-timeline-toggle]");
const timelineToggleLabel = document.querySelector("[data-timeline-toggle-label]");
let isTimelineExpanded = false;
let timelineAnimation = null;
let timelineItemAnimations = [];

const clearTimelineAnimationStyles = () => {
  if (!timelineRecords) return;
  timelineRecords.style.height = "";
  timelineRecords.style.opacity = "";
  timelineRecords.style.transform = "";
  timelineRecords.style.overflow = "";
  timelineItemAnimations.forEach((animation) => animation.cancel());
  timelineItemAnimations = [];
};

const setTimelineExpanded = (expanded, animate = true) => {
  if (!timelineSection || !timelineRecords || !timelineOverview || !timelineToggle) return;
  if (timelineAnimation) timelineAnimation.cancel();
  timelineItemAnimations.forEach((animation) => animation.cancel());
  timelineItemAnimations = [];
  isTimelineExpanded = expanded;
  if (expanded) window.VelkarisAudio?.playPanelOpen?.();
  timelineToggle.setAttribute("aria-expanded", String(expanded));
  if (timelineToggleLabel) timelineToggleLabel.textContent = expanded ? "Recolher crônicas" : "Expandir crônicas";
  timelineSection.classList.toggle("is-expanded", expanded);
  timelineSection.classList.toggle("is-collapsed", !expanded);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (expanded) timelineRecords.hidden = false;
  if (!animate || reduceMotion || typeof timelineRecords.animate !== "function") {
    timelineRecords.hidden = !expanded;
    clearTimelineAnimationStyles();
    return;
  }

  const items = [...timelineRecords.querySelectorAll(".timeline-item")];
  const totalDuration = MODAL_MOTION_MS;
  const itemDuration = Math.min(920, Math.max(520, totalDuration * 0.46));
  const itemDelay = items.length > 1 ? Math.max(28, (totalDuration - itemDuration) / (items.length - 1)) : 0;
  timelineSection.classList.remove("is-transitioning");
  timelineSection.offsetHeight;
  timelineSection.classList.add("is-transitioning");

  const animation = timelineRecords.animate(
    [
      { opacity: expanded ? 0.7 : 1 },
      { opacity: expanded ? 1 : 0.7 },
    ],
    {
      duration: totalDuration,
      easing: "ease",
      fill: "forwards",
    }
  );
  timelineItemAnimations = items.map((item, index) => {
    const sequenceIndex = expanded ? index : items.length - index - 1;
    return item.animate(
      expanded
        ? [
            { opacity: 0, transform: "translateY(-34px)", filter: "brightness(1.32) blur(2px)" },
            { opacity: 1, transform: "translateY(0)", filter: "brightness(1) blur(0)" },
          ]
        : [
            { opacity: 1, transform: "translateY(0)", filter: "brightness(1) blur(0)" },
            { opacity: 0, transform: "translateY(-30px)", filter: "brightness(1.28) blur(2px)" },
          ],
      {
        duration: itemDuration,
        delay: sequenceIndex * itemDelay,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "both",
      }
    );
  });
  timelineAnimation = animation;
  animation.onfinish = () => {
    if (timelineAnimation !== animation) return;
    timelineRecords.hidden = !expanded;
    animation.cancel();
    timelineAnimation = null;
    clearTimelineAnimationStyles();
    window.setTimeout(() => timelineSection.classList.remove("is-transitioning"), 220);
  };
  animation.oncancel = () => {
    if (timelineAnimation === animation) timelineAnimation = null;
  };
};

timelineToggle?.addEventListener("click", () => setTimelineExpanded(!isTimelineExpanded));

const openTimelineModal = (id) => {
  const escapedId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id;
  const modal = document.querySelector(`[data-timeline-modal="${escapedId}"]`);
  if (!modal) return;
  openDialogWithMotion(modal);
  window.VelkarisAudio?.playPanelOpen?.();
};
document.querySelectorAll("[data-timeline-open]").forEach((item) => {
  item.addEventListener("click", () => {
    item.blur();
    openTimelineModal(item.dataset.timelineOpen);
  });
  item.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    item.blur();
    openTimelineModal(item.dataset.timelineOpen);
  });
});
document.querySelectorAll("[data-timeline-close]").forEach((button) => {
  button.addEventListener("click", () => closeDialogWithMotion(button.closest("dialog")));
});
document.querySelectorAll(".timeline-modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeDialogWithMotion(modal);
  });
  modal.addEventListener("close", () => document.body.classList.remove("modal-open"));
});

const strategicModal = document.querySelector("[data-strategic-modal]");
const strategicPanels = [...document.querySelectorAll("[data-strategic-panel]")];
const strategicTabs = [...document.querySelectorAll("[data-strategic-tab]")];
const strategicSections = {
  leaders: ["Arquivo de comando", "Lideranças da Família", "A sucessão de lideranças que conduziram a Casa."],
  fortifications: ["Defesas juramentadas", "Edificações", "Fortalezas, postos de vigia e seus responsáveis."],
  conflicts: ["Memória de batalha", "Confrontos", "Campanhas, cercos e disputas enfrentadas pela família."],
  aristocrats: ["Funções dos Membros", "Funções", "Membros da linhagem e suas funções dentro da Casa."],
  allies: ["Pactos e favores", "Aliados da Casa", "Apoios diretos e indiretos que sustentam o legado."],
  vassals: ["Serviços juramentados", "Vassalos da Casa", "Servos, camponeses e trabalhadores ligados aos domínios da família."],
};

const setStrategicPanel = (key, animate = false) => {
  const section = strategicSections[key] || strategicSections.leaders;
  strategicPanels.forEach((panel) => {
    const isActive = panel.dataset.strategicPanel === key;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  });
  strategicTabs.forEach((tab) => {
    const isActive = tab.dataset.strategicTab === key;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  const title = strategicModal?.querySelector("[data-strategic-title]");
  const description = strategicModal?.querySelector("[data-strategic-description]");
  if (title) title.textContent = section[1];
  if (description) description.textContent = section[2];
  const shell = strategicModal?.querySelector(".strategic-modal-shell");
  if (shell) shell.scrollTop = 0;
  if (animate) {
    window.VelkarisAudio?.playPanelOpen?.();
  }
};

const closeStrategicModal = () => {
  closeDialogWithMotion(strategicModal);
};

const openStrategicModal = (key) => {
  if (!strategicModal) return;
  setStrategicPanel(key);
  if (!strategicModal.open) {
    openDialogWithMotion(strategicModal);
  }
  window.VelkarisAudio?.playPanelOpen?.();
};

document.querySelectorAll("[data-strategic-open]").forEach((button) => {
  button.addEventListener("click", () => openStrategicModal(button.dataset.strategicOpen));
});
strategicTabs.forEach((tab) => {
  tab.addEventListener("click", () => setStrategicPanel(tab.dataset.strategicTab, true));
});
document.querySelector("[data-strategic-close]")?.addEventListener("click", closeStrategicModal);
strategicModal?.addEventListener("click", (event) => {
  if (event.target === strategicModal) closeStrategicModal();
});
strategicModal?.addEventListener("close", () => document.body.classList.remove("modal-open"));

const strategicEntryModal = document.querySelector("[data-strategic-entry-modal]");
const closeStrategicEntryModal = () => closeDialogWithMotion(strategicEntryModal);
const openStrategicEntryModal = (entry) => {
  if (!strategicEntryModal || !entry) return;
  const portrait = strategicEntryModal.querySelector("[data-strategic-entry-modal-portrait]");
  const image = strategicEntryModal.querySelector("[data-strategic-entry-modal-image]");
  const imageUrl = entry.dataset.image || "";
  const entryType = entry.dataset.strategicEntryType || "";
  strategicEntryModal.dataset.strategicEntryType = entryType;
  strategicEntryModal.classList.toggle("is-allies", entryType === "allies");
  image.src = imageUrl;
  image.alt = imageUrl ? `Imagem de ${entry.dataset.name || "registro"}` : "";
  portrait.hidden = !imageUrl;
  strategicEntryModal.querySelector("[data-strategic-entry-modal-kicker]").textContent = entry.dataset.kicker || "Registro reservado";
  strategicEntryModal.querySelector("[data-strategic-entry-modal-name]").textContent = entry.dataset.name || "";
  strategicEntryModal.querySelector("[data-strategic-entry-modal-highlight]").textContent = entry.dataset.highlight || "";
  strategicEntryModal.querySelector("[data-strategic-entry-modal-description]").textContent = entry.dataset.description || "";
  openDialogWithMotion(strategicEntryModal);
  window.VelkarisAudio?.playPanelOpen?.();
};
document.querySelectorAll("[data-strategic-entry-open]").forEach((entry) => {
  entry.addEventListener("click", () => openStrategicEntryModal(entry));
  entry.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openStrategicEntryModal(entry);
  });
});
document.querySelector("[data-strategic-entry-close]")?.addEventListener("click", closeStrategicEntryModal);
strategicEntryModal?.addEventListener("click", (event) => {
  if (event.target === strategicEntryModal) closeStrategicEntryModal();
});
strategicEntryModal?.addEventListener("close", () => {
  document.body.classList.toggle("modal-open", Boolean(strategicModal?.open));
});

document.querySelectorAll("[data-culture-open]").forEach((entry) => {
  const openCultureEntry = () => {
    const modal = document.querySelector(`[data-culture-modal="${entry.dataset.cultureOpen}"]`);
    if (!modal) return;
    hydrateLazyImages(modal);
    openDialogWithMotion(modal);
    window.VelkarisAudio?.playPanelOpen?.();
  };
  entry.addEventListener("click", openCultureEntry);
  entry.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openCultureEntry();
  });
});

document.querySelectorAll("[data-culture-modal]").forEach((modal) => {
  modal.querySelector("[data-culture-close]")?.addEventListener("click", () => closeDialogWithMotion(modal));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeDialogWithMotion(modal);
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
const familyTreeViewport = document.querySelector("[data-family-tree]");
const familyTreeStage = document.querySelector("[data-family-stage]");
const familyTreeNodes = document.querySelector("[data-family-nodes]");
const familyTreeLines = document.querySelector("[data-family-lines]");
const familyTreeDataElement = document.querySelector("#family-tree-data");
const TREE_VIEW_KEY = "velkaris.familyTree.view.v4";
const TREE_MIN_SCALE = 0.24;
const TREE_MAX_SCALE = 2.5;
const TREE_NODE_WIDTH = 142;
const TREE_NODE_HEIGHT = 174;
const TREE_MEMBER_GAP = 18;
const TREE_UNIT_PAD = 10;
const TREE_LEVEL_GAP = 178;
const TREE_SIBLING_GAP = 42;
const TREE_ROOT_GAP = 64;
const TREE_MARGIN = 72;
const TREE_CHILD_JUNCTION_GAP = 54;
let familyTreeData = [];
let familyTreeLayouts = [];
let familyTreePlaced = [];
let familyTreeSize = { width: 0, height: 0 };
let familyTreeView = { x: 0, y: 0, scale: 1 };
let familyTreeUserMoved = false;
let familyTreeFrame = 0;
const collapsedTreeBranches = new Set();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

const loadFamilyTreeData = () => {
  if (!familyTreeDataElement) return [];
  try {
    const parsed = JSON.parse(familyTreeDataElement.textContent || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const branchUnitWidth = (branch) => {
  const count = Math.max(1, branch.members?.length || 1);
  return count * TREE_NODE_WIDTH + Math.max(0, count - 1) * TREE_MEMBER_GAP + TREE_UNIT_PAD * 2;
};

const layoutFamilyBranch = (branch, depth = 0) => {
  const children = collapsedTreeBranches.has(branch.id) ? [] : (branch.children || []);
  const childLayouts = children.map((child) => layoutFamilyBranch(child, depth + 1));
  const childrenWidth = childLayouts.reduce((total, child, index) => total + child.width + (index ? TREE_SIBLING_GAP : 0), 0);
  const unitWidth = branchUnitWidth(branch);
  return {
    branch,
    childLayouts,
    depth,
    unitWidth,
    width: Math.max(unitWidth, childrenWidth || 0),
  };
};

const placeFamilyBranch = (layout, left) => {
  const y = TREE_MARGIN + layout.depth * (TREE_NODE_HEIGHT + TREE_LEVEL_GAP);
  const unitX = left + layout.width / 2 - layout.unitWidth / 2;
  const placed = {
    branch: layout.branch,
    depth: layout.depth,
    unitX,
    unitY: y,
    unitWidth: layout.unitWidth,
    children: [],
  };
  familyTreePlaced.push(placed);

  const childrenWidth = layout.childLayouts.reduce((total, child, index) => total + child.width + (index ? TREE_SIBLING_GAP : 0), 0);
  let childLeft = left + Math.max(0, (layout.width - childrenWidth) / 2);
  layout.childLayouts.forEach((childLayout) => {
    const childPlaced = placeFamilyBranch(childLayout, childLeft);
    placed.children.push(childPlaced);
    childLeft += childLayout.width + TREE_SIBLING_GAP;
  });
  return placed;
};

const buildFamilyTreeLayout = () => {
  familyTreePlaced = [];
  familyTreeLayouts = familyTreeData.map((branch) => layoutFamilyBranch(branch));
  const rootsWidth = familyTreeLayouts.reduce((total, layout, index) => total + layout.width + (index ? TREE_ROOT_GAP : 0), 0);
  let left = TREE_MARGIN;
  familyTreeLayouts.forEach((layout) => {
    placeFamilyBranch(layout, left);
    left += layout.width + TREE_ROOT_GAP;
  });
  const maxDepth = familyTreePlaced.reduce((max, item) => Math.max(max, item.depth), 0);
  familyTreeSize = {
    width: Math.max(rootsWidth + TREE_MARGIN * 2, familyTreeViewport?.clientWidth || 0),
    height: Math.max(TREE_MARGIN * 2 + (maxDepth + 1) * TREE_NODE_HEIGHT + maxDepth * TREE_LEVEL_GAP, familyTreeViewport?.clientHeight || 0),
  };
};

const memberNodePosition = (placed, memberIndex, memberCount) => {
  const totalMembersWidth = memberCount * TREE_NODE_WIDTH + Math.max(0, memberCount - 1) * TREE_MEMBER_GAP;
  const firstX = placed.unitX + (placed.unitWidth - totalMembersWidth) / 2;
  return {
    x: firstX + memberIndex * (TREE_NODE_WIDTH + TREE_MEMBER_GAP),
    y: placed.unitY,
  };
};

const memberCenter = (placed, memberId, fallbackRatio = 0.5, yRatio = 0.5) => {
  const members = placed.branch.members || [];
  const index = members.findIndex((member) => member.id === memberId);
  const safeIndex = index >= 0 ? index : Math.max(0, Math.round((members.length - 1) * fallbackRatio));
  const position = memberNodePosition(placed, safeIndex, Math.max(1, members.length));
  return {
    x: position.x + TREE_NODE_WIDTH * 0.5,
    y: position.y + TREE_NODE_HEIGHT * yRatio,
  };
};

const familyDescentAnchor = (placed) => {
  const members = placed.branch.members || [];
  if (members.length > 1) {
    const first = memberCenter(placed, members[0].id, 0, 0.43);
    const last = memberCenter(placed, members[members.length - 1].id, 1, 0.43);
    return {
      x: (first.x + last.x) / 2,
      y: (first.y + last.y) / 2,
    };
  }
  return {
    x: placed.unitX + placed.unitWidth / 2,
    y: placed.unitY + TREE_NODE_HEIGHT,
  };
};

const drawFamilyTreeLines = () => {
  if (!familyTreeLines) return;
  familyTreeLines.setAttribute("viewBox", `0 0 ${familyTreeSize.width} ${familyTreeSize.height}`);
  familyTreeLines.setAttribute("width", familyTreeSize.width);
  familyTreeLines.setAttribute("height", familyTreeSize.height);
  familyTreeLines.innerHTML = "";

  const makePath = (className, d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", className);
    path.setAttribute("d", d);
    familyTreeLines.appendChild(path);
  };
  const placedById = new Map(familyTreePlaced.map((placed) => [placed.branch.id, placed]));

  familyTreePlaced.forEach((placed) => {
    const members = placed.branch.members || [];
    if (members.length > 1) {
      const first = memberCenter(placed, members[0].id, 0, 0.43);
      const last = memberCenter(placed, members[members.length - 1].id, 1, 0.43);
      makePath("spouse-line", `M ${first.x + TREE_NODE_WIDTH * 0.5} ${first.y} L ${last.x - TREE_NODE_WIDTH * 0.5} ${last.y}`);
    }

    const children = placed.children || [];
    if (!children.length) return;
    const parent = familyDescentAnchor(placed);
    const childTops = children.map((child) => memberCenter(child, child.branch.linkMemberId, 0.5, 0));
    const minChildY = Math.min(...childTops.map((child) => child.y));
    const parentBottom = placed.unitY + TREE_NODE_HEIGHT;
    const junctionY = Math.min(minChildY - 36, Math.max(parentBottom + 36, minChildY - TREE_CHILD_JUNCTION_GAP));
    makePath("descent-line", `M ${parent.x} ${parent.y} L ${parent.x} ${junctionY}`);
    if (childTops.length > 1) {
      makePath("descent-line", `M ${Math.min(...childTops.map((child) => child.x))} ${junctionY} L ${Math.max(...childTops.map((child) => child.x))} ${junctionY}`);
    }
    childTops.forEach((child) => makePath("descent-line", `M ${child.x} ${junctionY} L ${child.x} ${child.y}`));
  });

  familyTreePlaced.forEach((placed) => {
    (placed.branch.secondaryLinks || []).forEach((link) => {
      const parentPlaced = placedById.get(link.parentUnitId);
      if (!parentPlaced || !link.memberId) return;
      if (collapsedTreeBranches.has(parentPlaced.branch.id)) return;
      const parent = familyDescentAnchor(parentPlaced);
      const child = memberCenter(placed, link.memberId, 0.5, 0);
      const parentBottom = parentPlaced.unitY + TREE_NODE_HEIGHT;
      const junctionY = Math.min(child.y - 36, Math.max(parentBottom + 36, child.y - TREE_CHILD_JUNCTION_GAP));
      makePath("secondary-descent-line", `M ${parent.x} ${parent.y} L ${parent.x} ${junctionY} L ${child.x} ${junctionY} L ${child.x} ${child.y}`);
    });
  });
};

const renderFamilyTreeNodes = () => {
  if (!familyTreeNodes) return;
  familyTreeNodes.innerHTML = "";
  familyTreePlaced.forEach((placed) => {
    const members = placed.branch.members || [];
    members.forEach((member, index) => {
      const position = memberNodePosition(placed, index, Math.max(1, members.length));
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tree-node family-tree-node is-open status-${member.statusClass || ""} ${placed.branch.linkMemberId === member.id ? "is-line-anchor" : ""}`;
      button.dataset.memberOpen = member.id;
      button.setAttribute("aria-label", `Abrir registro de ${member.name || "familiar"}`);
      button.style.left = `${position.x}px`;
      button.style.top = `${position.y}px`;
      button.innerHTML = `
        <img src="${escapeHtml(member.image)}" alt="">
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.title)}</span>
        <b class="tree-node-role">${escapeHtml(member.branch || "Casa Velkaris")}</b>
        <small>${escapeHtml(member.generation)} - ${escapeHtml(member.status)}</small>
      `;
      familyTreeNodes.appendChild(button);
    });

    if ((placed.branch.children || []).length) {
      const fold = document.createElement("button");
      fold.type = "button";
      fold.className = `tree-fold ${collapsedTreeBranches.has(placed.branch.id) ? "" : "is-open"}`;
      fold.dataset.treeToggle = placed.branch.id;
      fold.setAttribute("aria-label", "Alternar descendentes");
      fold.setAttribute("aria-expanded", String(!collapsedTreeBranches.has(placed.branch.id)));
      fold.style.left = `${placed.unitX + placed.unitWidth / 2 - 15}px`;
      fold.style.top = `${placed.unitY + TREE_NODE_HEIGHT + 11}px`;
      fold.innerHTML = "<span></span>";
      familyTreeNodes.appendChild(fold);
    }
  });
};

const applyFamilyTreeTransform = () => {
  if (!familyTreeStage || !familyTreeViewport) return;
  const viewport = familyTreeViewport.getBoundingClientRect();
  const scaledWidth = familyTreeSize.width * familyTreeView.scale;
  const scaledHeight = familyTreeSize.height * familyTreeView.scale;
  const slack = 180;
  familyTreeView.x = scaledWidth <= viewport.width
    ? (viewport.width - scaledWidth) / 2
    : clamp(familyTreeView.x, viewport.width - scaledWidth - slack, slack);
  familyTreeView.y = scaledHeight <= viewport.height
    ? (viewport.height - scaledHeight) / 2
    : clamp(familyTreeView.y, viewport.height - scaledHeight - slack, slack);
  familyTreeStage.style.width = `${familyTreeSize.width}px`;
  familyTreeStage.style.height = `${familyTreeSize.height}px`;
  familyTreeStage.style.transform = `translate(${Math.round(familyTreeView.x)}px, ${Math.round(familyTreeView.y)}px) scale(${familyTreeView.scale})`;
  const label = document.querySelector("[data-tree-zoom-reset]");
  if (label) label.textContent = `${Math.round(familyTreeView.scale * 100)}%`;
};

const saveFamilyTreeView = () => {
  try {
    const viewport = familyTreeViewport?.getBoundingClientRect();
    localStorage.setItem(TREE_VIEW_KEY, JSON.stringify({
      ...familyTreeView,
      viewportWidth: viewport?.width || 0,
      viewportHeight: viewport?.height || 0,
    }));
  } catch (error) {
    // Local storage can be blocked in private contexts.
  }
};

const loadFamilyTreeView = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(TREE_VIEW_KEY) || "null");
    if (!saved) return false;
    const viewport = familyTreeViewport?.getBoundingClientRect();
    const savedWidth = Number(saved.viewportWidth) || 0;
    const savedHeight = Number(saved.viewportHeight) || 0;
    if (!viewport || !savedWidth || !savedHeight) return false;
    const widthDelta = Math.abs(savedWidth - viewport.width) / Math.max(viewport.width, 1);
    const heightDelta = Math.abs(savedHeight - viewport.height) / Math.max(viewport.height, 1);
    if (widthDelta > 0.22 || heightDelta > 0.22) return false;
    familyTreeView = {
      x: Number(saved.x) || 0,
      y: Number(saved.y) || 0,
      scale: clamp(Number(saved.scale) || 1, TREE_MIN_SCALE, TREE_MAX_SCALE),
    };
    return true;
  } catch (error) {
    return false;
  }
};

const fitFamilyTree = (shouldSave = true) => {
  if (!familyTreeViewport) return;
  const viewport = familyTreeViewport.getBoundingClientRect();
  const padding = viewport.width < 720 ? 42 : 88;
  const fitScale = Math.min(
    (viewport.width - padding) / Math.max(1, familyTreeSize.width),
    (viewport.height - padding) / Math.max(1, familyTreeSize.height),
    TREE_MAX_SCALE
  );
  familyTreeView.scale = clamp(fitScale, TREE_MIN_SCALE, TREE_MAX_SCALE);
  familyTreeView.x = (viewport.width - familyTreeSize.width * familyTreeView.scale) / 2;
  familyTreeView.y = (viewport.height - familyTreeSize.height * familyTreeView.scale) / 2;
  applyFamilyTreeTransform();
  if (shouldSave) saveFamilyTreeView();
};

const centerFamilyTree = (shouldSave = true) => {
  if (!familyTreeViewport) return;
  const viewport = familyTreeViewport.getBoundingClientRect();
  familyTreeView.x = (viewport.width - familyTreeSize.width * familyTreeView.scale) / 2;
  familyTreeView.y = (viewport.height - familyTreeSize.height * familyTreeView.scale) / 2;
  applyFamilyTreeTransform();
  if (shouldSave) saveFamilyTreeView();
};

const zoomFamilyTree = (nextScale, originX, originY) => {
  if (!familyTreeViewport) return;
  const viewport = familyTreeViewport.getBoundingClientRect();
  const oldScale = familyTreeView.scale;
  const scale = clamp(nextScale, TREE_MIN_SCALE, TREE_MAX_SCALE);
  const ox = originX ?? viewport.width / 2;
  const oy = originY ?? viewport.height / 2;
  const worldX = (ox - familyTreeView.x) / oldScale;
  const worldY = (oy - familyTreeView.y) / oldScale;
  familyTreeView.scale = scale;
  familyTreeView.x = ox - worldX * scale;
  familyTreeView.y = oy - worldY * scale;
  familyTreeUserMoved = true;
  applyFamilyTreeTransform();
  saveFamilyTreeView();
};

const renderFamilyTree = (preserveView = true) => {
  if (!familyTreeViewport || !familyTreeStage || !familyTreeNodes || !familyTreeLines || !familyTreeData.length) return;
  buildFamilyTreeLayout();
  renderFamilyTreeNodes();
  drawFamilyTreeLines();
  if (preserveView && (familyTreeUserMoved || loadFamilyTreeView())) {
    applyFamilyTreeTransform();
  } else {
    fitFamilyTree(false);
  }
};

const scheduleFamilyTreeRender = () => {
  if (familyTreeFrame) return;
  familyTreeFrame = requestAnimationFrame(() => {
    familyTreeFrame = 0;
    renderFamilyTree(true);
  });
};

const setTreeOpen = (open) => {
  if (!familyTreeData.length) return;
  const collect = (branch) => {
    if ((branch.children || []).length) {
      if (open) collapsedTreeBranches.delete(branch.id);
      else collapsedTreeBranches.add(branch.id);
    }
    (branch.children || []).forEach(collect);
  };
  familyTreeData.forEach(collect);
  familyTreeUserMoved = false;
  renderFamilyTree(false);
  fitFamilyTree();
};

familyTreeData = loadFamilyTreeData();
if (familyTreeData.length) {
  renderFamilyTree(false);
  if (loadFamilyTreeView()) applyFamilyTreeTransform();
}

document.querySelector("[data-tree-expand]")?.addEventListener("click", () => setTreeOpen(true));
document.querySelector("[data-tree-collapse]")?.addEventListener("click", () => setTreeOpen(false));
document.querySelector("[data-tree-zoom-out]")?.addEventListener("click", () => zoomFamilyTree(familyTreeView.scale - 0.1));
document.querySelector("[data-tree-zoom-in]")?.addEventListener("click", () => zoomFamilyTree(familyTreeView.scale + 0.1));
document.querySelector("[data-tree-zoom-reset]")?.addEventListener("click", () => {
  familyTreeUserMoved = false;
  fitFamilyTree();
});
document.querySelector("[data-tree-center]")?.addEventListener("click", () => centerFamilyTree());

familyTreeViewport?.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-tree-toggle]");
  if (!toggle) return;
  event.preventDefault();
  const branchId = toggle.dataset.treeToggle;
  if (!branchId) return;
  if (collapsedTreeBranches.has(branchId)) collapsedTreeBranches.delete(branchId);
  else collapsedTreeBranches.add(branchId);
  familyTreeUserMoved = false;
  renderFamilyTree(false);
  fitFamilyTree();
});

if (familyTreeViewport) {
  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let startViewX = 0;
  let startViewY = 0;

  familyTreeViewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, a, input, select, textarea, label")) return;
    isPanning = true;
    familyTreeUserMoved = true;
    startX = event.clientX;
    startY = event.clientY;
    startViewX = familyTreeView.x;
    startViewY = familyTreeView.y;
    familyTreeViewport.classList.add("is-panning");
    familyTreeViewport.setPointerCapture?.(event.pointerId);
  });

  familyTreeViewport.addEventListener("pointermove", (event) => {
    if (!isPanning) return;
    event.preventDefault();
    familyTreeView.x = startViewX + event.clientX - startX;
    familyTreeView.y = startViewY + event.clientY - startY;
    applyFamilyTreeTransform();
  });

  const stopPanning = (event) => {
    if (!isPanning) return;
    isPanning = false;
    familyTreeViewport.classList.remove("is-panning");
    familyTreeViewport.releasePointerCapture?.(event.pointerId);
    saveFamilyTreeView();
  };
  familyTreeViewport.addEventListener("pointerup", stopPanning);
  familyTreeViewport.addEventListener("pointercancel", stopPanning);
  familyTreeViewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = familyTreeViewport.getBoundingClientRect();
    const direction = event.deltaY > 0 ? -0.08 : 0.08;
    zoomFamilyTree(familyTreeView.scale + direction, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });
}

window.addEventListener("load", () => {
  renderFamilyTree(true);
  document.fonts?.ready.then(scheduleFamilyTreeRender);
});
window.addEventListener("resize", () => {
  if (!familyTreeUserMoved) renderFamilyTree(false);
  else scheduleFamilyTreeRender();
});

const findPreviewTarget = (input) => {
  const previewKey = input.dataset.previewInput?.trim();
  const scope = input.closest("form, .tree-editor-row, .admin-member-card, .admin-list-card, .admin-card") || document;
  if (previewKey) {
    return [...scope.querySelectorAll("[data-preview-target]")]
      .find((target) => target.dataset.previewTarget === previewKey);
  }
  const card = input.closest(".tree-editor-row, .admin-member-card, .admin-list-card, .admin-card");
  return card?.querySelector("[data-preview-target]");
};

document.querySelectorAll("[data-preview-input]").forEach((input) => {
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    const img = findPreviewTarget(input);
    if (!file || !img) return;
    if (img.dataset.previewObjectUrl) URL.revokeObjectURL(img.dataset.previewObjectUrl);
    const objectUrl = URL.createObjectURL(file);
    img.dataset.previewObjectUrl = objectUrl;
    img.src = objectUrl;
  });
});

document.querySelectorAll("[data-person-select]").forEach((select) => {
  const updatePersonPreview = () => {
    const preview = select.closest("form")?.querySelector("[data-person-preview-list]");
    if (!preview) return;
    const selected = [...select.selectedOptions].filter((option) => option.value);
    preview.replaceChildren();
    selected.forEach((option) => {
      const image = option.dataset.image || "";
      const name = option.dataset.name || option.textContent.trim();
      if (!image) {
        const label = document.createElement("span");
        label.textContent = name;
        preview.append(label);
        return;
      }
      const img = document.createElement("img");
      img.src = image;
      img.alt = name;
      preview.append(img);
    });
    preview.hidden = !selected.length;
  };
  select.addEventListener("change", updatePersonPreview);
  updatePersonPreview();
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
  if (status) status.textContent = "Salvando toda a árvore...";
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
    if (status) status.textContent = "Não foi possível salvar tudo. Tente novamente.";
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
    if (status) status.textContent = "Não foi possível salvar os familiares. Tente novamente.";
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
document.querySelector("[data-new-family-member]")?.addEventListener("click", () => {
  requestAnimationFrame(() => document.querySelector("#novo-familiar input[name='name']")?.focus());
});
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
