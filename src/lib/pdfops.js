// Rebuilds real PDF bytes from the page-model using pdf-lib. Everything runs in
// the browser; no bytes are ever sent anywhere.
import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { rasterizePage, loadDocument } from './pdfview.js';
import { applyFormValues, flattenForm } from './forms.js';

const REDACT_DPI = 150;

// Unicode text font (Noto Sans), fetched once and reused. Lets annotations,
// watermarks and page numbers render non-Latin text. Falls back to Helvetica.
let notoBytes = null;
async function embedTextFont(out) {
  try {
    if (!notoBytes) notoBytes = new Uint8Array(await (await fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer());
    out.registerFontkit(fontkit);
    return await out.embedFont(notoBytes, { subset: true });
  } catch {
    return out.embedFont(StandardFonts.Helvetica);
  }
}

function sourceLoader(sources, formValues = {}) {
  const cache = new Map();
  return async (srcKey) => {
    if (!cache.has(srcKey)) {
      const doc = await PDFDocument.load(sources[srcKey].bytes, { ignoreEncryption: true });
      // Fill form fields for this source, then flatten so the values are baked into
      // the page content and survive copyPages into the output document.
      if (applyFormValues(doc, formValues[srcKey])) flattenForm(doc);
      cache.set(srcKey, doc);
    }
    return cache.get(srcKey);
  };
}

function hexRgb(hex) {
  const h = (hex || '#000').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const v = parseInt(n, 16);
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

// Displayed page box dimensions for a final rotation R.
function displayDims(Pw, Ph, R) {
  return (R === 90 || R === 270) ? { Dw: Ph, Dh: Pw } : { Dw: Pw, Dh: Ph };
}

// Map a point given in display space (top-left origin, y-down) to pdf-lib user
// space (bottom-left origin, y-up), inverting the page's clockwise /Rotate R.
function mapPoint(dx, dy, Pw, Ph, R) {
  let tx, ty; // page space, top-left origin
  if (R === 90) { tx = dy; ty = Ph - dx; }
  else if (R === 180) { tx = Pw - dx; ty = Ph - dy; }
  else if (R === 270) { tx = Pw - dy; ty = dx; }
  else { tx = dx; ty = dy; }
  return { ux: tx, uy: Ph - ty };
}

// Bake one page's annotations onto a pdf-lib page. `font` is an embedded Helvetica
// used for text measurement (alignment) and consistent drawing.
async function drawAnnotations(out, pageObj, items, R, font) {
  const { width: Pw, height: Ph } = pageObj.getSize();
  const { Dw, Dh } = displayDims(Pw, Ph, R);
  const baseRotate = (360 - R) % 360;
  const textRotate = degrees(baseRotate);

  // Draw text with optional opacity, extra angle (watermark) and alignment. Alignment
  // uses real font metrics and is applied in display space (exact for unrotated pages).
  const drawTextAnn = (a) => {
    const fontPt = a.size * Dh;
    const angle = a.angle || 0;
    let dx = a.x * Dw;
    if ((a.align === 'center' || a.align === 'right') && angle === 0) {
      const w = font.widthOfTextAtSize(a.text, fontPt);
      dx -= a.align === 'center' ? w / 2 : w;
    }
    const anchor = mapPoint(dx, a.y * Dh + fontPt * 0.82, Pw, Ph, R);
    pageObj.drawText(a.text, {
      x: anchor.ux, y: anchor.uy, size: fontPt, font,
      color: a.opacity === 0 ? rgb(0, 0, 0) : hexRgb(a.color),
      opacity: a.opacity == null ? 1 : a.opacity,
      rotate: degrees((baseRotate + angle) % 360),
    });
  };

  const rectFromDisplay = (x, y, w, h) => {
    const a = mapPoint(x * Dw, y * Dh, Pw, Ph, R);
    const b = mapPoint((x + w) * Dw, (y + h) * Dh, Pw, Ph, R);
    return { x: Math.min(a.ux, b.ux), y: Math.min(a.uy, b.uy), w: Math.abs(b.ux - a.ux), h: Math.abs(b.uy - a.uy) };
  };

  for (const a of items) {
    if (a.type === 'highlight') {
      const r = rectFromDisplay(a.x, a.y, a.w, a.h);
      pageObj.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, color: hexRgb(a.color), opacity: 0.4 });
    } else if (a.type === 'rect') {
      const r = rectFromDisplay(a.x, a.y, a.w, a.h);
      pageObj.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, borderColor: hexRgb(a.color), borderWidth: Math.max(0.5, a.strokeW * Dh), opacity: 0 });
    } else if (a.type === 'whiteout') {
      const r = rectFromDisplay(a.x, a.y, a.w, a.h);
      pageObj.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, color: rgb(1, 1, 1) });
    } else if (a.type === 'ellipse') {
      const r = rectFromDisplay(a.x, a.y, a.w, a.h);
      pageObj.drawEllipse({ x: r.x + r.w / 2, y: r.y + r.h / 2, xScale: r.w / 2, yScale: r.h / 2, borderColor: hexRgb(a.color), borderWidth: Math.max(0.5, a.strokeW * Dh), opacity: 0 });
    } else if (a.type === 'line' || a.type === 'arrow') {
      const thickness = Math.max(0.5, a.strokeW * Dh);
      const p1 = mapPoint(a.x0 * Dw, a.y0 * Dh, Pw, Ph, R);
      const p2 = mapPoint(a.x1 * Dw, a.y1 * Dh, Pw, Ph, R);
      pageObj.drawLine({ start: { x: p1.ux, y: p1.uy }, end: { x: p2.ux, y: p2.uy }, thickness, color: hexRgb(a.color), lineCap: 1 });
      if (a.type === 'arrow') {
        const ang = Math.atan2(p2.uy - p1.uy, p2.ux - p1.ux);
        const head = Math.max(6, thickness * 3);
        for (const s of [ang + Math.PI * 0.82, ang - Math.PI * 0.82]) {
          pageObj.drawLine({ start: { x: p2.ux, y: p2.uy }, end: { x: p2.ux + head * Math.cos(s), y: p2.uy + head * Math.sin(s) }, thickness, color: hexRgb(a.color), lineCap: 1 });
        }
      }
    } else if (a.type === 'draw') {
      const thickness = Math.max(0.5, a.strokeW * Dh);
      for (let i = 1; i < a.points.length; i++) {
        const p1 = mapPoint(a.points[i - 1].x * Dw, a.points[i - 1].y * Dh, Pw, Ph, R);
        const p2 = mapPoint(a.points[i].x * Dw, a.points[i].y * Dh, Pw, Ph, R);
        pageObj.drawLine({ start: { x: p1.ux, y: p1.uy }, end: { x: p2.ux, y: p2.uy }, thickness, color: hexRgb(a.color), lineCap: 1 });
      }
    } else if ((a.type === 'text' || a.type === 'watermark' || a.type === 'pagenum') && a.text) {
      try { drawTextAnn(a); } catch { /* unencodable glyph — skip */ }
    } else if (a.type === 'otext' && a.text) {
      // Invisible OCR text layer: present for search/copy, painted transparent so the
      // underlying scan shows through. Skip words the base font can't encode.
      const fontPt = a.size * Dh;
      const anchor = mapPoint(a.x * Dw, a.y * Dh + fontPt * 0.82, Pw, Ph, R);
      try {
        pageObj.drawText(a.text, { x: anchor.ux, y: anchor.uy, size: fontPt, font, color: rgb(0, 0, 0), opacity: 0, rotate: textRotate });
      } catch { /* unencodable glyph — skip this word */ }
    } else if (a.type === 'image') {
      const wdisp = a.w * Dw;
      const hdisp = wdisp * (a.ratio || 0.4); // ratio is the image's pixel h/w; points are square
      const bytes = dataUrlToBytes(a.dataUrl);
      const img = a.dataUrl.includes('image/jpeg') ? await out.embedJpg(bytes) : await out.embedPng(bytes);
      const topLeft = mapPoint(a.x * Dw, a.y * Dh, Pw, Ph, R);
      // For R=0 the image's bottom-left is topLeft shifted down by its height.
      const pos = imagePos(topLeft, hdisp, R);
      pageObj.drawImage(img, { x: pos.x, y: pos.y, width: wdisp, height: hdisp, rotate: degrees((360 - R) % 360) });
    }
  }
}

