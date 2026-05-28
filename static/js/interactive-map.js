(() => {
  const modal = document.querySelector("[data-map-marker-modal]");
  const closeModal = () => {
    if (!modal) return;
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
    document.body.classList.remove("modal-open");
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
      if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
      document.body.classList.add("modal-open");
    });
  });

  document.querySelector("[data-map-modal-close]")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  modal?.addEventListener("close", () => document.body.classList.remove("modal-open"));

  const adminPreview = document.querySelector("[data-map-admin-preview]");
  const createForm = document.querySelector("[data-map-marker-create]");
  const xInput = createForm?.querySelector("[data-map-x]");
  const yInput = createForm?.querySelector("[data-map-y]");

  const setCreatePosition = (event) => {
    if (!adminPreview || !xInput || !yInput) return;
    if (event.target.closest("button")) return;
    const image = adminPreview.querySelector("img");
    const rect = image?.getBoundingClientRect() || adminPreview.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    xInput.value = x.toFixed(2);
    yInput.value = y.toFixed(2);
    adminPreview.style.setProperty("--draft-x", `${x}%`);
    adminPreview.style.setProperty("--draft-y", `${y}%`);
    adminPreview.classList.add("has-draft-marker");
    createForm?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  adminPreview?.addEventListener("click", setCreatePosition);
  document.querySelectorAll("[data-map-admin-marker]").forEach((marker) => {
    marker.addEventListener("click", () => {
      const id = marker.dataset.mapAdminMarker;
      const editor = document.querySelector(`[data-territory-editor="${id}"]`);
      editor?.scrollIntoView({ block: "center", behavior: "smooth" });
      editor?.classList.add("is-highlighted");
      setTimeout(() => editor?.classList.remove("is-highlighted"), 1400);
    });
  });
})();
