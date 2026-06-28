import { useEffect, useRef, useState } from 'react';

// Renders one page and overlays real inputs on top of its AcroForm widgets, using
// pdf.js to get each widget's rectangle (rotation-aware). Editing updates the
// context form values; the actual PDF is filled + flattened at export time.
export default function FormPageLayer({ page, source, width, values, onSet, onCount }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [widgets, setWidgets] = useState([]);

  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    let task = null;
    (async () => {
      try {
        const pdfPage = await source.doc.getPage(page.index + 1);
        const total = (((pdfPage.rotate || 0) + page.rotation) % 360 + 360) % 360;
        const base = pdfPage.getViewport({ scale: 1, rotation: total });
        const scale = width / base.width;
        const viewport = pdfPage.getViewport({ scale, rotation: total });
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        task = pdfPage.render({ canvasContext: ctx, viewport });
        await task.promise;
        if (cancelled) return;
        setSize({ w: viewport.width, h: viewport.height });

        const anns = await pdfPage.getAnnotations({ intent: 'display' });
        if (cancelled) return;
        const list = anns.filter((a) => a.subtype === 'Widget' && a.fieldType).map((a) => {
          // pdf.js v6 dropped convertToViewportRectangle — map two opposite corners.
          const p1 = viewport.convertToViewportPoint(a.rect[0], a.rect[1]);
          const p2 = viewport.convertToViewportPoint(a.rect[2], a.rect[3]);
          return {
            name: a.fieldName,
            type: a.fieldType,
            checkBox: a.checkBox,
            radio: a.radioButton,
            exportValue: a.exportValue,
            fieldValue: a.fieldValue,
            multiline: a.multiLine,
            options: a.options,
            left: Math.min(p1[0], p2[0]), top: Math.min(p1[1], p2[1]),
            w: Math.abs(p2[0] - p1[0]), h: Math.abs(p2[1] - p1[1]),
          };
        });
        if (!cancelled) { setWidgets(list); onCount?.(list.length); }
      } catch { /* render cancelled on fast switch/unmount; ignore */ }
    })();
    return () => { cancelled = true; try { task?.cancel(); } catch { /* already done */ } };
  }, [source, page.index, page.rotation, width, onCount]);

  const has = (name) => Object.prototype.hasOwnProperty.call(values || {}, name);

  return (
    <div className="anno-page" style={{ width: size.w || width }}>
      <canvas ref={canvasRef} className="pdf-canvas" />
      <div className="form-overlay" style={{ width: size.w, height: size.h }}>
        {widgets.map((wgt, i) => {
          const style = { left: wgt.left, top: wgt.top, width: wgt.w, height: wgt.h };
          if (wgt.type === 'Tx') {
            const v = has(wgt.name) ? values[wgt.name] : (wgt.fieldValue || '');
            return wgt.multiline
              ? <textarea key={i} className="form-field" style={style} value={v} onChange={(e) => onSet(wgt.name, e.target.value)} />
              : <input key={i} className="form-field" style={style} value={v} onChange={(e) => onSet(wgt.name, e.target.value)} />;
          }
          if (wgt.type === 'Btn' && wgt.checkBox) {
            const v = has(wgt.name) ? values[wgt.name] : (wgt.fieldValue && wgt.fieldValue !== 'Off');
            return <input key={i} type="checkbox" className="form-check" style={style} checked={!!v} onChange={(e) => onSet(wgt.name, e.target.checked)} />;
          }
          if (wgt.type === 'Btn' && wgt.radio) {
            const sel = has(wgt.name) ? values[wgt.name] : wgt.fieldValue;
            return <input key={i} type="radio" name={wgt.name} className="form-check" style={style}
              checked={sel === wgt.exportValue} onChange={() => onSet(wgt.name, wgt.exportValue)} />;
          }
          if (wgt.type === 'Ch') {
            const v = has(wgt.name) ? values[wgt.name] : wgt.fieldValue;
            return (
              <select key={i} className="form-field" style={style} value={v || ''} onChange={(e) => onSet(wgt.name, e.target.value)}>
                <option value="" />
                {(wgt.options || []).map((o, j) => <option key={j} value={o.exportValue}>{o.displayValue}</option>)}
              </select>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