function imagePos(topLeft, h, R) {
  if (R === 90) return { x: topLeft.ux + h, y: topLeft.uy, };
  if (R === 180) return { x: topLeft.ux, y: topLeft.uy + h };
  if (R === 270) return { x: topLeft.ux - h, y: topLeft.uy };
  return { x: topLeft.ux, y: topLeft.uy - h };
}

function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function applyMetadata(out, meta = {}) {
  out.setProducer('InkVault');
  out.setCreator('InkVault (inkvaultpdf.pages.dev)');
  if (meta.title != null) out.setTitle(meta.title);
  if (meta.author != null) out.setAuthor(meta.author);
  if (meta.subject != null) out.setSubject(meta.subject);
  if (meta.keywords) out.setKeywords(meta.keywords.split(',').map((k) => k.trim()).filter(Boolean));
}

async function buildFrom(items, sources, annotations = {}, formValues = {}, metadata = {}) {
  const out = await PDFDocument.create();
  applyMetadata(out, metadata);
  const font = await embedTextFont(out);
  const load = sourceLoader(sources, formValues);
  for (const item of items) {
    const anns = annotations[item.id] || [];
    const redacts = anns.filter((a) => a.type === 'redact');
    const crop = anns.find((a) => a.type === 'crop');
    const others = anns.filter((a) => a.type !== 'redact' && a.type !== 'crop');

    if (redacts.length) {
      // True redaction: rasterize the page (already rotated), paint the boxes over
      // the pixels so the original text/content is permanently gone, then embed the
      // flattened image as the page. No original content stream survives underneath.
      const { canvas, pointW, pointH } = await rasterizePage(sources[item.srcKey].doc, item.index + 1, REDACT_DPI, item.rotation || 0);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      for (const r of redacts) ctx.fillRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
      const jpg = await out.embedJpg(dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92)));
      const page = out.addPage([pointW, pointH]);
      page.drawImage(jpg, { x: 0, y: 0, width: pointW, height: pointH });
      if (others.length) await drawAnnotations(out, page, others, 0, font);
      continue;
    }

    const src = await load(item.srcKey);
    const [copied] = await out.copyPages(src, [item.index]);
    const intrinsic = copied.getRotation().angle || 0;
    const R = (((intrinsic + (item.rotation || 0)) % 360) + 360) % 360;
    copied.setRotation(degrees(R));
    if (crop) {
      const { width: Pw, height: Ph } = copied.getSize();
      const { Dw, Dh } = displayDims(Pw, Ph, R);
      const a1 = mapPoint(crop.x * Dw, crop.y * Dh, Pw, Ph, R);
      const b1 = mapPoint((crop.x + crop.w) * Dw, (crop.y + crop.h) * Dh, Pw, Ph, R);
      copied.setCropBox(Math.min(a1.ux, b1.ux), Math.min(a1.uy, b1.uy), Math.abs(b1.ux - a1.ux), Math.abs(b1.uy - a1.uy));
    }
    if (others.length) await drawAnnotations(out, copied, others, R, font);
    out.addPage(copied);
  }
  return out.save();
}

