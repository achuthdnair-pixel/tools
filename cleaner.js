(() => {
  const launchButton = document.getElementById('cleaner-launch');
  const modalRoot = document.getElementById('modal-root');
  const chilluMap = {
    '\u0D15': '\u0D7F', '\u0D23': '\u0D7A', '\u0D28': '\u0D7B',
    '\u0D30': '\u0D7C', '\u0D32': '\u0D7D', '\u0D33': '\u0D7E'
  };
  const partsToClean = /^word\/(document|footnotes|endnotes|comments|header\d*|footer\d*)\.xml$/;
  let selectedFile = null;
  let outputUrl = null;
  let working = false;

  function showCleaner() {
    modalRoot.innerHTML = `
      <div class="modal-backdrop" role="presentation">
        <section class="dialog cleaner-dialog" role="dialog" aria-modal="true" aria-labelledby="cleaner-title">
          <div class="dialog-head">
            <div>
              <div class="dialog-title">
                <span class="tool-icon cleaner-logo-frame"><img class="tool-logo" src="logo-icon.svg" alt=""></span>
                <h2 id="cleaner-title">Malayalam DOCX Cleaner</h2>
              </div>
              <p class="dialog-copy">Normalize Unicode Malayalam in a Word file. It runs in your browser; the file is never uploaded.</p>
            </div>
            <button class="close-btn" id="cleaner-close" type="button" aria-label="Close">${closeIcon()}</button>
          </div>
          <label class="dropzone" id="docx-dropzone" for="docx-file" tabindex="0">
            <input id="docx-file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
            <span>
              <span class="upload-icon">${uploadIcon()}</span>
              <strong><span>Choose a .docx file</span> or drop it here</strong>
              <small>Text, headers, footers, footnotes and comments are cleaned. Formatting stays as is.</small>
            </span>
          </label>
          <p class="file-name" id="docx-filename" aria-live="polite"></p>
          <fieldset class="cleaner-options">
            <legend>Cleaning options</legend>
            <label class="cleaner-option"><input type="checkbox" data-option="nfc" checked><span>Unicode NFC normalization<small>Composes split vowel signs, e.g. െ + ാ → ൊ.</small></span></label>
            <label class="cleaner-option"><input type="checkbox" data-option="chillu" checked><span>Convert old chillu sequences to atomic chillu<small>Converts ന, ണ, ര, ല, ള, or ക + ് + ZWJ to its atomic chillu.</small></span></label>
            <label class="cleaner-option"><input type="checkbox" data-option="vowel" checked><span>Fix doubled vowel sign<small>െ + െ → ൈ</small></span></label>
            <label class="cleaner-option"><input type="checkbox" data-option="zw" checked><span>Remove invisible junk characters<small>Zero-width space, BOM, soft hyphen, and repeated or leading ZWJ/ZWNJ.</small></span></label>
            <label class="cleaner-option"><input type="checkbox" data-option="nbsp"><span>Replace non-breaking spaces with normal spaces</span></label>
            <label class="cleaner-option"><input type="checkbox" data-option="space" checked><span>Collapse repeated spaces</span></label>
          </fieldset>
          <div class="cleaner-actions">
            <button class="primary-btn" id="cleaner-run" type="button" disabled>Clean file</button>
            <a class="download-link" id="cleaner-download" hidden>Download cleaned file</a>
          </div>
          <div class="status" id="cleaner-status" role="status" aria-live="polite"></div>
          <section class="result-panel" id="cleaner-results" aria-live="polite" hidden>
            <h3>What changed</h3>
            <ul class="stats-grid" id="cleaner-stats"></ul>
            <div id="cleaner-samples"></div>
          </section>
        </section>
      </div>`;

    document.getElementById('cleaner-close').addEventListener('click', closeCleaner);
    modalRoot.querySelector('.modal-backdrop').addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-backdrop')) closeCleaner();
    });
    document.addEventListener('keydown', onEscape);

    const dropzone = document.getElementById('docx-dropzone');
    const fileInput = document.getElementById('docx-file');
    fileInput.addEventListener('change', () => chooseFile(fileInput.files[0]));
    dropzone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
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
    dropzone.addEventListener('drop', (event) => chooseFile(event.dataTransfer.files[0]));
    document.getElementById('cleaner-run').addEventListener('click', cleanDocument);
    document.getElementById('cleaner-close').focus();
  }

  function closeCleaner() {
    if (working) return;
    if (window.toolHubPage === 'cleaner') {
      window.location.href = './';
      return;
    }
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
    selectedFile = null;
    modalRoot.innerHTML = '';
    document.removeEventListener('keydown', onEscape);
  }

  function onEscape(event) {
    if (event.key === 'Escape' && modalRoot.firstElementChild) closeCleaner();
  }

  function chooseFile(file) {
    selectedFile = null;
    const runButton = document.getElementById('cleaner-run');
    const downloadLink = document.getElementById('cleaner-download');
    const results = document.getElementById('cleaner-results');
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) {
      setStatus('Choose a .docx file. Older .doc files must be saved as .docx in Word first.', true);
      document.getElementById('docx-filename').textContent = '';
      runButton.disabled = true;
      downloadLink.hidden = true;
      results.hidden = true;
      return;
    }
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
    selectedFile = file;
    document.getElementById('docx-filename').textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
    runButton.disabled = false;
    downloadLink.hidden = true;
    results.hidden = true;
    setStatus('');
  }

  function getOptions() {
    return Object.fromEntries([...document.querySelectorAll('[data-option]')].map((input) => [input.dataset.option, input.checked]));
  }

  function cleanText(text, options, stats) {
    let result = text;
    if (options.zw) {
      result = result.replace(/[\u200B\uFEFF\u00AD]/g, () => { stats.zw++; return ''; });
    }
    if (options.nbsp) {
      result = result.replace(/\u00A0/g, () => { stats.nbsp++; return ' '; });
    }
    if (options.chillu) {
      result = result.replace(/([\u0D15\u0D23\u0D28\u0D30\u0D32\u0D33])\u0D4D\u200D/g, (match, letter) => {
        stats.chillu++;
        return chilluMap[letter];
      });
    }
    if (options.nfc) {
      const normalized = result.normalize('NFC');
      if (normalized !== result) stats.nfc++;
      result = normalized;
    }
    if (options.vowel) {
      result = result.replace(/\u0D46\u0D46/g, () => { stats.vowel++; return '\u0D48'; });
    }
    if (options.zw) {
      result = result.replace(/([\u200C\u200D])\1+/g, (match, character) => {
        stats.zw += match.length - 1;
        return character;
      });
      result = result.replace(/(^|[ \t])[\u200C\u200D]+/g, (match, prefix) => {
        stats.zw += match.length - prefix.length;
        return prefix;
      });
    }
    if (options.space) {
      result = result.replace(/ {2,}/g, () => { stats.space++; return ' '; });
    }
    return result;
  }

  function decodeXmlText(text) {
    return text.replace(/&#(?:x([\da-f]{1,6})|(\d+));/gi, (match, hex, decimal) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return codePoint <= 0x10FFFF ? String.fromCodePoint(codePoint) : match;
    }).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }

  function encodeXmlText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function cleanXml(xml, options, stats, samples) {
    return xml.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (match, opening, body, closing) => {
      const original = decodeXmlText(body);
      const cleaned = cleanText(original, options, stats);
      if (cleaned === original) return match;
      if (samples.length < 6 && /[\u0D00-\u0D7F]/.test(original)) {
        samples.push([original.slice(0, 80), cleaned.slice(0, 80)]);
      }
      if (!/\bxml:space\s*=/.test(opening)) opening = opening.replace(/>$/, ' xml:space="preserve">');
      return `${opening}${encodeXmlText(cleaned)}${closing}`;
    });
  }

  async function cleanDocument() {
    if (!selectedFile || working) return;
    if (typeof JSZip === 'undefined') {
      setStatus('The ZIP library did not load. Check your connection and reload.', true);
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setStatus('Choose a DOCX file smaller than 50 MB.', true);
      return;
    }
    working = true;
    const runButton = document.getElementById('cleaner-run');
    runButton.disabled = true;
    runButton.textContent = 'Cleaning…';
    document.getElementById('cleaner-close').disabled = true;
    document.getElementById('docx-file').disabled = true;
    document.querySelector('.cleaner-options').disabled = true;
    setStatus('Cleaning locally on your device…');
    const stats = { nfc: 0, chillu: 0, vowel: 0, zw: 0, nbsp: 0, space: 0 };
    const samples = [];
    try {
      const zip = await JSZip.loadAsync(await selectedFile.arrayBuffer());
      const names = Object.keys(zip.files).filter((name) => partsToClean.test(name) && !zip.files[name].dir);
      if (!names.length) throw new Error('This does not look like a Word document.');
      const options = getOptions();
      await Promise.all(names.map(async (name) => {
        const xml = await zip.file(name).async('string');
        zip.file(name, cleanXml(xml, options, stats, samples));
      }));
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = URL.createObjectURL(blob);
      const downloadLink = document.getElementById('cleaner-download');
      downloadLink.href = outputUrl;
      downloadLink.download = `${selectedFile.name.replace(/\.docx$/i, '')}-cleaned.docx`;
      downloadLink.hidden = false;
      showResults(stats, samples);
      setStatus('Done. Download your cleaned file.');
    } catch (error) {
      setStatus(`Could not process this file: ${error.message || 'unknown error'}`, true);
    } finally {
      working = false;
      const currentButton = document.getElementById('cleaner-run');
      if (currentButton) {
        currentButton.disabled = !selectedFile;
        currentButton.textContent = 'Clean file';
        document.getElementById('cleaner-close').disabled = false;
        document.getElementById('docx-file').disabled = false;
        document.querySelector('.cleaner-options').disabled = false;
      }
    }
  }

  function showResults(stats, samples) {
    const labels = [
      ['NFC fixes', stats.nfc], ['Chillu converted', stats.chillu], ['Vowel signs fixed', stats.vowel],
      ['Invisible characters removed', stats.zw], ['Non-breaking spaces', stats.nbsp], ['Extra spaces', stats.space]
    ];
    const statsList = document.getElementById('cleaner-stats');
    statsList.replaceChildren();
    labels.forEach(([label, count]) => {
      const item = document.createElement('li');
      const value = document.createElement('strong');
      value.textContent = count;
      item.append(value, document.createTextNode(label));
      statsList.append(item);
    });
    const sampleContainer = document.getElementById('cleaner-samples');
    sampleContainer.replaceChildren();
    if (samples.length) {
      const heading = document.createElement('h3');
      heading.style.marginTop = '14px';
      heading.textContent = 'Examples';
      sampleContainer.append(heading);
      samples.forEach(([before, after]) => {
        const comparison = document.createElement('div');
        comparison.className = 'comparison';
        [[before, 'Before'], [after, 'After']].forEach(([text, label]) => {
          const panel = document.createElement('div');
          const caption = document.createElement('em');
          caption.textContent = label;
          panel.append(caption, document.createTextNode(text));
          comparison.append(panel);
        });
        sampleContainer.append(comparison);
      });
    } else {
      const note = document.createElement('p');
      note.className = 'section-caption';
      note.textContent = 'No changes were needed with the selected options.';
      sampleContainer.append(note);
    }
    document.getElementById('cleaner-results').hidden = false;
  }

  function setStatus(message, isError = false) {
    const status = document.getElementById('cleaner-status');
    if (!status) return;
    status.textContent = message;
    status.className = `status${isError ? ' error' : ''}`;
  }

  function cleanerIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6M9 14l2 2 4-4"/></svg>';
  }
  function uploadIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg>';
  }
  function closeIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>';
  }

  launchButton.addEventListener('click', () => window.toolHubNavigate('cleaner'));
  if (window.toolHubPage === 'cleaner') showCleaner();
})();
