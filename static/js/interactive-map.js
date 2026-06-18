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
        if (active) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
