import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../lib/pdfview.js';

const LINE_TOOLS = ['line', 'arrow'];

// Renders one page plus an interactive overlay. Annotations are stored in
// normalized 0..1 coordinates (top-left origin) relative to the displayed page,
// so they survive zoom and map cleanly onto the exported PDF.
export default function AnnotateLayer({
  page, source, width, tool, color, strokeW, fontSize,
  items, selectedId, onSelect, onAdd, onUpdate, onBeginChange,
}) {
  const canvasRef = useRef(null);
  const surfRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState(null); // in-progress shape/pen
  const dragRef = useRef(null);
  const editPushedRef = useRef(false); // one history snapshot per text-edit session

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
    setDraft({ type: tool, x0: p.x, y0: p.y, x: p.x, y: p.y });
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
    } else if (LINE_TOOLS.includes(draft.type)) {
      const dist = Math.hypot(draft.x - draft.x0, draft.y - draft.y0);
      if (dist > 0.01) onAdd({ type: draft.type, x0: draft.x0, y0: draft.y0, x1: draft.x, y1: draft.y, color, strokeW });
    } else {
      const x = Math.min(draft.x0, draft.x), y = Math.min(draft.y0, draft.y);
      const w = Math.abs(draft.x - draft.x0), h = Math.abs(draft.y - draft.y0);
      if (w > 0.005 && h > 0.005) {
        if (draft.type === 'highlight') onAdd({ type: 'highlight', x, y, w, h, color: '#ffd54a' });
        else if (draft.type === 'redact') onAdd({ type: 'redact', x, y, w, h });
        else if (draft.type === 'whiteout') onAdd({ type: 'whiteout', x, y, w, h });
        else if (draft.type === 'ellipse') onAdd({ type: 'ellipse', x, y, w, h, color, strokeW });
        else if (draft.type === 'crop') onAdd({ type: 'crop', x, y, w, h });
        else if (draft.type === 'textfield') onAdd({ type: 'field', fieldType: 'text', x, y, w, h });
        else if (draft.type === 'checkbox') onAdd({ type: 'field', fieldType: 'checkbox', x, y, w, h });
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
    onBeginChange?.(); // one history snapshot per drag, not per pointer-move
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
          {items.filter((a) => a.type === 'redact').map((a) => (
            <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)}
              fill="#000" fillOpacity="1"
              className={selectedId === a.id ? 'sel' : ''}
              onPointerDown={(e) => startMove(e, a)} />
          ))}
          {items.filter((a) => a.type === 'whiteout').map((a) => (
            <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)}
              fill="#fff" fillOpacity="1" stroke={selectedId === a.id ? 'var(--accent)' : '#e2e5ea'} strokeWidth="1"
              className={selectedId === a.id ? 'sel' : ''}
              onPointerDown={(e) => startMove(e, a)} />
          ))}
          {items.filter((a) => a.type === 'ellipse').map((a) => (
            <ellipse key={a.id} cx={px(a.x + a.w / 2)} cy={py(a.y + a.h / 2)} rx={px(a.w / 2)} ry={py(a.h / 2)}
              fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)}
              className={selectedId === a.id ? 'sel' : ''}
              onPointerDown={(e) => startMove(e, a)} />
          ))}
          {items.filter((a) => a.type === 'line' || a.type === 'arrow').map((a) => (
            <line key={a.id} x1={px(a.x0)} y1={py(a.y0)} x2={px(a.x1)} y2={py(a.y1)}
              stroke={a.color} strokeWidth={strokePx(a.strokeW)} strokeLinecap="round"
              markerEnd={a.type === 'arrow' ? 'url(#iv-arrow)' : undefined}
              onPointerDown={(e) => startMove(e, a)} />
          ))}
          <defs>
            <marker id="iv-arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={color} />
            </marker>
          </defs>
          {items.filter((a) => a.type === 'crop').map((a) => (
            <g key={a.id}>
              <rect x="0" y="0" width={size.w} height={py(a.y)} fill="#000" fillOpacity="0.35" />
              <rect x="0" y={py(a.y + a.h)} width={size.w} height={Math.max(0, size.h - py(a.y + a.h))} fill="#000" fillOpacity="0.35" />
              <rect x="0" y={py(a.y)} width={px(a.x)} height={py(a.h)} fill="#000" fillOpacity="0.35" />
              <rect x={px(a.x + a.w)} y={py(a.y)} width={Math.max(0, size.w - px(a.x + a.w))} height={py(a.h)} fill="#000" fillOpacity="0.35" />
              <rect x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="6 4"
                onPointerDown={(e) => startMove(e, a)} />
            </g>
          ))}
          {items.filter((a) => a.type === 'field').map((a) => (
            <g key={a.id}>
              <rect x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)}
                fill="var(--accent)" fillOpacity="0.08" stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 3"
                className={selectedId === a.id ? 'sel' : ''} onPointerDown={(e) => startMove(e, a)} />
              <text x={px(a.x) + 4} y={py(a.y) + 13} fontSize="11" fill="var(--accent)">{a.fieldType === 'checkbox' ? '☑' : 'T'} {a.name || ''}</text>
            </g>
          ))}
          {items.filter((a) => a.type === 'draw').map((a) => (
            <polyline key={a.id} points={a.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
              fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {(draft?.type === 'textfield' || draft?.type === 'checkbox') && (
            <rect x={px(Math.min(draft.x0, draft.x))} y={py(Math.min(draft.y0, draft.y))}
              width={px(Math.abs(draft.x - draft.x0))} height={py(Math.abs(draft.y - draft.y0))}
              fill="var(--accent)" fillOpacity="0.08" stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 3" />
          )}
          {draft?.type === 'crop' && (
            <rect x={px(Math.min(draft.x0, draft.x))} y={py(Math.min(draft.y0, draft.y))}
              width={px(Math.abs(draft.x - draft.x0))} height={py(Math.abs(draft.y - draft.y0))}
              fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="6 4" />
          )}
          {draft?.type === 'draw' && (
            <polyline points={draft.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
              fill="none" stroke={color} strokeWidth={strokePx(strokeW)} strokeLinecap="round" />
          )}
          {(draft?.type === 'highlight' || draft?.type === 'rect' || draft?.type === 'redact' || draft?.type === 'whiteout') && (
            <rect x={px(Math.min(draft.x0, draft.x))} y={py(Math.min(draft.y0, draft.y))}
              width={px(Math.abs(draft.x - draft.x0))} height={py(Math.abs(draft.y - draft.y0))}
              fill={draft.type === 'highlight' ? '#ffd54a' : draft.type === 'redact' ? '#000' : draft.type === 'whiteout' ? '#fff' : 'none'}
              fillOpacity={draft.type === 'rect' ? 0 : draft.type === 'highlight' ? 0.4 : 1}
              stroke={draft.type === 'rect' ? color : 'none'} strokeWidth={strokePx(strokeW)} />
          )}
          {draft?.type === 'ellipse' && (
            <ellipse cx={px((draft.x0 + draft.x) / 2)} cy={py((draft.y0 + draft.y) / 2)}
              rx={px(Math.abs(draft.x - draft.x0) / 2)} ry={py(Math.abs(draft.y - draft.y0) / 2)}
              fill="none" stroke={color} strokeWidth={strokePx(strokeW)} />
          )}
          {(draft?.type === 'line' || draft?.type === 'arrow') && (
            <line x1={px(draft.x0)} y1={py(draft.y0)} x2={px(draft.x)} y2={py(draft.y)}
              stroke={color} strokeWidth={strokePx(strokeW)} strokeLinecap="round"
              markerEnd={draft.type === 'arrow' ? 'url(#iv-arrow)' : undefined} />
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
            onBeforeInput={() => { if (!editPushedRef.current) { onBeginChange?.(); editPushedRef.current = true; } }}
            onBlur={(e) => { onUpdate(a.id, { text: e.currentTarget.textContent }); editPushedRef.current = false; }}
          >{a.text}</div>
        ))}
      </div>
    </div>
  );
}

function strokePxText(sizeNorm, h) {
  return Math.max(8, sizeNorm * h);
}
