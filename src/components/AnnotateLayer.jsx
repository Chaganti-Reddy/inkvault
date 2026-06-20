import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../lib/pdfview.js';

// Renders one page plus an interactive overlay. Annotations are stored in
// normalized 0..1 coordinates (top-left origin) relative to the displayed page,
// so they survive zoom and map cleanly onto the exported PDF.
export default function AnnotateLayer({
  page, source, width, tool, color, strokeW, fontSize,
  items, selectedId, onSelect, onAdd, onUpdate,
}) {
  const canvasRef = useRef(null);
  const surfRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState(null); // in-progress shape/pen
  const dragRef = useRef(null);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    (async () => {
      try {
        const dim = await renderPage(source.doc, page.index + 1, width, canvasRef.current, page.rotation);
        if (!cancelled) setSize({ w: dim.width, h: dim.height });
      } catch { /* ignore cancelled render */ }
    })();
    return () => { cancelled = true; };
  }, [source, page.index, page.rotation, width]);

  const rel = (e) => {
    const r = surfRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  // --- create gestures on empty surface ---
  const onSurfaceDown = (e) => {
    if (tool === 'select') { onSelect(null); return; }
    e.preventDefault();
    surfRef.current.setPointerCapture(e.pointerId);
    const p = rel(e);
    if (tool === 'text') {
      const id = onAdd({ type: 'text', x: p.x, y: p.y, text: '', size: fontSize, color });
      onSelect(id);
      return;
    }
    if (tool === 'pen') { setDraft({ type: 'draw', points: [p], color, strokeW }); return; }
    if (tool === 'highlight' || tool === 'rect') { setDraft({ type: tool, x0: p.x, y0: p.y, x: p.x, y: p.y }); return; }
  };

  const onSurfaceMove = (e) => {
    if (!draft) return;
    const p = rel(e);
    if (draft.type === 'draw') setDraft((d) => ({ ...d, points: [...d.points, p] }));
    else setDraft((d) => ({ ...d, x: p.x, y: p.y }));
  };

  const onSurfaceUp = () => {
    if (!draft) return;
    if (draft.type === 'draw') {
      if (draft.points.length > 1) onAdd({ type: 'draw', points: draft.points, color, strokeW });
    } else {
      const x = Math.min(draft.x0, draft.x), y = Math.min(draft.y0, draft.y);
      const w = Math.abs(draft.x - draft.x0), h = Math.abs(draft.y - draft.y0);
      if (w > 0.005 && h > 0.005) {
        if (draft.type === 'highlight') onAdd({ type: 'highlight', x, y, w, h, color: '#ffd54a' });
        else onAdd({ type: 'rect', x, y, w, h, color, strokeW });
      }
    }
    setDraft(null);
  };

  // --- move existing annotation (select tool) ---
  const startMove = (e, item) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    onSelect(item.id);
    const p = rel(e);
    dragRef.current = { id: item.id, dx: p.x - item.x, dy: p.y - item.y };
    surfRef.current.setPointerCapture(e.pointerId);
  };
  const onMoveDrag = (e) => {
    if (!dragRef.current) { onSurfaceMove(e); return; }
    const p = rel(e);
    onUpdate(dragRef.current.id, { x: p.x - dragRef.current.dx, y: p.y - dragRef.current.dy });
  };
  const endDrag = () => { dragRef.current = null; onSurfaceUp(); };

  const px = (n) => n * size.w;
  const py = (n) => n * size.h;
  const strokePx = (n) => Math.max(1, n * size.h);

  return (
    <div className="anno-page" style={{ width: size.w || width }}>
      <canvas ref={canvasRef} className="pdf-canvas" />
      <div
        ref={surfRef}
        className={`anno-surface tool-${tool}`}
        style={{ width: size.w, height: size.h }}
        onPointerDown={onSurfaceDown}
        onPointerMove={onMoveDrag}
        onPointerUp={endDrag}
      >
        <svg className="anno-svg" width={size.w} height={size.h}>
          {items.filter((a) => a.type === 'highlight').map((a) => (
            <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)}
              fill={a.color} fillOpacity="0.4"
              className={selectedId === a.id ? 'sel' : ''}
              onPointerDown={(e) => startMove(e, a)} />
          ))}
          {items.filter((a) => a.type === 'rect').map((a) => (
            <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)}
              fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)}
              className={selectedId === a.id ? 'sel' : ''}
              onPointerDown={(e) => startMove(e, a)} />
          ))}
          {items.filter((a) => a.type === 'draw').map((a) => (
            <polyline key={a.id} points={a.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
              fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {draft?.type === 'draw' && (
            <polyline points={draft.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
              fill="none" stroke={color} strokeWidth={strokePx(strokeW)} strokeLinecap="round" />
          )}
          {(draft?.type === 'highlight' || draft?.type === 'rect') && (
            <rect x={px(Math.min(draft.x0, draft.x))} y={py(Math.min(draft.y0, draft.y))}
              width={px(Math.abs(draft.x - draft.x0))} height={py(Math.abs(draft.y - draft.y0))}
              fill={draft.type === 'highlight' ? '#ffd54a' : 'none'} fillOpacity="0.4"
              stroke={draft.type === 'rect' ? color : 'none'} strokeWidth={strokePx(strokeW)} />
          )}
        </svg>

        {items.filter((a) => a.type === 'image').map((a) => (
          <img key={a.id} src={a.dataUrl} alt="" className={`anno-img ${selectedId === a.id ? 'sel' : ''}`}
            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%` }}
            onPointerDown={(e) => startMove(e, a)} draggable={false} />
        ))}

        {items.filter((a) => a.type === 'text').map((a) => (
          <div key={a.id}
            className={`anno-text ${selectedId === a.id ? 'sel' : ''}`}
            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, fontSize: `${strokePxText(a.size, size.h)}px`, color: a.color }}
            contentEditable
            suppressContentEditableWarning
            onPointerDown={(e) => startMove(e, a)}
            onFocus={() => onSelect(a.id)}
            onBlur={(e) => onUpdate(a.id, { text: e.currentTarget.textContent })}
          >{a.text}</div>
        ))}
      </div>
    </div>
  );
}

function strokePxText(sizeNorm, h) {
  return Math.max(8, sizeNorm * h);
}
