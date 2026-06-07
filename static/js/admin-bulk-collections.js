(() => {
  const sections = Array.from(document.querySelectorAll("[data-bulk-section]"));
  const ignoredActions = ["/delete"];

  const editableFormsFor = (section) =>
    Array.from(section.querySelectorAll(".admin-list form.admin-form[action]")).filter((form) => {
      const action = form.getAttribute("action") || "";
      return !ignoredActions.some((suffix) => action.endsWith(suffix));
    });

  const capitalize = (value) => {
    const text = String(value || "itens").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Itens";
  };

  sections.forEach((section) => {
    if (section.querySelector("[data-collection-bulk-save]")) return;

    const forms = editableFormsFor(section);
    if (!forms.length) return;

    const title = section.querySelector(".admin-section-title");
    if (!title) return;

    const label = section.dataset.bulkLabel || "itens";
    const buttonLabel = section.dataset.bulkButton || `Salvar todos os ${label}`;
    const anchor = section.dataset.bulkAnchor || section.id || "";
    const actions = document.createElement("div");
    actions.className = "member-bulk-actions";
    actions.innerHTML = `
      <button class="primary-cta" type="button" data-collection-bulk-save>${buttonLabel}</button>
      <span data-collection-bulk-status></span>
    `;
    title.appendChild(actions);

    const button = actions.querySelector("[data-collection-bulk-save]");
    const status = actions.querySelector("[data-collection-bulk-status]");

    button.addEventListener("click", async () => {
      button.disabled = true;
      let saved = 0;

      try {
        for (const form of forms) {
          status.textContent = `Salvando ${label}: ${saved + 1} de ${forms.length}...`;
          const response = await fetch(form.action, {
            method: "POST",
            body: new FormData(form),
            credentials: "same-origin",
            headers: { Accept: "text/html" },
          });
          if (!response.ok) throw new Error("Falha ao salvar");
          saved += 1;
        }
        status.textContent = `${capitalize(label)} salvos.`;
        window.location.href = `${window.location.pathname}#${anchor}`;
        window.location.reload();
      } catch (error) {
        button.disabled = false;
        status.textContent = `Não foi possível concluir. ${saved} de ${forms.length} foram salvos.`;
      }
    });
  });
})();
