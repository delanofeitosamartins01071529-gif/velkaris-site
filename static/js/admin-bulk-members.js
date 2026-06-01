(() => {
  const grid = document.querySelector(".admin-member-grid");
  if (!grid || document.querySelector("[data-member-bulk-save]")) return;

  const forms = Array.from(grid.querySelectorAll('form[action^="/admin/members/"]:not([action$="/delete"])'));
  if (!forms.length) return;

  grid.id = grid.id || "cards";

  const panel = document.createElement("section");
  panel.id = "cards-actions";
  panel.className = "admin-card reveal is-visible";
  panel.innerHTML = `
    <div class="admin-section-title">
      <p class="section-kicker">Edição em lote</p>
      <h2>Cards dos familiares</h2>
      <p class="admin-help">Preencha quantos cards quiser e salve todos de uma vez. Os botões individuais continuam disponíveis para ajustes rápidos.</p>
      <label class="member-search">
        <span>Pesquisar familiar</span>
        <input type="search" placeholder="Digite o nome do familiar" autocomplete="off" data-member-search>
      </label>
      <div class="member-bulk-actions" style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;margin-top:.9rem">
        <button class="primary-cta" type="button" data-member-bulk-save>Salvar familiares</button>
        <button class="ghost-cta" type="button" data-member-search-go hidden>Ir para familiar</button>
        <span data-member-bulk-status style="color:rgba(232,224,211,.68);font-family:var(--font-serif)"></span>
      </div>
    </div>
  `;
  grid.parentNode.insertBefore(panel, grid);

  const button = panel.querySelector("[data-member-bulk-save]");
  const status = panel.querySelector("[data-member-bulk-status]");
  const search = panel.querySelector("[data-member-search]");
  const searchGo = panel.querySelector("[data-member-search-go]");
  const cards = Array.from(grid.querySelectorAll(".admin-member-card"));
  const normalizeText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let visibleCards = cards;

  const goToFirstVisibleCard = () => {
    const card = visibleCards[0];
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.remove("is-search-target");
    card.offsetHeight;
    card.classList.add("is-search-target");
    window.setTimeout(() => card.classList.remove("is-search-target"), 1600);
  };

  search?.addEventListener("input", () => {
    const query = normalizeText(search.value.trim());
    visibleCards = cards.filter((card) => {
      const name = card.querySelector('input[name="name"]')?.value || "";
      const visible = !query || normalizeText(name).includes(query);
      card.hidden = !visible;
      return visible;
    });
    searchGo.hidden = !query || visibleCards.length === 0;
    status.textContent = query ? `${visibleCards.length} familiar(es) encontrado(s).` : "";
  });
  search?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !visibleCards.length || !search.value.trim()) return;
    event.preventDefault();
    goToFirstVisibleCard();
  });
  searchGo?.addEventListener("click", goToFirstVisibleCard);

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "Salvando familiares...";

    try {
      for (const form of forms) {
        const response = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          credentials: "same-origin",
          headers: { Accept: "text/html" },
        });
        if (!response.ok) throw new Error("Falha ao salvar");
      }
      window.location.href = `${window.location.pathname}#cards`;
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      status.textContent = "Não foi possível salvar todos. Tente novamente.";
    }
  });
})();
