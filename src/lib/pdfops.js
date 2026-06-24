// Rebuilds real PDF bytes from the page-model using pdf-lib. Everything runs in
// the browser; no bytes are ever sent anywhere.
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { rasterizePage } from './pdfview.js';

const REDACT_DPI = 150;

function sourceLoader(sources) {
  const cache = new Map();
  return async (srcKey) => {
    if (!cache.has(srcKey)) {
      cache.set(srcKey, await PDFDocument.load(sources[srcKey].bytes, { ignoreEncryption: true }));
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

// Bake one page's annotations onto a pdf-lib page.
async function drawAnnotations(out, pageObj, items, R) {
  const { width: Pw, height: Ph } = pageObj.getSize();
  const { Dw, Dh } = displayDims(Pw, Ph, R);
  const textRotate = degrees((360 - R) % 360);

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
    } else if (a.type === 'draw') {
      const thickness = Math.max(0.5, a.strokeW * Dh);
      for (let i = 1; i < a.points.length; i++) {
        const p1 = mapPoint(a.points[i - 1].x * Dw, a.points[i - 1].y * Dh, Pw, Ph, R);
        const p2 = mapPoint(a.points[i].x * Dw, a.points[i].y * Dh, Pw, Ph, R);
        pageObj.drawLine({ start: { x: p1.ux, y: p1.uy }, end: { x: p2.ux, y: p2.uy }, thickness, color: hexRgb(a.color), lineCap: 1 });
      }
    } else if (a.type === 'text' && a.text) {
      const fontPt = a.size * Dh;
      const anchor = mapPoint(a.x * Dw, a.y * Dh + fontPt * 0.82, Pw, Ph, R);
      pageObj.drawText(a.text, { x: anchor.ux, y: anchor.uy, size: fontPt, color: hexRgb(a.color), rotate: textRotate });
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

async function buildFrom(items, sources, annotations = {}) {
  const out = await PDFDocument.create();
  const load = sourceLoader(sources);
  for (const item of items) {
    const anns = annotations[item.id] || [];
    const redacts = anns.filter((a) => a.type === 'redact');
    const others = anns.filter((a) => a.type !== 'redact');

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
      if (others.length) await drawAnnotations(out, page, others, 0);
      continue;
    }

    const src = await load(item.srcKey);
    const [copied] = await out.copyPages(src, [item.index]);
    const intrinsic = copied.getRotation().angle || 0;
    const R = (((intrinsic + (item.rotation || 0)) % 360) + 360) % 360;
    copied.setRotation(degrees(R));
    if (others.length) await drawAnnotations(out, copied, others, R);
    out.addPage(copied);
  }
  return out.save();
}

export function buildPdf(pages, sources, annotations) {
  return buildFrom(pages, sources, annotations);
}

export function extractPdf(pages, sources, ids, annotations) {
  const set = new Set(ids);
  return buildFrom(pages.filter((p) => set.has(p.id)), sources, annotations);
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
