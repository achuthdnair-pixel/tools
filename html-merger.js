(() => {
  const modalRoot = document.getElementById('modal-root');
  const launchButton = document.getElementById('html-merger-launch');
  let files = [];
  let busy = false;

  launchButton.addEventListener('click', () => window.toolHubNavigate('html'));
  if (window.toolHubPage === 'html') openMerger();

  function openMerger() {
    files = [];
    busy = false;
    renderDialog();
  }

  function renderDialog() {
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="dialog cleaner-dialog" role="dialog" aria-modal="true" aria-labelledby="html-merger-title">
          <div class="dialog-head">
            <div>
              <div class="dialog-title">
                <span class="tool-icon" style="--icon-bg:#3b3020;--icon-color:#f4c36e">${mergerIcon()}</span>
                <h2 id="html-merger-title">HTML Merger</h2>
              </div>
              <p class="dialog-copy">Combine multiple HTML files into one document. Files stay on your device.</p>
            </div>
            <button class="close-btn" id="html-merger-close" type="button" aria-label="Close">${closeIcon()}</button>
          </div>
          <label class="dropzone" id="html-dropzone" for="html-files" tabindex="0">
            <input id="html-files" type="file" accept=".html,.htm,text/html" multiple>
            <span>
              <span class="upload-icon">${uploadIcon()}</span>
              <strong><span>Choose HTML files</span> or drop them here</strong>
              <small>Select multiple files in merge order, or use the folder button below.</small>
            </span>
          </label>
          <div class="html-folder-row">
            <input id="html-folder" class="visually-hidden-file" type="file" accept=".html,.htm,text/html" webkitdirectory directory multiple tabindex="-1">
            <button class="filter-btn" id="html-folder-button" type="button">Choose folder</button>
            <span class="section-caption">HTML files in the folder are sorted by name.</span>
          </div>
          <div class="file-list" id="html-file-list" aria-live="polite"></div>
          <div class="field-row">
            <label class="field">Merge mode
              <select id="html-merge-mode"><option value="body">Merge page bodies</option><option value="concat">Concatenate raw HTML</option></select>
            </label>
            <label class="field">Output filename
              <input id="html-output-name" type="text" value="merged.html" maxlength="120">
            </label>
          </div>
          <div class="status" id="html-merger-status" role="status" aria-live="polite"></div>
          <div class="dialog-footer">
            <span class="privacy-note">${privacyIcon()} Files never leave your device</span>
            <button class="primary-btn" id="html-merger-run" type="button" disabled>Merge files</button>
          </div>
        </section>
      </div>`;

    const closeButton = document.getElementById('html-merger-close');
    closeButton.addEventListener('click', closeMerger);
    modalRoot.querySelector('.modal-backdrop').addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-backdrop')) closeMerger();
    });
    document.addEventListener('keydown', onEscape);

    const dropzone = document.getElementById('html-dropzone');
    const filesInput = document.getElementById('html-files');
    const folderInput = document.getElementById('html-folder');
    filesInput.addEventListener('change', () => {
      addFiles([...filesInput.files]);
      filesInput.value = '';
    });
    folderInput.addEventListener('change', () => {
      const folderFiles = [...folderInput.files]
        .filter(isHtmlFile)
        .sort((left, right) => (left.webkitRelativePath || left.name).localeCompare(right.webkitRelativePath || right.name, undefined, { numeric: true, sensitivity: 'base' }));
      addFiles(folderFiles, true);
      folderInput.value = '';
    });
    document.getElementById('html-folder-button').addEventListener('click', () => folderInput.click());
    dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        filesInput.click();
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
    document.getElementById('html-merger-run').addEventListener('click', mergeFiles);
    closeButton.focus();
  }

  function closeMerger() {
    if (busy) return;
    if (window.toolHubPage === 'html') {
      window.location.href = './';
      return;
    }
    modalRoot.innerHTML = '';
    files = [];
    document.removeEventListener('keydown', onEscape);
  }

  function onEscape(event) {
    if (event.key === 'Escape' && modalRoot.firstElementChild) closeMerger();
  }

  function isHtmlFile(file) {
    return /\.html?$/i.test(file.name);
  }

  function addFiles(incoming, replace = false) {
    if (busy) return;
    const accepted = incoming.filter(isHtmlFile);
    const next = replace ? accepted : [...files, ...accepted];
    files = next.filter((file, index) => next.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified) === index);
    renderFiles();
    if (incoming.length !== accepted.length) setStatus('Only .html and .htm files are supported.', true);
  }

  function renderFiles() {
    const list = document.getElementById('html-file-list');
    if (!list) return;
    list.replaceChildren();
    files.forEach((file, index) => {
      const row = document.createElement('div');
      row.className = 'file-row';
      const badge = document.createElement('span');
      badge.className = 'file-badge';
      badge.textContent = 'HTML';
      const metadata = document.createElement('span');
      metadata.className = 'file-meta';
      const name = document.createElement('strong');
      name.textContent = file.webkitRelativePath || file.name;
      const size = document.createElement('small');
      size.textContent = formatSize(file.size);
      metadata.append(name, size);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-file';
      remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.innerHTML = trashIcon();
      remove.addEventListener('click', () => {
        if (busy) return;
        files.splice(index, 1);
        renderFiles();
      });
      row.append(badge, metadata, remove);
      list.append(row);
    });
    const runButton = document.getElementById('html-merger-run');
    if (runButton) runButton.disabled = busy || files.length < 2;
    if (files.length === 1) setStatus('Choose at least one more HTML file to merge.');
    else if (!files.length) setStatus('');
  }

  async function mergeFiles() {
    if (busy || files.length < 2) return;
    busy = true;
    setControlsDisabled(true);
    try {
      const inputs = await Promise.all(files.map(async (file) => ({
        name: file.webkitRelativePath || file.name,
        content: await file.text()
      })));
      const mode = document.getElementById('html-merge-mode').value;
      const result = merge(inputs, mode);
      const outputName = normalizeOutputName(document.getElementById('html-output-name').value);
      downloadBlob(new Blob([result], { type: 'text/html;charset=utf-8' }), outputName);
      setStatus(`Merged ${inputs.length} files into ${outputName}.`);
    } catch (error) {
      setStatus(`Could not merge these files: ${error.message || 'unknown error'}`, true);
    } finally {
      busy = false;
      if (modalRoot.firstElementChild) setControlsDisabled(false);
    }
  }

  function merge(inputs, mode) {
    if (mode === 'concat') {
      return inputs.map((file) => `<!-- ===== ${safeComment(file.name)} ===== -->\n${file.content.trim()}`).join('\n\n');
    }
    const bodies = inputs.map((file) => `<!-- ===== ${safeComment(file.name)} ===== -->\n<section>\n${extractBody(file.content)}\n</section>`).join('\n\n');
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Merged document</title>\n${cleanHeads(inputs)}\n</head>\n<body>\n${bodies}\n</body>\n</html>\n`;
  }

  function extractBody(html) {
    const match = html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
    return match ? match[1].trim() : html.trim();
  }

  function extractHead(html) {
    const match = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
    return match ? match[1].trim() : '';
  }

  function cleanHeads(inputs) {
    const seen = new Set();
    const output = [];
    inputs.forEach((file) => {
      const head = extractHead(file.content)
        .replace(/<meta\b[^>]*charset[^>]*>/gi, '')
        .replace(/<meta\b[^>]*name=["']viewport["'][^>]*>/gi, '')
        .replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, '');
      head.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          output.push(line);
        }
      });
    });
    return output.join('\n');
  }

  function safeComment(name) {
    return name.replace(/--/g, '- -').replace(/>/g, '&gt;');
  }

  function normalizeOutputName(value) {
    const filename = value.trim().replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-').replace(/\.+$/, '');
    const base = filename || 'merged';
    return /\.html?$/i.test(base) ? base : `${base}.html`;
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
    document.getElementById('html-merger-close').disabled = disabled;
    document.getElementById('html-files').disabled = disabled;
    document.getElementById('html-folder').disabled = disabled;
    document.getElementById('html-folder-button').disabled = disabled;
    document.getElementById('html-merge-mode').disabled = disabled;
    document.getElementById('html-output-name').disabled = disabled;
    document.querySelectorAll('#html-file-list .remove-file').forEach((button) => { button.disabled = disabled; });
    const runButton = document.getElementById('html-merger-run');
    runButton.disabled = disabled || files.length < 2;
    runButton.textContent = disabled ? 'Merging…' : 'Merge files';
  }

  function setStatus(message, error = false) {
    const status = document.getElementById('html-merger-status');
    if (!status) return;
    status.textContent = message;
    status.className = `status${error ? ' error' : ''}`;
  }

  function formatSize(size) {
    return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function mergerIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8 4 12l4 4m8-8 4 4-4 4m-3-11-2 14"/></svg>';
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
