(() => {
  const modal = document.querySelector("[data-map-marker-modal]");
  const closeModal = () => {
    if (!modal) return;
    if (window.VelkarisModalMotion) window.VelkarisModalMotion.close(modal);
    else if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  };

  document.querySelectorAll("[data-map-marker]").forEach((marker) => {
    marker.addEventListener("click", () => {
      const target = marker.dataset.territoryTarget;
      document.querySelectorAll("[data-map-marker]").forEach((item) => item.classList.toggle("is-active", item === marker));
      document.querySelectorAll("[data-territory-card]").forEach((card) => {
        const active = card.dataset.territoryCard === target;
        card.classList.toggle("is-active", active);
      });
      if (!modal) return;
      modal.querySelector("[data-map-modal-title]").textContent = marker.dataset.title || "";
      modal.querySelector("[data-map-modal-type]").textContent = [marker.dataset.type, marker.dataset.status].filter(Boolean).join(" · ");
      modal.querySelector("[data-map-modal-description]").textContent = marker.dataset.description || "";
      modal.querySelector("[data-map-modal-lore]").textContent = marker.dataset.lore || "";
      const gallery = modal.querySelector("[data-map-modal-gallery]");
      if (gallery) {
        gallery.replaceChildren();
        let images = [];
        try {
          images = JSON.parse(marker.dataset.images || "[]");
        } catch {
          images = [];
        }
        images.forEach((src) => {
          const image = document.createElement("img");
          image.src = src.startsWith("http") || src.startsWith("/")
            ? src
            : src.startsWith("uploads/")
              ? `/${src}`
              : `/static/${src}`;
          image.alt = `Registro visual de ${marker.dataset.title || "território"}`;
          gallery.appendChild(image);
        });
        gallery.hidden = images.length === 0;
      }
      if (window.VelkarisModalMotion) window.VelkarisModalMotion.open(modal);
      else if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
      window.VelkarisAudio?.playPanelOpen?.();
    });
  });

  document.querySelector("[data-map-modal-close]")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  modal?.addEventListener("close", () => document.body.classList.remove("modal-open"));

  const mapViewport = document.querySelector("[data-map-viewport]");
  const mapStage = document.querySelector("[data-map-stage]");
  const mapImage = document.querySelector("[data-map-image]");
  const mapPanel = mapViewport?.closest(".map-panel");
  const mapFullscreenTarget = mapPanel || mapViewport;
  let mapSize = { width: 1, height: 1 };
  let mapView = { x: 0, y: 0, scale: 1 };
  let mapFitScale = 1;
  let mapUserMoved = false;

  const clampMap = (value, min, max) => Math.min(max, Math.max(min, value));

  const applyMapTransform = () => {
    if (!mapViewport || !mapStage) return;
    const viewport = mapViewport.getBoundingClientRect();
    const scaledWidth = mapSize.width * mapView.scale;
    const scaledHeight = mapSize.height * mapView.scale;
    const slack = Math.min(180, viewport.width * 0.18);
    mapView.x = scaledWidth <= viewport.width
      ? (viewport.width - scaledWidth) / 2
      : clampMap(mapView.x, viewport.width - scaledWidth - slack, slack);
    mapView.y = scaledHeight <= viewport.height
      ? (viewport.height - scaledHeight) / 2
      : clampMap(mapView.y, viewport.height - scaledHeight - slack, slack);
    mapStage.style.width = `${mapSize.width}px`;
    mapStage.style.height = `${mapSize.height}px`;
    mapStage.style.setProperty("--map-marker-scale", String(clampMap(1 / mapView.scale, 1, 4.6)));
    mapStage.style.transform = `translate(${mapView.x}px, ${mapView.y}px) scale(${mapView.scale})`;
    const label = document.querySelector("[data-map-zoom-reset]");
    if (label) label.textContent = `${Math.round((mapView.scale / mapFitScale) * 100)}%`;
  };

  const fitMap = () => {
    if (!mapViewport || !mapImage) return;
    const viewport = mapViewport.getBoundingClientRect();
    mapSize = {
      width: Math.max(1, mapImage.naturalWidth || 1600),
      height: Math.max(1, mapImage.naturalHeight || 900),
    };
    const padding = viewport.width < 720 ? 20 : 44;
    mapFitScale = (viewport.width - padding) / mapSize.width;
    mapView.scale = Math.max(0.01, mapFitScale);
    mapView.x = (viewport.width - mapSize.width * mapView.scale) / 2;
    mapView.y = (viewport.height - mapSize.height * mapView.scale) / 2;
    mapUserMoved = false;
    applyMapTransform();
  };

  const centerMap = () => {
    if (!mapViewport) return;
    const viewport = mapViewport.getBoundingClientRect();
    mapView.x = (viewport.width - mapSize.width * mapView.scale) / 2;
    mapView.y = (viewport.height - mapSize.height * mapView.scale) / 2;
    applyMapTransform();
  };

  const zoomMap = (ratio, originX, originY) => {
    if (!mapViewport) return;
    const viewport = mapViewport.getBoundingClientRect();
    const oldScale = mapView.scale;
    const containScale = Math.min(
      (viewport.width - 20) / mapSize.width,
      (viewport.height - 20) / mapSize.height
    );
    const minScale = Math.min(mapFitScale * 0.62, containScale);
    const maxScale = Math.max(mapFitScale * 7, 1.4);
    const nextScale = clampMap(oldScale * ratio, minScale, maxScale);
    const ox = originX ?? viewport.width / 2;
    const oy = originY ?? viewport.height / 2;
    const worldX = (ox - mapView.x) / oldScale;
    const worldY = (oy - mapView.y) / oldScale;
    mapView.scale = nextScale;
    mapView.x = ox - worldX * nextScale;
    mapView.y = oy - worldY * nextScale;
    mapUserMoved = true;
    applyMapTransform();
  };

  document.querySelector("[data-map-zoom-out]")?.addEventListener("click", () => zoomMap(0.82));
  document.querySelector("[data-map-zoom-in]")?.addEventListener("click", () => zoomMap(1.22));
  document.querySelector("[data-map-zoom-reset]")?.addEventListener("click", fitMap);
  document.querySelector("[data-map-center]")?.addEventListener("click", centerMap);
  document.querySelector("[data-map-fullscreen]")?.addEventListener("click", async () => {
    if (!mapFullscreenTarget) return;
    if (document.fullscreenElement === mapFullscreenTarget) await document.exitFullscreen?.();
    else await mapFullscreenTarget.requestFullscreen?.();
  });

  if (mapViewport) {
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let startViewX = 0;
    let startViewY = 0;
    mapViewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button, a")) return;
      isPanning = true;
      mapUserMoved = true;
      startX = event.clientX;
      startY = event.clientY;
      startViewX = mapView.x;
      startViewY = mapView.y;
      mapViewport.classList.add("is-panning");
      mapViewport.setPointerCapture?.(event.pointerId);
    });
    mapViewport.addEventListener("pointermove", (event) => {
      if (!isPanning) return;
      event.preventDefault();
      mapView.x = startViewX + event.clientX - startX;
      mapView.y = startViewY + event.clientY - startY;
      applyMapTransform();
    });
    const stopPanning = (event) => {
      if (!isPanning) return;
      isPanning = false;
      mapViewport.classList.remove("is-panning");
      mapViewport.releasePointerCapture?.(event.pointerId);
    };
    mapViewport.addEventListener("pointerup", stopPanning);
    mapViewport.addEventListener("pointercancel", stopPanning);
    mapViewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = mapViewport.getBoundingClientRect();
      zoomMap(event.deltaY > 0 ? 0.88 : 1.14, event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });
  }

  const initializeMap = () => requestAnimationFrame(fitMap);
  if (mapImage?.complete) initializeMap();
  else mapImage?.addEventListener("load", initializeMap, { once: true });
  document.addEventListener("fullscreenchange", () => {
    mapPanel?.classList.toggle("is-map-fullscreen", document.fullscreenElement === mapFullscreenTarget);
    requestAnimationFrame(() => mapUserMoved ? applyMapTransform() : fitMap());
  });
  window.addEventListener("resize", () => {
    if (!mapUserMoved) fitMap();
    else applyMapTransform();
  });

  const adminPreview = document.querySelector("[data-map-admin-preview]");
  const markerForms = [...document.querySelectorAll("[data-map-marker-form]")];
  let activePickForm = null;

  const getColorField = (form) => form?.querySelector('[name="color"], [data-map-color-text]');

  const normalizeColor = (value) => (/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#d7b46a");

  const syncDraftMarker = (form) => {
    if (!adminPreview || !form) return;
    const x = Number.parseFloat(form.querySelector('[name="coord_x"]')?.value || "50");
    const y = Number.parseFloat(form.querySelector('[name="coord_y"]')?.value || "50");
    const color = normalizeColor(getColorField(form)?.value);
    adminPreview.style.setProperty("--draft-x", `${Math.min(100, Math.max(0, x))}%`);
    adminPreview.style.setProperty("--draft-y", `${Math.min(100, Math.max(0, y))}%`);
    adminPreview.style.setProperty("--draft-color", color);
    adminPreview.classList.add("has-draft-marker");
  };

  const setActivePickForm = (form) => {
    activePickForm = form;
    markerForms.forEach((item) => item.classList.toggle("is-picking-map-position", item === form));
    adminPreview?.classList.toggle("is-picking-position", Boolean(form));
    markerForms.forEach((item) => {
      const status = item.querySelector("[data-map-pick-status]");
      if (status) status.textContent = item === form ? "Clique no ponto desejado do mapa." : "Clique no botÃ£o e depois no mapa.";
    });
    syncDraftMarker(form);
    adminPreview?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const setPickedPosition = (event) => {
    if (!adminPreview || !activePickForm) return;
    if (event.target.closest("button")) return;
    const image = adminPreview.querySelector("img");
    const rect = image?.getBoundingClientRect() || adminPreview.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    const xInput = activePickForm.querySelector('[name="coord_x"]');
    const yInput = activePickForm.querySelector('[name="coord_y"]');
    if (!xInput || !yInput) return;
    xInput.value = x.toFixed(2);
    yInput.value = y.toFixed(2);
    syncDraftMarker(activePickForm);
    activePickForm.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setActivePickForm(null);
  };

  markerForms.forEach((form) => {
    if (!form.querySelector("[data-map-pick-position]")) {
      const actions = document.createElement("div");
      actions.className = "map-position-actions";
      actions.innerHTML = `
        <button class="secondary-cta" type="button" data-map-pick-position>Selecionar posiÃ§Ã£o no mapa</button>
        <span data-map-pick-status>Clique no botÃ£o e depois no mapa.</span>
      `;
      const yField = form.querySelector('[name="coord_y"]')?.closest("label");
      yField?.insertAdjacentElement("afterend", actions);
    }
    form.querySelector("[data-map-pick-position]")?.addEventListener("click", () => setActivePickForm(form));
    form.querySelectorAll('[name="coord_x"], [name="coord_y"], [name="color"], [data-map-color-text]').forEach((input) => {
      input.addEventListener("input", () => {
        if (activePickForm === form) syncDraftMarker(form);
      });
    });
  });

  document.querySelectorAll("[data-map-color-select]").forEach((select) => {
    const currentValue = normalizeColor(select.value);
    const wrapper = document.createElement("span");
    wrapper.className = "color-picker-row";
    wrapper.innerHTML = `
      <input type="color" value="${currentValue}" data-map-color-picker aria-label="Escolher cor do marcador">
      <input type="text" name="${select.name}" value="${currentValue}" pattern="#[0-9a-fA-F]{6}" data-map-color-text>
    `;
    select.replaceWith(wrapper);
  });

  document.querySelectorAll("[data-map-color-picker]").forEach((picker) => {
    const form = picker.closest("[data-map-marker-form]");
    const text = picker.parentElement?.querySelector("[data-map-color-text]");
    picker.addEventListener("input", () => {
      if (text) text.value = picker.value;
      if (activePickForm === form) syncDraftMarker(form);
    });
  });

  document.querySelectorAll("[data-map-color-text]").forEach((text) => {
    const form = text.closest("[data-map-marker-form]");
    const picker = text.parentElement?.querySelector("[data-map-color-picker]");
    text.addEventListener("input", () => {
      if (picker && /^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value;
      if (activePickForm === form) syncDraftMarker(form);
    });
  });

  adminPreview?.addEventListener("click", setPickedPosition);
  document.querySelectorAll("[data-map-admin-marker]").forEach((marker) => {
    marker.addEventListener("click", () => {
      if (activePickForm) return;
      const id = marker.dataset.mapAdminMarker;
      const editor = document.querySelector(`[data-territory-editor="${id}"]`);
      editor?.scrollIntoView({ block: "center", behavior: "smooth" });
      editor?.classList.add("is-highlighted");
      setTimeout(() => editor?.classList.remove("is-highlighted"), 1400);
    });
  });
})();
