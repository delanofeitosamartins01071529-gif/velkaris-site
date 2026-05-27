(() => {
  const grid = document.querySelector(".admin-member-grid");
  if (!grid || document.querySelector("[data-member-bulk-save]")) return;

  const forms = Array.from(grid.querySelectorAll('form[action^="/admin/members/"]:not([action$="/delete"])'));
  if (!forms.length) return;

  const nav = document.querySelector(".admin-tabs");
  if (nav && !nav.querySelector('a[href="#editar-familiares"]')) {
    const link = document.createElement("a");
    link.href = "#editar-familiares";
    link.textContent = "Editar cards";
    const orderLink = nav.querySelector('a[href="#ordenacao"]');
    nav.insertBefore(link, orderLink || null);
  }

  grid.id = grid.id || "editar-familiares";

  const panel = document.createElement("section");
  panel.className = "admin-card reveal is-visible";
  panel.innerHTML = `
    <div class="admin-section-title">
      <p class="section-kicker">Edição em lote</p>
      <h2>Cards dos familiares</h2>
      <p class="admin-help">Preencha quantos cards quiser e salve todos de uma vez. Os botões individuais continuam disponíveis para ajustes rápidos.</p>
      <div class="member-bulk-actions" style="display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;margin-top:.9rem">
        <button class="primary-cta" type="button" data-member-bulk-save>Salvar familiares</button>
        <span data-member-bulk-status style="color:rgba(232,224,211,.68);font-family:var(--font-serif)"></span>
      </div>
    </div>
  `;
  grid.parentNode.insertBefore(panel, grid);

  const button = panel.querySelector("[data-member-bulk-save]");
  const status = panel.querySelector("[data-member-bulk-status]");

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
      window.location.href = `${window.location.pathname}#editar-familiares`;
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      status.textContent = "Não foi possível salvar todos. Tente novamente.";
    }
  });
})();
