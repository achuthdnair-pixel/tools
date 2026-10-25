(function () {
  const launchButton = document.getElementById('image-resizer-launch');
  if (launchButton) launchButton.addEventListener('click', () => window.toolHubNavigate('image'));
  if (window.toolHubPage !== 'image') return;

  document.getElementById('modal-root').innerHTML = `
    <div class="modal-backdrop">
      <section class="dialog cleaner-dialog" aria-labelledby="image-resizer-title">
        <div class="dialog-head">
          <div>
            <div class="dialog-title">
              <span class="tool-icon" style="--icon-bg:#3b2431;--icon-color:#ff9db9"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>
              <h2 id="image-resizer-title">Image Resizer</h2>
            </div>
            <p class="dialog-copy">Crop and resize an image for print, social media, or a custom size. Your image stays on this device.</p>
          </div>
        </div>
        <div id="drop" class="dropzone" role="button" tabindex="0" aria-label="Choose an image">
          <input id="file" class="visually-hidden-file" type="file" accept="image/*" tabindex="-1">
          <span><span class="upload-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg></span><strong><span>Choose an image</span> or drop it here</strong><small>JPG, PNG, or WebP · drag the preview to reposition</small></span>
        </div>
        <section id="stage" class="image-stage">
          <div class="image-stage-head"><h3>Crop preview</h3><span id="info" class="image-info" role="status" aria-live="polite"></span></div>
          <div class="image-workspace">
            <div class="image-preview-wrap"><canvas id="view" aria-label="Image crop preview"></canvas></div>
            <aside class="image-side-controls">
              <div class="image-resizer-controls">
                <label class="field">Preset size<select id="preset"></select></label>
                <button class="filter-btn" id="pdel" type="button" style="display:none">Delete preset</button>
                <div id="custom" class="custom-fields">
                  <label class="field">Width<input id="cw" type="number" min="1" value="1080"></label>
                  <label class="field">Height<input id="ch" type="number" min="1" value="1080"></label>
                  <label class="field">Units<select id="cu"><option value="px">Pixels</option><option value="mm">Millimeters</option><option value="cm">Centimeters</option><option value="in">Inches</option></select></label>
                </div>
                <label class="field">Output format<select id="fmt"><option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option></select></label>
                <label class="field">Maximum file size (KB)<input id="maxkb" type="number" min="1" placeholder="No limit"></label>
                <div class="preset-actions"><label class="field">Save custom preset<input id="pname" type="text" maxlength="50" placeholder="Preset name"></label><button class="filter-btn" id="psave" type="button">Save</button></div>
              </div>
              <label class="field">Zoom <input id="zoom" type="range" min="1" max="3" step="0.01" value="1"></label>
              <div class="image-resizer-controls">
                <label class="field">Print resolution (DPI)<input id="dpi" type="number" min="30" max="1200" value="300"></label>
                <label class="field">Quick DPI<select id="dpiq"><option value="">Custom</option><option value="72">72</option><option value="150">150</option><option value="300">300</option><option value="600">600</option></select></label>
              </div>
              <label class="field">JPEG / WebP quality <input id="q" type="range" min="50" max="100" value="98"></label>
              <button class="primary-btn image-download" id="dl" type="button" disabled>Download resized image</button>
            </aside>
          </div>
        </section>
      </section>
    </div>`;

  const BASE = [
    ['Passport size (35 × 45 mm)', 35, 45, 'mm', 0, 'Sizes'],
    ['PAN / Aadhaar photo (25 × 35 mm)', 25, 35, 'mm', 0, 'Sizes'],
    ['Kerala PSC photo (150 × 200 px, max 30 KB)', 150, 200, 'px', 30, 'Sizes'],
    ['Instagram post – square (1080 × 1080 px)', 1080, 1080, 'px', 0, 'Sizes'],
    ['Instagram post – portrait (1080 × 1350 px)', 1080, 1350, 'px', 0, 'Sizes'],
    ['Instagram story (1080 × 1920 px)', 1080, 1920, 'px', 0, 'Sizes'],
    ['YouTube thumbnail (1280 × 720 px)', 1280, 720, 'px', 0, 'Sizes'],
    ['Custom…', 0, 0, 'custom', 0, 'Other']
  ];
  const $ = id => document.getElementById(id);
  const drop = $('drop'), file = $('file'), view = $('view'), stage = $('stage');
  const preset = $('preset'), zoom = $('zoom'), info = $('info'), dl = $('dl');
  let PRESETS = [], USER = [];
  const STORE = 'photoResizerPresets';
  try { USER = JSON.parse(localStorage.getItem(STORE) || '[]'); if (!Array.isArray(USER)) USER = []; } catch (e) { USER = []; }
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(USER)); return true; } catch (e) { return false; } };

  // Built-in presets + the person's saved ones (before the final "Custom…" entry)
  function rebuild(sel) {
    PRESETS = BASE.slice(0, -1).concat(USER.map(u => [u.name, u.w, u.h, u.u, u.kb || 0, 'My presets', true]), BASE.slice(-1));
    preset.innerHTML = '';
    let grp = null, grpEl = null;
    PRESETS.forEach((p, i) => {
      if (p[5] !== grp) { grp = p[5]; grpEl = document.createElement('optgroup'); grpEl.label = grp; preset.appendChild(grpEl); }
      grpEl.appendChild(new Option(p[0], i));
    });
    preset.value = sel || 0;
    $('custom').style.display = PRESETS[preset.value][3] === 'custom' ? 'block' : 'none';
    $('pdel').style.display = PRESETS[preset.value][6] ? 'block' : 'none';
  }
  rebuild(0);

  $('psave').addEventListener('click', () => {
    const name = $('pname').value.trim(), w = +$('cw').value, h = +$('ch').value;
    if (!name || !(w > 0) || !(h > 0)) { info.textContent = 'Enter a name and a valid width and height to save a preset.'; info.className = 'info warn'; return; }
    USER = USER.filter(u => u.name.toLowerCase() !== name.toLowerCase());
    USER.push({ name, w, h, u: $('cu').value, kb: +$('maxkb').value || 0 });
    const ok = persist();
    rebuild(BASE.length - 1 + USER.length - 1);
    $('pname').value = ''; draw();
    info.textContent = 'Saved preset “' + name + '”' + (ok ? '' : ' (this browser blocked storage, so it will be lost when you close the page)');
    info.className = 'info';
  });
  $('pdel').addEventListener('click', () => {
    const i = +preset.value - (BASE.length - 1);
    if (i < 0 || i >= USER.length) return;
    const nm = USER[i].name;
    USER.splice(i, 1); persist(); rebuild(0); draw();
    info.textContent = 'Deleted preset “' + nm + '”'; info.className = 'info';
  });

  let img = null, name = 'photo', cx = 0, cy = 0;

  function target() {
    const p = PRESETS[preset.value];
    let w, h, u;
    if (p[3] === 'custom') { w = +$('cw').value; h = +$('ch').value; u = $('cu').value; }
    else { w = p[1]; h = p[2]; u = p[3]; }
    const dpi = Math.min(1200, Math.max(30, +$('dpi').value || 300));
    const f = u === 'mm' ? dpi / 25.4 : u === 'cm' ? dpi / 2.54 : u === 'in' ? dpi : 1;
    return { W: Math.max(1, Math.round(w * f)), H: Math.max(1, Math.round(h * f)), dpi: u === 'px' ? null : dpi, label: w + 'x' + h + u };
  }

  // View rectangle in source-image coordinates
  function viewRect(W, H) {
    const a = W / H, ia = img.width / img.height, z = +zoom.value;
    let vw, vh;
    if (ia > a) { vh = img.height; vw = vh * a; } else { vw = img.width; vh = vw / a; }
    vw /= z; vh /= z;
    if (z >= 1) { cx = Math.min(Math.max(cx, vw / 2), img.width - vw / 2); cy = Math.min(Math.max(cy, vh / 2), img.height - vh / 2); }
    else { cx = Math.min(Math.max(cx, 0), img.width); cy = Math.min(Math.max(cy, 0), img.height); }
    return { vx: cx - vw / 2, vy: cy - vh / 2, vw, vh };
  }

  // High-quality render: stepwise halving avoids aliasing, white fill for any empty margin
  function render(W, H, pyramid) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const { vx, vy, vw } = viewRect(W, H);
    const k = W / vw;
    let cur = img, s = 1;
    if (pyramid) {
      while (k / s < 0.5) {
        const n = document.createElement('canvas');
        n.width = Math.max(1, Math.round(cur.width / 2)); n.height = Math.max(1, Math.round(cur.height / 2));
        const ng = n.getContext('2d'); ng.imageSmoothingEnabled = true; ng.imageSmoothingQuality = 'high';
        ng.drawImage(cur, 0, 0, n.width, n.height);
        cur = n; s *= 0.5;
      }
    }
    g.drawImage(cur, -vx * k, -vy * k, img.width * k, img.height * k);
    return c;
  }

  function draw() {
    if (!img) return;
    const t = target();
    const pw = Math.min(340, stage.clientWidth || 340);
    view.width = pw; view.height = Math.round(pw * t.H / t.W);
    view.getContext('2d').drawImage(render(view.width, view.height, false), 0, 0);
    let msg = t.W + ' × ' + t.H + ' px output';
    const scale = t.W / viewRect(t.W, t.H).vw;
    if (scale > 1) msg += ' – source is smaller than the target, so it will be enlarged';
    info.textContent = msg; info.className = 'info' + (scale > 1 ? ' warn' : '');
  }

  async function load(f) {
    if (!f || !f.type.startsWith('image/')) { info.textContent = 'Please choose an image file.'; return; }
    try { img = await createImageBitmap(f); } catch (e) { info.textContent = 'Could not read that image.'; return; }
    name = f.name.replace(/\.[^.]+$/, '');
    cx = img.width / 2; cy = img.height / 2; zoom.value = 1;
    stage.style.display = 'block'; dl.disabled = false;
    draw();
  }

  drop.addEventListener('click', () => file.click());
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); load(e.dataTransfer.files[0]); });
  file.addEventListener('change', e => { load(e.target.files[0]); file.value = ''; });

  preset.addEventListener('change', () => { $('pdel').style.display = PRESETS[preset.value][6] ? 'block' : 'none'; $('maxkb').value = PRESETS[preset.value][4] || ''; if (PRESETS[preset.value][4]) $('fmt').value = 'jpeg'; $('custom').style.display = PRESETS[preset.value][3] === 'custom' ? 'block' : 'none'; draw(); });
  ['cw', 'ch', 'cu', 'dpi', 'zoom'].forEach(id => $(id).addEventListener('input', draw));
  // Keep DPI number and quick-pick in sync
  function setDpi(v) {
    v = Math.min(1200, Math.max(30, Math.round(+v) || 300));
    $('dpi').value = v;
    $('dpiq').value = [...$('dpiq').options].some(o => +o.value === v) ? v : '';
  }
  $('dpiq').addEventListener('change', () => { if ($('dpiq').value) { setDpi($('dpiq').value); draw(); } });
  $('dpi').addEventListener('change', () => { setDpi($('dpi').value); draw(); });
  $('dpi').addEventListener('input', () => { const v = +$('dpi').value; if (v >= 30 && v <= 1200) $('dpiq').value = [...$('dpiq').options].some(o => +o.value === v) ? v : ''; });

  // Drag to pan
  let drag = null;
  view.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; view.setPointerCapture(e.pointerId); view.style.cursor = 'grabbing'; });
  view.addEventListener('pointerup', () => { drag = null; view.style.cursor = 'grab'; });
  view.addEventListener('pointermove', e => {
    if (!drag || !img) return;
    const t = target(), r = view.getBoundingClientRect();
    const k = (view.width / r.width) * (view.width / viewRect(t.W, t.H).vw);
    cx -= (e.clientX - drag.x) * (view.width / r.width) / (view.width / viewRect(t.W, t.H).vw);
    cy -= (e.clientY - drag.y) * (view.width / r.width) / (view.width / viewRect(t.W, t.H).vw);
    drag = { x: e.clientX, y: e.clientY };
    draw();
  });
  window.addEventListener('resize', draw);

  const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));

  // Write DPI into the JPEG's JFIF header so print software reads the right physical size
  async function setJpegDpi(blob, dpi) {
    if (!dpi) return blob;
    const b = new Uint8Array(await blob.arrayBuffer());
    if (b[2] === 0xFF && b[3] === 0xE0 && b[6] === 0x4A) {
      b[13] = 1; b[14] = dpi >> 8; b[15] = dpi & 255; b[16] = dpi >> 8; b[17] = dpi & 255;
    }
    return new Blob([b], { type: 'image/jpeg' });
  }

  dl.addEventListener('click', async () => {
    if (!img) return;
    dl.disabled = true; info.textContent = 'Processing…'; info.className = 'info';
    await new Promise(r => setTimeout(r, 20));
    const t = target(), c = render(t.W, t.H, true), png = $('fmt').value === 'png';
    const mime = $('fmt').value === 'webp' ? 'image/webp' : 'image/jpeg';
    let blob, q = Math.min(100, Math.max(50, +$('q').value || 98)) / 100, note = '';
    if (png) blob = await toBlob(c, 'image/png');
    else {
      blob = await toBlob(c, mime, q);
      const max = (+$('maxkb').value || 0) * 1024;
      if (max && blob.size > max) {
        let lo = 0.3, hi = q, best = null;
        for (let i = 0; i < 8; i++) {
          const m = (lo + hi) / 2, bl = await toBlob(c, mime, m);
          if (bl.size <= max) { best = bl; lo = m; } else hi = m;
        }
        if (best) { blob = best; note = ' (quality lowered to fit size limit)'; }
        else note = ' – could not reach the size limit; try a smaller size or lower DPI';
      }
      if (mime === 'image/jpeg') blob = await setJpegDpi(blob, t.dpi);
      else if (blob.type !== 'image/webp') note = ' (this browser can\u2019t make WebP, saved as PNG)';
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '-' + t.label + ({ 'image/png': '.png', 'image/webp': '.webp' }[blob.type] || '.jpg');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    info.textContent = 'Saved ' + t.W + ' × ' + t.H + ' px, ' + Math.round(blob.size / 1024) + ' KB' + note;
    dl.disabled = false;
  });
})();
