(() => {
  const launchButton = document.getElementById('file-converter-launch');
  if (launchButton) launchButton.addEventListener('click', () => window.toolHubNavigate('file-converter'));
  if (window.toolHubPage !== 'file-converter') return;

  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <section class="dialog cleaner-dialog file-converter" aria-labelledby="file-converter-title">
        <div class="dialog-head">
          <div>
            <div class="dialog-title">
              <span class="tool-icon" style="--icon-bg:#3a2825;--icon-color:#ff9b7c"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h6M9 13h6m-6 4h6"/><path d="M3 8v12a2 2 0 0 0 2 2h10"/></svg></span>
              <h2 id="file-converter-title">File Converter</h2>
            </div>
            <p class="dialog-copy">Convert documents, spreadsheets, PDFs, and images. Files stay in your browser.</p>
          </div>
        </div>
        <section class="fc-card">
          <h3 class="fc-step"><span>1</span>Choose a conversion</h3>
          <div class="fc-modes" id="fc-modes"></div>
        </section>
        <section class="fc-card">
          <h3 class="fc-step"><span>2</span>Add your files</h3>
          <div class="dropzone" id="fc-drop" role="button" tabindex="0" aria-label="Choose files">
            <input id="fc-file" type="file" hidden>
            <span><span class="upload-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/></svg></span><strong><span>Choose files</span> or drop them here</strong><small id="fc-hint"></small></span>
          </div>
          <ul class="fc-file-list" id="fc-list"></ul>
          <label class="fc-option" id="fc-combine-row"><input id="fc-combine" type="checkbox" checked> Combine all files into one (clear to convert separately)</label>
          <label class="fc-quality" id="fc-quality-row"><span>Quality</span><select id="fc-quality"><option value="low">Low · smallest files</option><option value="medium">Medium</option><option value="high" selected>High</option><option value="max">Maximum · largest files</option></select></label>
          <button class="primary-btn fc-go" id="fc-go" type="button" disabled>Convert files</button>
          <div class="status" id="fc-status" role="status" aria-live="polite"></div>
        </section>
        <section class="fc-card" id="fc-results-card" hidden>
          <h3 class="fc-step"><span>3</span>Your converted files</h3>
          <ul class="fc-file-list" id="fc-results"></ul>
          <p class="section-caption" id="fc-note"></p>
        </section>
      </section>
    </div>`;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value).replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
  const base = (filename) => filename.replace(/\.[^.]+$/, '');
  const formatSize = (size) => size < 1048576 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1048576).toFixed(1)} MB`;
  const quality = { low: { scale: 1, jpeg: 0.6 }, medium: { scale: 1.5, jpeg: 0.8 }, high: { scale: 2, jpeg: 0.92 }, max: { scale: 3, jpeg: 0.98 } };
  const currentQuality = () => quality[$('fc-quality').value] || quality.high;
  const pdfWorkerUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  async function openPdf(file) {
    return pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  }

  async function extractPdfText(pdf) {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setStatus(`Reading page ${pageNumber} of ${pdf.numPages}…`);
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      const items = content.items.filter((item) => item.str && item.str.trim()).map((item) => ({
        x: item.transform[4], y: item.transform[5], w: item.width,
        h: Math.abs(item.transform[3]) || item.height || 10, text: item.str
      })).sort((left, right) => right.y - left.y || left.x - right.x);
      const lines = [];
      for (const item of items) {
        const line = lines[lines.length - 1];
        if (line && Math.abs(line.y - item.y) <= Math.max(2, item.h * 0.5)) line.items.push(item);
        else lines.push({ y: item.y, h: item.h, items: [item] });
      }
      for (const line of lines) {
        line.items.sort((left, right) => left.x - right.x);
        line.cells = [];
        let end = null;
        for (const item of line.items) {
          const gap = end === null ? 0 : item.x - end;
          if (end === null || gap > line.h * 1.5) line.cells.push({ x: item.x, text: item.text });
          else line.cells[line.cells.length - 1].text += (gap > line.h * 0.15 ? ' ' : '') + item.text;
          end = item.x + item.w;
        }
      }
      pages.push(lines);
    }
    if (!pages.some((page) => page.length)) throw new Error('No selectable text found. This PDF may be scanned; OCR is not supported.');
    return pages;
  }

  function paragraphs(lines) {
    const output = [];
    let current = null;
    let previous = null;
    for (const line of lines) {
      const text = line.cells.map((cell) => cell.text).join('\t');
      const multiColumn = line.cells.length > 1;
      if (current !== null && previous && !multiColumn && !previous.multiColumn && previous.y - line.y <= line.h * 1.6 && !/[.:!?]$/.test(previous.text)) current += ` ${text}`;
      else { if (current !== null) output.push(current); current = text; }
      previous = { y: line.y, text, multiColumn };
    }
    if (current !== null) output.push(current);
    return output;
  }

  async function pdfToDocx(files) {
    const pages = await extractPdfText(await openPdf(files[0]));
    let body = '';
    pages.forEach((lines, pageIndex) => {
      paragraphs(lines).forEach((text) => {
        body += `<w:p><w:r><w:t xml:space="preserve">${esc(text).replace(/\t/g, '</w:t><w:tab/><w:t xml:space="preserve">')}</w:t></w:r></w:p>`;
      });
      if (pageIndex < pages.length - 1) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    });
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '</w:body></w:document>');
    return [{ name: `${base(files[0].name)}.docx`, blob: await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) }];
  }

  async function pdfToTxt(files) {
    const pages = await extractPdfText(await openPdf(files[0]));
    return [{ name: `${base(files[0].name)}.txt`, blob: new Blob([pages.map((page) => paragraphs(page).join('\n')).join('\n\n')], { type: 'text/plain' }) }];
  }

  async function pdfToXlsx(files) {
    const pages = await extractPdfText(await openPdf(files[0]));
    const workbook = XLSX.utils.book_new();
    pages.forEach((lines, index) => {
      const xPositions = [];
      lines.forEach((line) => line.cells.forEach((cell) => xPositions.push(cell.x)));
      xPositions.sort((left, right) => left - right);
      const anchors = [];
      xPositions.forEach((x) => { if (!anchors.length || x - anchors[anchors.length - 1] > 12) anchors.push(x); });
      const rows = lines.map((line) => {
        const row = Array(anchors.length).fill('');
        line.cells.forEach((cell) => {
          let column = 0;
          while (column + 1 < anchors.length && anchors[column + 1] <= cell.x + 6) column++;
          row[column] = row[column] ? `${row[column]} ${cell.text}` : cell.text;
        });
        return row.map((value) => /^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(value) ? Number(value) : value);
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]), `Page ${index + 1}`);
    });
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return [{ name: `${base(files[0].name)}.xlsx`, blob: new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }];
  }

  async function pdfToImages(files) {
    const pdf = await openPdf(files[0]);
    const imageFiles = [];
    const qualityOption = currentQuality();
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setStatus(`Rendering page ${pageNumber} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: qualityOption.scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise((resolve, reject) => canvas.toBlob((image) => image ? resolve(image) : reject(new Error('Could not export a PDF page image.')), 'image/png'));
      imageFiles.push(blob);
    }
    if (imageFiles.length === 1) return [{ name: `${base(files[0].name)}.png`, blob: imageFiles[0] }];
    const zip = new JSZip();
    imageFiles.forEach((blob, index) => zip.file(`${base(files[0].name)}-page${index + 1}.png`, blob));
    return [{ name: `${base(files[0].name)}-images.zip`, blob: await zip.generateAsync({ type: 'blob' }) }];
  }

  async function imagesToPdf(files) {
    let documentPdf = null;
    const qualityOption = currentQuality();
    for (let index = 0; index < files.length; index++) {
      setStatus(`Adding image ${index + 1} of ${files.length}…`);
      const scale = Math.min(1, qualityOption.scale / 2);
      const bitmap = await createImageBitmap(files[index]);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const orientation = width > height ? 'l' : 'p';
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, width, height);
      const usePng = files[index].type === 'image/png' && qualityOption.jpeg >= 0.9;
      const dataUrl = canvas.toDataURL(usePng ? 'image/png' : 'image/jpeg', qualityOption.jpeg);
      if (!documentPdf) documentPdf = new jspdf.jsPDF({ unit: 'px', format: [width, height], orientation, compress: true });
      else documentPdf.addPage([width, height], orientation);
      documentPdf.addImage(dataUrl, usePng ? 'PNG' : 'JPEG', 0, 0, width, height);
    }
    return [{ name: `${files.length === 1 ? base(files[0].name) : 'images'}.pdf`, blob: documentPdf.output('blob') }];
  }

  async function xlsxToCsv(files) {
    const output = [];
    for (const file of files) {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      workbook.SheetNames.forEach((sheetName) => output.push({
        name: `${base(file.name)}${workbook.SheetNames.length > 1 ? `-${sheetName.replace(/[\\/:*?"<>|]/g, '_')}` : ''}.csv`,
        blob: new Blob(['\ufeff' + XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])], { type: 'text/csv' })
      }));
    }
    return output;
  }

  async function csvToXlsx(files) {
    const workbook = XLSX.utils.book_new();
    const usedNames = new Set();
    for (const file of files) {
      const source = XLSX.read(await file.text(), { type: 'string' });
      const sheet = source.Sheets[source.SheetNames[0]];
      let name = base(file.name).replace(/[\\/?*\[\]:]/g, '_').slice(0, 28) || 'Sheet';
      let candidate = name;
      let suffix = 1;
      while (usedNames.has(candidate.toLowerCase())) candidate = `${name}_${++suffix}`;
      usedNames.add(candidate.toLowerCase());
      XLSX.utils.book_append_sheet(workbook, sheet, candidate);
    }
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    return [{ name: `${files.length === 1 ? base(files[0].name) : 'combined'}.xlsx`, blob: new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }];
  }

  let conversionWarning = '';
  function textToPdf(paragraphs, gap) {
    if (paragraphs.some((paragraph) => /[^\u0000-\u00FF]/.test(paragraph))) conversionWarning = ' Some characters may not render in the built-in PDF font.';
    const pdf = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const margin = 56;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    let y = margin;
    for (const paragraph of paragraphs) {
      if (paragraph === '\f') { pdf.addPage(); y = margin; continue; }
      const lines = paragraph ? pdf.splitTextToSize(paragraph.replace(/\t/g, '    '), width - 2 * margin) : [''];
      for (const line of lines) {
        if (y > height - margin) { pdf.addPage(); y = margin; }
        pdf.text(line, margin, y);
        y += 15;
      }
      y += gap;
    }
    return pdf.output('blob');
  }

  async function txtToPdf(files) {
    const text = (await files[0].text()).replace(/\r\n?/g, '\n');
    return [{ name: `${base(files[0].name)}.pdf`, blob: textToPdf(text.split('\n'), 0) }];
  }

  async function docxToPdf(files) {
    const zip = await JSZip.loadAsync(await files[0].arrayBuffer());
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) throw new Error('That does not look like a DOCX file. Older .doc files are not supported.');
    const xml = new DOMParser().parseFromString(await documentFile.async('string'), 'application/xml');
    const output = [];
    for (const paragraph of xml.getElementsByTagName('w:p')) {
      let text = '';
      for (const node of paragraph.getElementsByTagName('*')) {
        if (node.localName === 't') text += node.textContent;
        else if (node.localName === 'tab') text += '\t';
        else if (node.localName === 'br') {
          if (node.getAttribute('w:type') === 'page') { output.push(text, '\f'); text = ''; }
          else text += '\n';
        }
      }
      output.push(text);
    }
    conversionWarning = ' Only text is converted; images, tables, and styling are not preserved.' + conversionWarning;
    return [{ name: `${base(files[0].name)}.pdf`, blob: textToPdf(output, 5) }];
  }

  async function xlsxToPdf(files) {
    const workbook = XLSX.read(await files[0].arrayBuffer(), { type: 'array' });
    const pdf = new jspdf.jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const margin = 30;
    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      if (sheetIndex) pdf.addPage();
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(sheetName, margin, margin);
      let y = margin + 22;
      const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 1);
      const lengths = Array(columnCount).fill(4);
      rows.forEach((row) => row.forEach((value, index) => { lengths[index] = Math.min(40, Math.max(lengths[index], String(value).length)); }));
      const total = lengths.reduce((sum, value) => sum + value, 0);
      const widths = lengths.map((value) => (width - 2 * margin) * value / total);
      pdf.setFontSize(8);
      pdf.setDrawColor(210);
      rows.forEach((row, rowIndex) => {
        if (y > height - margin) { pdf.addPage(); y = margin; }
        pdf.setFont('helvetica', rowIndex === 0 ? 'bold' : 'normal');
        let x = margin;
        for (let column = 0; column < columnCount; column++) {
          const text = pdf.splitTextToSize(String(row[column] == null ? '' : row[column]), Math.max(10, widths[column] - 4))[0] || '';
          pdf.text(text, x + 2, y);
          x += widths[column];
        }
        pdf.line(margin, y + 4, width - margin, y + 4);
        y += 14;
      });
    });
    conversionWarning = ' Wide sheets are scaled to fit one page width; long cell text may be shortened.';
    return [{ name: `${base(files[0].name)}.pdf`, blob: pdf.output('blob') }];
  }

  async function pdfToPptx(files) {
    if (!window.PptxGenJS) throw new Error('The PowerPoint library could not load. Check your connection and reload.');
    const pdf = await openPdf(files[0]);
    const firstViewport = (await pdf.getPage(1)).getViewport({ scale: 1 });
    const width = firstViewport.width / 72;
    const height = firstViewport.height / 72;
    const presentation = new PptxGenJS();
    presentation.defineLayout({ name: 'PDFPAGE', width, height });
    presentation.layout = 'PDFPAGE';
    const qualityOption = currentQuality();
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setStatus(`Rendering page ${pageNumber} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: qualityOption.scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      presentation.addSlide().addImage({ data: canvas.toDataURL('image/jpeg', qualityOption.jpeg), x: 0, y: 0, w: width, h: height });
    }
    conversionWarning = ' Each PDF page becomes a picture slide; the text is not editable.';
    return [{ name: `${base(files[0].name)}.pptx`, blob: await presentation.write({ outputType: 'blob' }) }];
  }

  async function pptxToPdf(files) {
    const zip = await JSZip.loadAsync(await files[0].arrayBuffer());
    const slides = Object.keys(zip.files).map((name) => name.match(/^ppt\/slides\/slide(\d+)\.xml$/)).filter(Boolean).sort((left, right) => Number(left[1]) - Number(right[1]));
    if (!slides.length) throw new Error('That does not look like a PPTX file. Older .ppt files are not supported.');
    const width = 960;
    const height = 540;
    const margin = 48;
    const pdf = new jspdf.jsPDF({ unit: 'pt', format: [width, height], orientation: 'landscape' });
    let nonLatin = false;
    for (let index = 0; index < slides.length; index++) {
      const xml = new DOMParser().parseFromString(await zip.file(slides[index][0]).async('string'), 'application/xml');
      const paragraphs = [...xml.getElementsByTagName('a:p')].map((paragraph) => [...paragraph.getElementsByTagName('a:t')].map((text) => text.textContent).join('')).filter((text) => text.trim());
      if (index) pdf.addPage([width, height], 'landscape');
      let y = margin + 20;
      paragraphs.forEach((text, paragraphIndex) => {
        if (/[^\u0000-\u00FF]/.test(text)) nonLatin = true;
        pdf.setFont('helvetica', paragraphIndex ? 'normal' : 'bold');
        pdf.setFontSize(paragraphIndex ? 16 : 26);
        const lineHeight = paragraphIndex ? 21 : 32;
        pdf.splitTextToSize(text, width - 2 * margin).forEach((line) => {
          if (y > height - margin) { pdf.addPage([width, height], 'landscape'); y = margin + 20; }
          pdf.text(line, margin, y);
          y += lineHeight;
        });
        y += paragraphIndex ? 6 : 14;
      });
    }
    conversionWarning = ' Only slide text is converted; images, shapes, and slide design are not preserved.' + (nonLatin ? ' Some characters may not render in the built-in PDF font.' : '');
    return [{ name: `${base(files[0].name)}.pdf`, blob: pdf.output('blob') }];
  }

  const modes = {
    pdf2docx: { title: 'PDF → Word', subtitle: '.pdf to .docx', accept: '.pdf,application/pdf', multi: false, run: pdfToDocx, hint: 'One PDF with selectable text. Layout is simplified to text and paragraphs.' },
    pdf2xlsx: { title: 'PDF → Excel', subtitle: '.pdf to .xlsx', accept: '.pdf,application/pdf', multi: false, run: pdfToXlsx, hint: 'Best for PDFs with tables. Creates one sheet per page.' },
    pdf2txt: { title: 'PDF → Text', subtitle: '.pdf to .txt', accept: '.pdf,application/pdf', multi: false, run: pdfToTxt, hint: 'One PDF with selectable text.' },
    pdf2img: { title: 'PDF → Images', subtitle: '.pdf to .png', accept: '.pdf,application/pdf', multi: false, run: pdfToImages, hint: 'Every page becomes a PNG, or a ZIP when there are multiple pages. Scanned PDFs are supported.' },
    img2pdf: { title: 'Images → PDF', subtitle: 'JPG / PNG / WebP', accept: 'image/*', multi: true, run: imagesToPdf, hint: 'Add multiple images; set their order before conversion.' },
    xlsx2csv: { title: 'Excel → CSV', subtitle: '.xlsx to .csv', accept: '.xlsx,.xls,.xlsm', multi: true, run: xlsxToCsv, hint: 'Each sheet becomes its own CSV file.' },
    csv2xlsx: { title: 'CSV → Excel', subtitle: '.csv to .xlsx', accept: '.csv,text/csv', multi: true, run: csvToXlsx, hint: 'Several CSVs can become one workbook with a sheet for each file.' },
    docx2pdf: { title: 'Word → PDF', subtitle: '.docx to .pdf', accept: '.docx', multi: false, run: docxToPdf, hint: 'One DOCX. Text is converted; images and styling are not preserved.' },
    xlsx2pdf: { title: 'Excel → PDF', subtitle: '.xlsx to .pdf', accept: '.xlsx,.xls,.xlsm,.csv', multi: false, run: xlsxToPdf, hint: 'One workbook or CSV. Each sheet becomes a landscape table.' },
    txt2pdf: { title: 'Text → PDF', subtitle: '.txt to .pdf', accept: '.txt,.md,text/plain', multi: false, run: txtToPdf, hint: 'One plain-text file. Long lines are wrapped.' },
    pdf2pptx: { title: 'PDF → PowerPoint', subtitle: '.pdf to .pptx', accept: '.pdf,application/pdf', multi: false, run: pdfToPptx, hint: 'Each PDF page becomes a slide image.' },
    pptx2pdf: { title: 'PowerPoint → PDF', subtitle: '.pptx to .pdf', accept: '.pptx', multi: false, run: pptxToPdf, hint: 'One PPTX file; slide text is converted.' }
  };
  const bulkModes = ['pdf2docx', 'docx2pdf', 'pdf2xlsx', 'xlsx2pdf', 'pdf2txt', 'txt2pdf', 'pdf2img', 'pdf2pptx', 'pptx2pdf'];
  bulkModes.forEach((key) => {
    const item = modes[key];
    item.multi = true;
    const convertOne = item.run;
    item.run = async (files) => {
      const output = [];
      const failures = [];
      for (let index = 0; index < files.length; index++) {
        try { output.push(...await convertOne([files[index]])); }
        catch (error) { failures.push(`${files[index].name} – ${error.message || 'failed'}`); }
        if (files.length > 1) setStatus(`Finished ${index + 1} of ${files.length} files…`);
      }
      if (!output.length) throw new Error(failures.join('\n') || 'Nothing was converted.');
      bulkFailures = failures;
      return output;
    };
    item.hint += ' Multiple files are converted separately.';
  });

  let mode = 'pdf2docx';
  let files = [];
  let results = [];
  let bulkFailures = [];
  let busy = false;
  const modesRoot = $('fc-modes');
  const list = $('fc-list');
  const convertButton = $('fc-go');

  Object.entries(modes).forEach(([key, item]) => {
    const button = document.createElement('button');
    button.className = 'fc-mode';
    button.type = 'button';
    button.dataset.mode = key;
    const title = document.createElement('strong');
    title.textContent = item.title;
    const subtitle = document.createElement('small');
    subtitle.textContent = item.subtitle;
    button.append(title, subtitle);
    button.addEventListener('click', () => selectMode(key));
    modesRoot.append(button);
  });

  function selectMode(key) {
    if (busy) return;
    mode = key;
    files = [];
    results = [];
    [...modesRoot.children].forEach((button) => button.classList.toggle('on', button.dataset.mode === key));
    $('fc-file').accept = modes[key].accept;
    $('fc-file').multiple = modes[key].multi;
    $('fc-hint').textContent = modes[key].hint;
    $('fc-combine-row').hidden = !['img2pdf', 'csv2xlsx'].includes(key);
    $('fc-quality-row').hidden = !['pdf2img', 'pdf2pptx', 'img2pdf'].includes(key);
    $('fc-results-card').hidden = true;
    setStatus('');
    renderFiles();
  }

  function renderFiles() {
    list.replaceChildren();
    files.forEach((file, index) => {
      const row = document.createElement('li');
      row.className = 'fc-file-row';
      const name = document.createElement('span');
      name.className = 'fc-file-name';
      name.textContent = file.name;
      const size = document.createElement('span');
      size.className = 'fc-file-size';
      size.textContent = formatSize(file.size);
      row.append(name, size);
      if (modes[mode].multi && files.length > 1) {
        row.append(actionButton('↑', 'Move up', () => moveFile(index, -1), index === 0), actionButton('↓', 'Move down', () => moveFile(index, 1), index === files.length - 1));
      }
      row.append(actionButton('×', `Remove ${file.name}`, () => { files.splice(index, 1); renderFiles(); }));
      list.append(row);
    });
    convertButton.disabled = files.length === 0;
  }

  function actionButton(text, label, action, disabled = false) {
    const button = document.createElement('button');
    button.className = 'fc-mini';
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    button.addEventListener('click', action);
    return button;
  }

  function moveFile(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    [files[index], files[target]] = [files[target], files[index]];
    renderFiles();
  }

  function addFiles(fileList) {
    if (busy) return;
    const incoming = [...fileList];
    if (!incoming.length) return;
    files = modes[mode].multi ? files.concat(incoming) : [incoming[0]];
    $('fc-file').value = '';
    $('fc-results-card').hidden = true;
    setStatus('');
    renderFiles();
  }

  const drop = $('fc-drop');
  const fileInput = $('fc-file');
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); }
  });
  drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (event) => { event.preventDefault(); drop.classList.remove('dragging'); addFiles(event.dataTransfer.files); });
  fileInput.addEventListener('change', () => addFiles(fileInput.files));

  convertButton.addEventListener('click', async () => {
    if (!files.length || convertButton.disabled) return;
    setBusy(true);
    $('fc-results-card').hidden = true;
    setStatus('Converting…');
    await new Promise((resolve) => setTimeout(resolve, 20));
    try {
      if (!window.pdfjsLib || !window.JSZip || !window.XLSX || !window.jspdf) throw new Error('A conversion library could not load. Check your connection and reload.');
      conversionWarning = '';
      bulkFailures = [];
      results = await modes[mode].run(files);
      const status = `Done — ${results.length} ${results.length === 1 ? 'file' : 'files'} ready.${bulkFailures.length ? `\n${bulkFailures.length} file(s) could not be converted:\n${bulkFailures.join('\n')}` : ''}`;
      setStatus(status, bulkFailures.length > 0);
      renderResults();
    } catch (error) {
      setStatus(error.message || 'Conversion failed.', true);
    } finally {
      setBusy(false);
    }
  });

  function setBusy(value) {
    busy = value;
    $('fc-file').disabled = value;
    $('fc-quality').disabled = value;
    $('fc-combine').disabled = value;
    [...modesRoot.querySelectorAll('button')].forEach((button) => { button.disabled = value; });
    [...list.querySelectorAll('button')].forEach((button) => { button.disabled = value; });
    convertButton.disabled = value || files.length === 0;
    convertButton.textContent = value ? 'Converting…' : 'Convert files';
  }

  function renderResults() {
    const resultsList = $('fc-results');
    resultsList.replaceChildren();
    const multiple = results.length > 1;
    if (multiple) {
      const zipRow = document.createElement('li');
      zipRow.className = 'fc-zip-row';
      const downloadAll = document.createElement('button');
      downloadAll.className = 'primary-btn';
      downloadAll.type = 'button';
      downloadAll.textContent = `Download all ${results.length} files as ZIP`;
      downloadAll.addEventListener('click', downloadAllResults);
      zipRow.append(downloadAll);
      resultsList.append(zipRow);
    }
    results.forEach((result, index) => {
      const row = document.createElement('li');
      row.className = 'fc-file-row';
      const name = document.createElement('span');
      name.className = 'fc-file-name';
      name.textContent = result.name;
      const size = document.createElement('span');
      size.className = 'fc-file-size';
      size.textContent = formatSize(result.blob.size);
      row.append(name, size);
      if (!multiple) row.append(actionButton('Save', `Save ${result.name}`, () => saveFile(result.blob, result.name)));
      resultsList.append(row);
    });
    const notes = [];
    if (mode.startsWith('pdf2') && !['pdf2img', 'pdf2pptx'].includes(mode)) notes.push('Converted from PDF text; fonts, images, and exact layout are not preserved. Review the result before use.');
    if (conversionWarning) notes.push(conversionWarning.trim());
    $('fc-note').textContent = notes.join(' ');
    $('fc-results-card').hidden = false;
  }

  async function downloadAllResults() {
    const zip = new JSZip();
    const seen = new Map();
    results.forEach((result) => {
      const count = seen.get(result.name) || 0;
      seen.set(result.name, count + 1);
      const match = result.name.match(/^(.*?)(\.[^.]*)?$/);
      const filename = count ? `${match[1]} (${count})${match[2] || ''}` : result.name;
      zip.file(filename, result.blob);
    });
    await saveFile(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), 'converted-files.zip');
  }

  async function saveFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function setStatus(message, isError = false) {
    const status = $('fc-status');
    status.textContent = message || '';
    status.className = `status${isError ? ' error' : ''}`;
  }

  selectMode('pdf2docx');
})();
