(() => {
  const button = document.querySelector("[data-timeline-bulk-save]");
  const status = document.querySelector("[data-timeline-bulk-status]");
  const forms = Array.from(document.querySelectorAll("[data-timeline-editor-form]"));
  if (!button || !status || !forms.length) return;

  button.addEventListener("click", async () => {
    button.disabled = true;
    let saved = 0;

    try {
      for (const form of forms) {
        status.textContent = `Salvando crônicas: ${saved + 1} de ${forms.length}...`;
        const response = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          credentials: "same-origin",
          headers: { Accept: "text/html" },
        });
        if (!response.ok) throw new Error("Falha ao salvar");
        saved += 1;
      }
      status.textContent = "Todas as crônicas foram salvas.";
      window.location.href = `${window.location.pathname}#timeline`;
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      status.textContent = `Não foi possível concluir. ${saved} de ${forms.length} crônicas foram salvas.`;
    }
  });
})();
