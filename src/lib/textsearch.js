// Measure relative text widths with a canvas so sub-string boxes track real glyph
// widths (variable-width fonts), not an even-character estimate. Ratios are scale-
// invariant, so a fixed measuring size is fine.
let measureCtx = null;
function widthRatio(prefix, match, full) {
  if (!measureCtx) { const c = document.createElement('canvas'); measureCtx = c.getContext('2d'); measureCtx.font = '32px sans-serif'; }
  const total = measureCtx.measureText(full).width || 1;
  return { start: measureCtx.measureText(prefix).width / total, span: measureCtx.measureText(match).width / total };
}

// Find every occurrence of `term` on a page and return boxes in normalized display
// coordinates (0..1, top-left origin) — used to auto-mark redactions. Boxes are
// padded slightly so descenders/ascenders are fully covered.
export async function findTextBoxes(doc, pageNumber, rotation, term) {
  const page = await doc.getPage(pageNumber);
  const total = (((page.rotate || 0) + rotation) % 360 + 360) % 360;
  const vp = page.getViewport({ scale: 1, rotation: total });
  const tc = await page.getTextContent();
  const needle = term.toLowerCase();
  const boxes = [];

  for (const item of tc.items) {
    const str = item.str;
    if (!str || !item.width) continue;
    const low = str.toLowerCase();
    let idx = low.indexOf(needle);
    while (idx >= 0) {
      const h = item.height || Math.abs(item.transform[3]) || 10;
      const r = widthRatio(str.slice(0, idx), str.slice(idx, idx + needle.length), str);
      const x0 = item.transform[4] + r.start * item.width;
      const w = r.span * item.width;
      const y0 = item.transform[5] - 0.2 * h;
      const yTop = item.transform[5] + h;
      const a = vp.convertToViewportPoint(x0, y0);
      const b = vp.convertToViewportPoint(x0 + w, yTop);
      boxes.push({
        x: Math.min(a[0], b[0]) / vp.width,
        y: Math.min(a[1], b[1]) / vp.height,
        w: Math.abs(b[0] - a[0]) / vp.width,
        h: Math.abs(b[1] - a[1]) / vp.height,
      });
      idx = low.indexOf(needle, idx + needle.length);
    }
  }
  return boxes;
}
