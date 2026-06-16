// Rebuilds real PDF bytes from the page-model using pdf-lib. Everything runs in
// the browser; no bytes are ever sent anywhere.
import { PDFDocument, degrees } from 'pdf-lib';

// Load each needed source document once and cache it for the duration of a build.
async function sourceLoader(sources) {
  const cache = new Map();
  return async (srcKey) => {
    if (!cache.has(srcKey)) {
      cache.set(srcKey, await PDFDocument.load(sources[srcKey].bytes, { ignoreEncryption: true }));
    }
    return cache.get(srcKey);
  };
}

// Build a new PDF from an ordered list of page items. Rotation in the model is
// added on top of each page's intrinsic rotation.
async function buildFrom(items, sources) {
  const out = await PDFDocument.create();
  const load = await sourceLoader(sources);
  for (const item of items) {
    const src = await load(item.srcKey);
    const [copied] = await out.copyPages(src, [item.index]);
    if (item.rotation) {
      const current = copied.getRotation().angle || 0;
      copied.setRotation(degrees((current + item.rotation) % 360));
    }
    out.addPage(copied);
  }
  return out.save();
}

export function buildPdf(pages, sources) {
  return buildFrom(pages, sources);
}

// Export only the given page ids, keeping model order.
export function extractPdf(pages, sources, ids) {
  const set = new Set(ids);
  return buildFrom(pages.filter((p) => set.has(p.id)), sources);
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