export function buildPdf(pages, sources, annotations, formValues, metadata) {
  return buildFrom(pages, sources, annotations, formValues, metadata);
}

export function extractPdf(pages, sources, ids, annotations, formValues, metadata) {
  const set = new Set(ids);
  return buildFrom(pages.filter((p) => set.has(p.id)), sources, annotations, formValues, metadata);
}

// Shrink a PDF by rendering every page to a JPEG at the given DPI/quality and
// rebuilding as an image PDF. Big wins on scanned/image-heavy documents. Text
// becomes non-selectable (run OCR first if searchability matters).
export async function compressBytes(baseBytes, { dpi = 110, quality = 0.65 } = {}) {
  const doc = await loadDocument(baseBytes.slice());
  const out = await PDFDocument.create();
  for (let i = 1; i <= doc.numPages; i++) {
    const { canvas, pointW, pointH } = await rasterizePage(doc, i, dpi, 0);
    const jpg = await out.embedJpg(dataUrlToBytes(canvas.toDataURL('image/jpeg', quality)));
    const page = out.addPage([pointW, pointH]);
    page.drawImage(jpg, { x: 0, y: 0, width: pointW, height: pointH });
  }
  return out.save();
}

// Extract all selectable text from the edited document (reflects reorder, redaction
// and OCR). Returns one block per page.
export async function extractText(pages, sources, annotations, formValues) {
  const bytes = await buildFrom(pages, sources, annotations, formValues);
  const doc = await loadDocument(bytes.slice());
  const parts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    parts.push(tc.items.map((it) => it.str).join(' ').replace(/\s+\n/g, '\n').trim());
  }
  return parts.join('\n\n');
}

// A one-page blank PDF (default A4), used to insert blank pages into the model.
export async function blankPdfBytes(width = 595, height = 842) {
  const doc = await PDFDocument.create();
  doc.addPage([width, height]);
  return doc.save();
}

// Render every page of the edited document to an image blob. format: 'jpeg' | 'png'.
export async function renderPagesToImages(pages, sources, annotations, formValues, metadata, { format = 'jpeg', dpi = 150 } = {}) {
  const base = await buildFrom(pages, sources, annotations, formValues, metadata);
  const doc = await loadDocument(base.slice());
  const ext = format === 'png' ? 'png' : 'jpg';
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const { canvas } = await rasterizePage(doc, i, dpi, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, mime, 0.92));
    out.push({ name: `page-${String(i).padStart(3, '0')}.${ext}`, data: blob });
  }
  return out;
}

// Split the edited document into one single-page PDF per page.
export async function splitToSinglePages(pages, sources, annotations, formValues, metadata) {
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    const bytes = await buildFrom([pages[i]], sources, annotations, formValues, metadata);
    out.push({ name: `page-${String(i + 1).padStart(3, '0')}.pdf`, data: bytes });
  }
  return out;
}

export function downloadText(text, name) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'document.txt';
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'download';
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBytes(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'document.pdf';
  a.click();
  URL.revokeObjectURL(url);
}
