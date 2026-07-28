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
        const list = anns.filter((a) => a.subtype === 'Widget' && a.fieldType && !a.hidden).map((a) => {
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
            readOnly: a.readOnly,
            required: a.required,
            password: a.password,
            maxLen: a.maxLen || undefined,
            combo: a.combo,
            multiSelect: a.multiSelect,
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
          const key = `${wgt.name || 'f'}-${i}`;
          const style = { left: wgt.left, top: wgt.top, width: wgt.w, height: wgt.h };
          const cls = `form-field${wgt.required ? ' required' : ''}`;
          const ro = wgt.readOnly;
          if (wgt.type === 'Tx') {
            const v = has(wgt.name) ? values[wgt.name] : (wgt.fieldValue || '');
            return wgt.multiline
              ? <textarea key={key} className={cls} style={style} value={v} disabled={ro} maxLength={wgt.maxLen} required={wgt.required} onChange={(e) => onSet(wgt.name, e.target.value)} />
              : <input key={key} type={wgt.password ? 'password' : 'text'} className={cls} style={style} value={v} disabled={ro} maxLength={wgt.maxLen} required={wgt.required} onChange={(e) => onSet(wgt.name, e.target.value)} />;
          }
          if (wgt.type === 'Btn' && wgt.checkBox) {
            const v = has(wgt.name) ? values[wgt.name] : (wgt.fieldValue && wgt.fieldValue !== 'Off');
            return <input key={key} type="checkbox" className="form-check" style={style} checked={!!v} disabled={ro} onChange={(e) => onSet(wgt.name, e.target.checked)} />;
          }
          if (wgt.type === 'Btn' && wgt.radio) {
            const sel = has(wgt.name) ? values[wgt.name] : wgt.fieldValue;
            return <input key={key} type="radio" name={wgt.name} className="form-check" style={style}
              checked={sel === wgt.exportValue} disabled={ro} onChange={() => onSet(wgt.name, wgt.exportValue)} />;
          }
          if (wgt.type === 'Ch') {
            const raw = has(wgt.name) ? values[wgt.name] : wgt.fieldValue;
            const opts = wgt.options || [];
            // Editable combo box: free-typed value plus option suggestions.
            if (wgt.combo) {
              const v = Array.isArray(raw) ? (raw[0] || '') : (raw || '');
              return (
                <span key={key}>
                  <input className={cls} style={style} list={`${key}-opts`} value={v} disabled={ro} onChange={(e) => onSet(wgt.name, e.target.value)} />
                  <datalist id={`${key}-opts`}>{opts.map((o, j) => <option key={j} value={o.exportValue}>{o.displayValue}</option>)}</datalist>
                </span>
              );
            }
            // Multi-select listbox: value is an array of export values.
            if (wgt.multiSelect) {
              const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
              return (
                <select key={key} multiple className={cls} style={style} value={arr} disabled={ro}
                  onChange={(e) => onSet(wgt.name, Array.from(e.target.selectedOptions, (o) => o.value))}>
                  {opts.map((o, j) => <option key={j} value={o.exportValue}>{o.displayValue}</option>)}
                </select>
              );
            }
            const v = Array.isArray(raw) ? (raw[0] || '') : (raw || '');
            return (
              <select key={key} className={cls} style={style} value={v} disabled={ro} onChange={(e) => onSet(wgt.name, e.target.value)}>
                <option value="" />
                {opts.map((o, j) => <option key={j} value={o.exportValue}>{o.displayValue}</option>)}
              </select>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
