(() => {
  const MAX_UPLOAD_IMAGE_BYTES = 3.5 * 1024 * 1024;
  const MAX_UPLOAD_IMAGE_EDGE = 2600;

  const replaceInputFile = (input, file) => {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

  const imageFromFile = (file) => new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem inválida"));
    };
    image.src = url;
  });

  const compressImageFile = async (file, { maxEdge = MAX_UPLOAD_IMAGE_EDGE, maxBytes = MAX_UPLOAD_IMAGE_BYTES } = {}) => {
    if (!file?.type?.startsWith("image/") || file.size <= maxBytes) return file;
    const source = await imageFromFile(file);
    const scale = Math.min(1, maxEdge / Math.max(source.naturalWidth, source.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);

    const baseName = file.name.replace(/\.[^.]+$/, "");
    const extension = file.type === "image/webp" ? "webp" : "jpg";
    const outputType = extension === "webp" ? "image/webp" : "image/jpeg";
    let quality = 0.86;
    let blob = await canvasToBlob(canvas, outputType, quality);
    while (blob && blob.size > maxBytes && quality > 0.58) {
      quality -= 0.08;
      blob = await canvasToBlob(canvas, outputType, quality);
    }
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${baseName}-compacta.${extension}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  };

  const imageInputs = [...document.querySelectorAll('input[type="file"]:not([multiple])')]
    .filter((input) => input.dataset.skipCrop !== "true")
    .filter((input) => !input.form?.action.includes("/newspapers"))
    .filter((input) => (input.accept || "").includes("image") || /\.(png|jpe?g|webp)/i.test(input.accept || ""));
  const passthroughImageInputs = [...document.querySelectorAll('input[type="file"]:not([multiple])')]
    .filter((input) => input.dataset.skipCrop === "true" || input.form?.action.includes("/newspapers"))
    .filter((input) => (input.accept || "").includes("image") || /\.(png|jpe?g|webp)/i.test(input.accept || ""));
  const multiImageInputs = [...document.querySelectorAll('input[type="file"][multiple]')]
    .filter((input) => (input.accept || "").includes("image") || /\.(png|jpe?g|webp)/i.test(input.accept || ""));
  if (!imageInputs.length && !passthroughImageInputs.length && !multiImageInputs.length) return;

  const editor = document.createElement("dialog");
  editor.className = "image-crop-modal";
  editor.innerHTML = `
    <div class="image-crop-shell">
      <div class="modal-effects" aria-hidden="true"><span></span><span></span><span></span></div>
      <button class="modal-close" type="button" data-crop-cancel aria-label="Fechar editor">&times;</button>
      <div class="image-crop-heading">
        <p class="section-kicker">Oficina de imagens</p>
        <h2>Enquadrar imagem</h2>
        <p>Arraste a imagem para escolher o corte e use a roda do mouse para aproximar ou afastar.</p>
      </div>
      <div class="image-crop-workspace">
        <div class="image-crop-stage" data-crop-stage>
          <canvas data-crop-canvas></canvas>
          <span class="image-crop-guide" aria-hidden="true"></span>
        </div>
        <div class="image-crop-controls">
          <label>
            Formato
            <select data-crop-aspect>
              <option value="original">Original</option>
              <option value="1">Quadrado 1:1</option>
              <option value="0.75">Retrato 3:4</option>
              <option value="0.8">Retrato 4:5</option>
              <option value="0.6666666667">Retrato 2:3</option>
              <option value="1.7777777778">Paisagem 16:9</option>
            </select>
          </label>
          <label>
            Zoom
            <input type="range" min="1" max="3" value="1" step="0.01" data-crop-zoom>
          </label>
          <button class="ghost-cta" type="button" data-crop-reset>Centralizar</button>
          <button class="primary-cta" type="button" data-crop-apply>Usar enquadramento</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(editor);

  const stage = editor.querySelector("[data-crop-stage]");
  const canvas = editor.querySelector("[data-crop-canvas]");
  const context = canvas.getContext("2d");
  const aspectSelect = editor.querySelector("[data-crop-aspect]");
  const zoomInput = editor.querySelector("[data-crop-zoom]");
  let activeInput = null;
  let sourceFile = null;
  let image = null;
  let aspectRatio = 1;
  let zoom = 1;
  let offsetX = 0;
  let offsetY = 0;
  let pointer = null;
  const skipNextEditor = new WeakSet();
  const skipNextCompression = new WeakSet();

  const inferredAspect = (input) => {
    if (input.dataset.cropAspect) return input.dataset.cropAspect;
    if (input.name === "portrait") return "0.8";
    if (input.name === "crest_image") return "1";
    if (input.name === "hero_image") return "1.7777777778";
    return "original";
  };

  const selectedRatio = () => {
    if (!image) return 1;
    return aspectSelect.value === "original" ? image.naturalWidth / image.naturalHeight : Number(aspectSelect.value);
  };

  const setCanvasSize = () => {
    aspectRatio = selectedRatio();
    stage.style.width = "100%";
    stage.style.height = "auto";
    const availableWidth = Math.min(760, stage.getBoundingClientRect().width || 760);
    const availableHeight = Math.max(220, Math.min(560, window.innerHeight - 260));
    let width = availableWidth;
    let height = width / aspectRatio;
    if (height > availableHeight) {
      height = availableHeight;
      width = height * aspectRatio;
    }
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    stage.style.width = `${canvas.width}px`;
    stage.style.height = `${canvas.height}px`;
  };

  const clampOffsets = () => {
    if (!image) return;
    const baseScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const drawWidth = image.naturalWidth * baseScale * zoom;
    const drawHeight = image.naturalHeight * baseScale * zoom;
    const maxX = Math.max(0, (drawWidth - canvas.width) / 2);
    const maxY = Math.max(0, (drawHeight - canvas.height) / 2);
    offsetX = Math.min(maxX, Math.max(-maxX, offsetX));
    offsetY = Math.min(maxY, Math.max(-maxY, offsetY));
  };

  const draw = () => {
    if (!image) return;
    setCanvasSize();
    clampOffsets();
    const baseScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const drawWidth = image.naturalWidth * baseScale * zoom;
    const drawHeight = image.naturalHeight * baseScale * zoom;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      image,
      (canvas.width - drawWidth) / 2 + offsetX,
      (canvas.height - drawHeight) / 2 + offsetY,
      drawWidth,
      drawHeight
    );
  };

  const resetView = () => {
    zoom = 1;
    offsetX = 0;
    offsetY = 0;
    zoomInput.value = "1";
    draw();
  };

  const setZoom = (nextZoom, anchorX = canvas.width / 2, anchorY = canvas.height / 2) => {
    if (!image) return;
    const oldZoom = zoom;
    zoom = Math.min(3, Math.max(1, nextZoom));
    const ratio = zoom / oldZoom;
    offsetX = anchorX - canvas.width / 2 - (anchorX - canvas.width / 2 - offsetX) * ratio;
    offsetY = anchorY - canvas.height / 2 - (anchorY - canvas.height / 2 - offsetY) * ratio;
    zoomInput.value = String(zoom);
    draw();
  };

  const closeEditor = (discardSelection = true) => {
    if (discardSelection && activeInput) activeInput.value = "";
    if (editor.open) editor.close();
    activeInput = null;
    sourceFile = null;
    image = null;
    pointer = null;
    document.body.classList.remove("modal-open");
  };

  const openEditor = (input, file) => {
    activeInput = input;
    sourceFile = file;
    image = new Image();
    image.onload = () => {
      aspectSelect.value = inferredAspect(input);
      zoom = 1;
      offsetX = 0;
      offsetY = 0;
      zoomInput.value = "1";
      if (typeof editor.showModal === "function") editor.showModal();
      else editor.setAttribute("open", "");
      document.body.classList.add("modal-open");
      requestAnimationFrame(draw);
    };
    const sourceUrl = URL.createObjectURL(file);
    image.addEventListener("load", () => URL.revokeObjectURL(sourceUrl), { once: true });
    image.src = sourceUrl;
  };

  imageInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (skipNextEditor.has(input)) {
        skipNextEditor.delete(input);
        return;
      }
      const file = input.files?.[0];
      if (file?.type.startsWith("image/")) openEditor(input, file);
    });
  });

  passthroughImageInputs.forEach((input) => {
    input.addEventListener("change", async () => {
      if (skipNextCompression.has(input)) {
        skipNextCompression.delete(input);
        return;
      }
      const file = input.files?.[0];
      if (!file?.type.startsWith("image/")) return;
      const compactFile = await compressImageFile(file, { maxEdge: 3200, maxBytes: MAX_UPLOAD_IMAGE_BYTES });
      if (compactFile === file) return;
      skipNextCompression.add(input);
      replaceInputFile(input, compactFile);
    });
  });

  multiImageInputs.forEach((input) => {
    input.addEventListener("change", async () => {
      if (skipNextCompression.has(input)) {
        skipNextCompression.delete(input);
        return;
      }
      const files = [...(input.files || [])];
      if (!files.length) return;
      const transfer = new DataTransfer();
      for (const file of files) {
        transfer.items.add(await compressImageFile(file));
      }
      skipNextCompression.add(input);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX, offsetY };
    stage.classList.add("is-dragging");
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    offsetX = pointer.offsetX + event.clientX - pointer.x;
    offsetY = pointer.offsetY + event.clientY - pointer.y;
    draw();
  });
  const stopDragging = (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    pointer = null;
    stage.classList.remove("is-dragging");
    stage.releasePointerCapture?.(event.pointerId);
  };
  stage.addEventListener("pointerup", stopDragging);
  stage.addEventListener("pointercancel", stopDragging);
  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const anchorX = event.clientX - bounds.left;
    const anchorY = event.clientY - bounds.top;
    setZoom(zoom + (event.deltaY < 0 ? 0.12 : -0.12), anchorX, anchorY);
  }, { passive: false });
  aspectSelect.addEventListener("change", resetView);
  zoomInput.addEventListener("input", () => {
    setZoom(Number(zoomInput.value));
  });
  editor.querySelector("[data-crop-reset]").addEventListener("click", resetView);
  editor.querySelector("[data-crop-cancel]").addEventListener("click", closeEditor);
  editor.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeEditor();
  });
  editor.addEventListener("click", (event) => {
    if (event.target === editor) closeEditor();
  });
  window.addEventListener("resize", draw);

  editor.querySelector("[data-crop-apply]").addEventListener("click", () => {
    if (!activeInput || !sourceFile || !image) return;
    const output = document.createElement("canvas");
    const maxWidth = 2400;
    output.width = Math.min(maxWidth, image.naturalWidth);
    output.height = Math.round(output.width / aspectRatio);
    const outputContext = output.getContext("2d");
    outputContext.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, output.width, output.height);
    output.toBlob((blob) => {
      if (!blob || !activeInput) return;
      const extension = sourceFile.type === "image/png" ? "png" : "jpg";
      const baseName = sourceFile.name.replace(/\.[^.]+$/, "");
      const croppedFile = new File([blob], `${baseName}-enquadrada.${extension}`, {
        type: extension === "png" ? "image/png" : "image/jpeg",
        lastModified: Date.now(),
      });
      skipNextEditor.add(activeInput);
      replaceInputFile(activeInput, croppedFile);
      closeEditor(false);
    }, sourceFile.type === "image/png" ? "image/png" : "image/jpeg", 0.86);
  });
})();
