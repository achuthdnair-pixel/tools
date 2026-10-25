(() => {
  const modalRoot = document.getElementById('modal-root');
  const searchInput = document.getElementById('tool-search');
  const toolCards = [...document.querySelectorAll('[data-tool-search]')];
  const emptySearch = document.getElementById('search-empty');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const toolCount = document.getElementById('tool-count');
  const pdfWorkerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  let mode = 'pdf-to-images';
  let selectedCategory = 'all';
  let files = [];
  let busy = false;

  if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  function filterTools() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    toolCards.forEach((card) => {
      const matchesQuery = card.dataset.toolSearch.includes(query);
      const matchesCategory = selectedCategory === 'all' || card.dataset.toolCategory === selectedCategory;
      const matches = matchesQuery && matchesCategory;
      card.hidden = !matches;
      if (matches) visibleCount++;
    });
    emptySearch.hidden = visibleCount > 0;
    if (visibleCount === 0) emptySearch.textContent = 'No tools match that search.';
    toolCount.textContent = `${visibleCount} ${visibleCount === 1 ? 'tool' : 'tools'}`;
  }

  searchInput.addEventListener('input', filterTools);
  filterButtons.forEach((button) => button.addEventListener('click', () => {
    selectedCategory = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const active = filterButton === button;
      filterButton.classList.toggle('active', active);
      filterButton.setAttribute('aria-pressed', String(active));
    });
    filterTools();
  }));

  const infoPages = {
    about: {
      title: 'About Tool Hub',
      summary: 'Tool Hub brings together straightforward tools for everyday document tasks.',
      items: [
        'Clean Malayalam Unicode text in Word documents.',
        'Convert PDF pages to images or combine images into a PDF.',
        'Resize and crop images to preset or custom dimensions.',
        'Convert between PDF, Word, Excel, CSV, text, PowerPoint, and image files.',
        'Convert and edit audio from video or audio files.',
        'Process files in your browser without uploading them to Tool Hub.'
      ]
    },
    terms: {
      title: 'Terms of Service',
      summary: 'Please review these basic terms before using the tools.',
      items: [
        'Use only files you own or are authorized to process.',
        'Review converted or cleaned files before relying on them; formatting or content may change.',
        'The tools are provided as available, without a guarantee that every file or conversion will work.',
        'Files are processed in your browser. Supporting libraries are loaded from third-party CDNs.',
        'Google Analytics and AdSense are optional and run only when configured and allowed in your privacy choices.'
      ]
    },
    contact: {
      title: 'Contact Us',
      summary: 'For questions or support, email us at:',
      email: 'besttoolkit@gmail.com',
      items: []
    }
  };
  let activeInfoTrigger = null;
  document.querySelectorAll('[data-info]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    activeInfoTrigger = link;
    showInfoPage(link.dataset.info);
  }));

  document.getElementById('converter-launch').addEventListener('click', () => window.toolHubNavigate('pdf'));
  if (window.toolHubPage === 'pdf') openConverter();

  function showInfoPage(id) {
    const page = infoPages[id];
    if (!page) return;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="dialog info-dialog" role="dialog" aria-modal="true" aria-labelledby="info-title">
          <div class="dialog-head">
            <div class="dialog-title"><h2 id="info-title">${page.title}</h2></div>
            <button class="close-btn" id="info-close" type="button" aria-label="Close">${closeIcon()}</button>
          </div>
          <p class="dialog-copy">${page.summary}</p>
          <div class="info-content">${page.email ? `<p><a href="mailto:${page.email}">${page.email}</a></p>` : ''}${page.items.length ? `<ul>${page.items.map((item) => `<li>${item}</li>`).join('')}</ul>` : ''}</div>
        </section>
      </div>`;
    const closeInfo = () => {
      modalRoot.innerHTML = '';
      document.removeEventListener('keydown', onInfoEscape);
      activeInfoTrigger?.focus();
      activeInfoTrigger = null;
    };
    function onInfoEscape(event) {
      if (event.key === 'Escape') closeInfo();
    }
    document.getElementById('info-close').addEventListener('click', closeInfo);
    modalRoot.querySelector('.modal-backdrop').addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-backdrop')) closeInfo();
    });
    document.addEventListener('keydown', onInfoEscape);
    document.getElementById('info-close').focus();
  }

  function openConverter() {
    mode = 'pdf-to-images';
    files = [];
    busy = false;
    renderDialog();
  }

  function renderDialog() {
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="dialog cleaner-dialog" role="dialog" aria-modal="true" aria-labelledby="converter-title">
          <div class="dialog-head">
            <div>
              <div class="dialog-title">
                <span class="tool-icon" style="--icon-bg:#fbf0e7;--icon-color:#bd6637">${converterIcon()}</span>
                <h2 id="converter-title">PDF ↔ Images</h2>
              </div>
              <p class="dialog-copy" id="converter-description">Convert every page in multiple PDFs to images, collected into one ZIP file.</p>
            </div>
            <button class="close-btn" id="converter-close" type="button" aria-label="Close">${closeIcon()}</button>
          </div>
          <div class="mode-switch" role="group" aria-label="Conversion direction">
            <button class="filter-btn active" id="mode-to-images" type="button" aria-pressed="true">PDF to images</button>
            <button class="filter-btn" id="mode-to-pdf" type="button" aria-pressed="false">Images to PDF</button>
          </div>
          <label class="dropzone" id="converter-dropzone" for="converter-file" tabindex="0">
            <input id="converter-file" type="file" accept=".pdf,application/pdf" multiple>
            <span>
              <span class="upload-icon">${uploadIcon()}</span>
              <strong><span id="converter-pick-label">Choose PDF files</span> or drop them here</strong>
              <small id="converter-file-help">Select multiple PDFs. Every page will be exported as a PNG.</small>
            </span>
          </label>
          <div class="file-list" id="converter-file-list" aria-live="polite"></div>
          <div class="field-row" id="image-format-row">
            <label class="field">Image format
              <select id="image-format"><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select>
            </label>
            <label class="field">Image quality
              <select id="render-quality"><option value="256x144">144p</option><option value="640x360">360p</option><option value="1280x720">720p</option><option value="1920x1080" selected>1080p</option></select>
            </label>
          </div>
          <div class="status" id="converter-status" role="status" aria-live="polite"></div>
          <div class="dialog-footer">
            <span class="privacy-note">${privacyIcon()} Files never leave your device</span>
            <button class="primary-btn" id="converter-run" type="button" disabled>Convert files</button>
          </div>
        </section>
      </div>`;

    document.getElementById('converter-close').addEventListener('click', closeConverter);
    modalRoot.querySelector('.modal-backdrop').addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-backdrop')) closeConverter();
    });
    document.addEventListener('keydown', onEscape);
    document.getElementById('mode-to-images').addEventListener('click', () => setMode('pdf-to-images'));
    document.getElementById('mode-to-pdf').addEventListener('click', () => setMode('images-to-pdf'));
    document.getElementById('converter-run').addEventListener('click', convertFiles);

    const dropzone = document.getElementById('converter-dropzone');
    const input = document.getElementById('converter-file');
    input.addEventListener('change', () => {
      addFiles([...input.files]);
      input.value = '';
    });
    dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.click();
      }
    });
    ['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach((name) => dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragging');
    }));
    dropzone.addEventListener('drop', (event) => addFiles([...event.dataTransfer.files]));
    document.getElementById('converter-close').focus();
  }

  function closeConverter() {
    if (busy) return;
    if (window.toolHubPage === 'pdf') {
      window.location.href = './';
      return;
    }
    modalRoot.innerHTML = '';
    files = [];
    document.removeEventListener('keydown', onEscape);
  }

  function onEscape(event) {
    if (event.key === 'Escape' && modalRoot.firstElementChild) closeConverter();
  }

  function setMode(nextMode) {
    if (busy || mode === nextMode) return;
    mode = nextMode;
    files = [];
    const pdfMode = mode === 'pdf-to-images';
    document.getElementById('mode-to-images').classList.toggle('active', pdfMode);
    document.getElementById('mode-to-images').setAttribute('aria-pressed', String(pdfMode));
    document.getElementById('mode-to-pdf').classList.toggle('active', !pdfMode);
    document.getElementById('mode-to-pdf').setAttribute('aria-pressed', String(!pdfMode));
    document.getElementById('converter-file').accept = pdfMode ? '.pdf,application/pdf' : '.jpg,.jpeg,.png,image/jpeg,image/png';
    document.getElementById('converter-description').textContent = pdfMode
      ? 'Convert every page in multiple PDFs to images, collected into one ZIP file.'
      : 'Combine multiple JPG or PNG files into a single PDF, one image per page.';
    document.getElementById('converter-pick-label').textContent = pdfMode ? 'Choose PDF files' : 'Choose image files';
    document.getElementById('converter-file-help').textContent = pdfMode
      ? 'Select multiple PDFs. Every page will be exported as a PNG.'
      : 'Select multiple JPG or PNG images to combine into one PDF.';
    document.getElementById('image-format-row').hidden = !pdfMode;
    document.getElementById('converter-status').textContent = '';
    renderFileList();
  }

  function isSupported(file) {
    return mode === 'pdf-to-images'
      ? file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      : /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
  }

  function addFiles(incoming) {
    if (busy) return;
    const valid = incoming.filter(isSupported);
    const exceedsLimit = files.length + valid.length > 20;
    const next = [...files, ...valid].slice(0, 20);
    files = next.filter((file, index) => next.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size) === index);
    renderFileList();
    if (incoming.length !== valid.length) setStatus(`Some files were skipped. Choose ${mode === 'pdf-to-images' ? 'PDF files' : 'JPG or PNG images'} only.`, true);
    else if (exceedsLimit) setStatus('Up to 20 files can be converted at a time.', true);
  }

  function renderFileList() {
    const list = document.getElementById('converter-file-list');
    if (!list) return;
    list.replaceChildren();
    files.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'file-row';
      const badge = document.createElement('span');
      badge.className = 'file-badge';
      badge.textContent = mode === 'pdf-to-images' ? 'PDF' : 'IMG';
      const metadata = document.createElement('span');
      metadata.className = 'file-meta';
      const name = document.createElement('strong');
      name.textContent = file.name;
      const size = document.createElement('small');
      size.textContent = formatSize(file.size);
      metadata.append(name, size);
      const remove = document.createElement('button');
      remove.className = 'remove-file';
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.innerHTML = trashIcon();
      remove.addEventListener('click', () => {
        if (busy) return;
        files.splice(index, 1);
        renderFileList();
      });
      row.append(badge, metadata, remove);
      list.append(row);
    });
    const runButton = document.getElementById('converter-run');
    if (runButton) runButton.disabled = busy || files.length === 0;
  }

  async function convertFiles() {
    if (busy || !files.length) return;
    if (typeof JSZip === 'undefined' || !window.pdfjsLib || !window.PDFLib) {
      setStatus('A conversion library did not load. Check your connection and reload.', true);
      return;
    }
    const maximumSize = mode === 'pdf-to-images' ? 100 : 100;
    if (files.reduce((total, file) => total + file.size, 0) > maximumSize * 1024 * 1024) {
      setStatus(`Choose files with a combined size under ${maximumSize} MB.`, true);
      return;
    }
    busy = true;
    setControlsDisabled(true);
    const originalMode = mode;
    try {
      if (mode === 'pdf-to-images') await convertPdfsToImages();
      else await convertImagesToPdf();
      if (mode === originalMode) setStatus('Done. Your download is ready.');
    } catch (error) {
      setStatus(error.message || 'Could not convert these files. Check that they are valid and not password-protected.', true);
    } finally {
      busy = false;
      if (modalRoot.firstElementChild) setControlsDisabled(false);
    }
  }

  async function convertPdfsToImages() {
    const zip = new JSZip();
    const outputFormat = document.getElementById('image-format').value;
    const extension = outputFormat === 'image/jpeg' ? 'jpg' : 'png';
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      setStatus(`Opening PDF ${fileIndex + 1} of ${files.length}…`);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const folder = zip.folder(`pdf-${String(fileIndex + 1).padStart(2, '0')}-${safeName(file.name)}`);
      try {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          setStatus(`Converting PDF ${fileIndex + 1} of ${files.length}, page ${pageNumber} of ${pdf.numPages}…`);
          const page = await pdf.getPage(pageNumber);
          const initialViewport = page.getViewport({ scale: 1 });
          const [maxWidth, maxHeight] = document.getElementById('render-quality').value.split('x').map(Number);
          const scale = Math.min(maxWidth / initialViewport.width, maxHeight / initialViewport.height);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext('2d', { alpha: false });
          if (!context) throw new Error('Your browser could not create an image canvas.');
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: context, viewport }).promise;
          const imageBlob = await canvasToBlob(canvas, outputFormat, outputFormat === 'image/jpeg' ? 0.92 : undefined);
          folder.file(`${safeName(file.name)}-page-${String(pageNumber).padStart(4, '0')}.${extension}`, imageBlob);
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();
        }
      } finally {
        await pdf.destroy();
      }
    }
    setStatus('Packing page images into a ZIP file…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } });
    downloadBlob(blob, 'pdf-page-images.zip');
  }

  async function convertImagesToPdf() {
    const output = await PDFLib.PDFDocument.create();
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      setStatus(`Adding image ${index + 1} of ${files.length}…`);
      const bytes = await file.arrayBuffer();
      const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
      const embedded = isPng ? await output.embedPng(bytes) : await output.embedJpg(bytes);
      const pageScale = Math.min(0.75, 1440 / Math.max(embedded.width, embedded.height));
      const width = Math.max(1, embedded.width * pageScale);
      const height = Math.max(1, embedded.height * pageScale);
      const page = output.addPage([width, height]);
      page.drawImage(embedded, { x: 0, y: 0, width, height });
    }
    setStatus('Creating your PDF…');
    const bytes = await output.save();
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'images.pdf');
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not export a page image.')), type, quality);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setControlsDisabled(disabled) {
    document.getElementById('converter-close').disabled = disabled;
    document.getElementById('converter-file').disabled = disabled;
    document.getElementById('mode-to-images').disabled = disabled;
    document.getElementById('mode-to-pdf').disabled = disabled;
    document.getElementById('image-format').disabled = disabled;
    document.getElementById('render-quality').disabled = disabled;
    document.querySelectorAll('#converter-file-list .remove-file').forEach((button) => { button.disabled = disabled; });
    const runButton = document.getElementById('converter-run');
    runButton.disabled = disabled || files.length === 0;
    runButton.textContent = disabled ? 'Converting…' : 'Convert files';
  }

  function setStatus(message, isError = false) {
    const status = document.getElementById('converter-status');
    if (!status) return;
    status.textContent = message;
    status.className = `status${isError ? ' error' : ''}`;
  }

  function formatSize(size) {
    return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function safeName(filename) {
    return filename.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'document';
  }

  function converterIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6M9 15h2m2-3h2m-2 6h2"/></svg>';
  }
  function uploadIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>';
  }
  function closeIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>';
  }
  function trashIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18m-2 0-1 14H6L5 6m3 0V4h8v2m-7 4v6m4-6v6"/></svg>';
  }
  function privacyIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></svg>';
  }
})();
