import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../lib/pdfview.js';

const LINE_TOOLS = ['line', 'arrow'];
const BOX_TYPES = ['highlight', 'rect', 'redact', 'whiteout', 'ellipse', 'crop', 'field'];
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const clamp01 = (n) => Math.min(1, Math.max(0, n));

// Renders one page plus an interactive overlay. Annotations are stored in
// normalized 0..1 coordinates (top-left origin) relative to the displayed page,
// so they survive zoom and map cleanly onto the exported PDF. Shapes render in a
// single pass in creation order so on-screen z-order matches the export order.
export default function AnnotateLayer({
  page, source, width, tool, color, strokeW, fontSize,
  items, selectedId, onSelect, onAdd, onUpdate, onRemove, onBeginChange,
}) {
  const canvasRef = useRef(null);
  const surfRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState(null); // in-progress shape/pen
  const dragRef = useRef(null); // { mode:'move'|'resize'|'endpoint', id, start, snap, handle }
  const editPushedRef = useRef(false); // one history snapshot per text-edit session
  const focusRef = useRef(null); // id of a just-created text box to focus

  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    let task = null;
    (async () => {
      try {
        const dim = await renderPage(source.doc, page.index + 1, width, canvasRef.current, page.rotation, (rt) => { task = rt; });
        if (!cancelled) setSize({ w: dim.width, h: dim.height });
      } catch { /* render can be cancelled on fast zoom/width change; ignore */ }
    })();
    return () => { cancelled = true; try { task?.cancel(); } catch { /* already done */ } };
  }, [source, page.index, page.rotation, width]);

  const rel = (e) => {
    const r = surfRef.current.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };
  const px = (n) => n * size.w;
  const py = (n) => n * size.h;
  const strokePx = (n) => Math.max(1, n * size.h);

  // Displayed height (normalized) of an image from its stored aspect ratio.
  const imgH = (a) => (size.w && size.h ? (a.w * size.w * (a.ratio || 1)) / size.h : a.w);
  // Bounding box (normalized) used for selection outline + resize handles.
  const bbox = (a) => {
    if (BOX_TYPES.includes(a.type)) return { x: a.x, y: a.y, w: a.w, h: a.h };
    if (a.type === 'image') return { x: a.x, y: a.y, w: a.w, h: imgH(a) };
    if (a.type === 'text') return { x: a.x, y: a.y, w: 0, h: a.size };
    return null;
  };

  // --- create gestures on empty surface ---
  const onSurfaceDown = (e) => {
    if (tool === 'select') { onSelect(null); return; }
    e.preventDefault();
    surfRef.current.setPointerCapture(e.pointerId);
    const p = rel(e);
    if (tool === 'text') {
      const id = onAdd({ type: 'text', x: p.x, y: p.y, text: '', size: fontSize, color });
      focusRef.current = id;
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
        if (draft.type === 'highlight') onAdd({ type: 'highlight', x, y, w, h, color });
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

  // --- move / resize existing annotation (select tool) ---
  const startMove = (e, item) => {
    if (tool !== 'select') { e.stopPropagation(); return; } // don't let create-tools spawn a duplicate underneath
    e.stopPropagation();
    onSelect(item.id);
    onBeginChange?.(); // one history snapshot per gesture
    dragRef.current = { mode: 'move', id: item.id, start: rel(e), snap: { ...item, points: item.points ? item.points.map((p) => ({ ...p })) : undefined } };
    surfRef.current.setPointerCapture(e.pointerId);
  };
  const startResize = (e, item, handle) => {
    e.stopPropagation();
    onSelect(item.id);
    onBeginChange?.();
    dragRef.current = { mode: item.type === 'image' ? 'image' : 'resize', id: item.id, handle, start: rel(e), snap: { ...item } };
    surfRef.current.setPointerCapture(e.pointerId);
  };
  const startEndpoint = (e, item, which) => {
    e.stopPropagation();
    onSelect(item.id);
    onBeginChange?.();
    dragRef.current = { mode: 'endpoint', id: item.id, which, start: rel(e), snap: { ...item } };
    surfRef.current.setPointerCapture(e.pointerId);
  };

  const onMoveDrag = (e) => {
    const d = dragRef.current;
    if (!d) { onSurfaceMove(e); return; }
    const p = rel(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    const s = d.snap;
    if (d.mode === 'move') {
      if (s.type === 'line' || s.type === 'arrow') {
        onUpdate(d.id, { x0: clamp01(s.x0 + dx), y0: clamp01(s.y0 + dy), x1: clamp01(s.x1 + dx), y1: clamp01(s.y1 + dy) });
      } else if (s.type === 'draw') {
        onUpdate(d.id, { points: s.points.map((pt) => ({ x: clamp01(pt.x + dx), y: clamp01(pt.y + dy) })) });
      } else {
        const w = s.w || 0, h = s.type === 'image' ? imgH(s) : (s.h || 0);
        onUpdate(d.id, { x: Math.min(0.98, Math.max(-w + 0.02, s.x + dx)), y: Math.min(0.98, Math.max(-h + 0.02, s.y + dy)) });
      }
    } else if (d.mode === 'endpoint') {
      onUpdate(d.id, d.which === 0 ? { x0: p.x, y0: p.y } : { x1: p.x, y1: p.y });
    } else if (d.mode === 'image') {
      // aspect-locked: horizontal drag drives width, anchored on the opposite edge
      const west = d.handle.includes('w');
      let nw = west ? s.w - dx : s.w + dx;
      nw = Math.max(0.03, Math.min(1, nw));
      onUpdate(d.id, west ? { x: s.x + (s.w - nw), w: nw } : { w: nw });
    } else { // resize box types
      let left = s.x, right = s.x + s.w, top = s.y, bottom = s.y + s.h;
      if (d.handle.includes('w')) left = clamp01(s.x + dx);
      if (d.handle.includes('e')) right = clamp01(s.x + s.w + dx);
      if (d.handle.includes('n')) top = clamp01(s.y + dy);
      if (d.handle.includes('s')) bottom = clamp01(s.y + s.h + dy);
      const nx = Math.min(left, right), ny = Math.min(top, bottom);
      onUpdate(d.id, { x: nx, y: ny, w: Math.max(0.01, Math.abs(right - left)), h: Math.max(0.01, Math.abs(bottom - top)) });
    }
  };
  const endDrag = () => { dragRef.current = null; onSurfaceUp(); };

  const commitText = (id, el) => {
    const text = el.innerText.replace(/\n$/, ''); // contentEditable often adds a trailing newline
    if (!text.trim()) onRemove?.(id);
    else onUpdate(id, { text });
    editPushedRef.current = false;
  };

  const selected = items.find((a) => a.id === selectedId);
  const selBox = selected ? bbox(selected) : null;

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
        {/* shapes: single pass in creation order so screen z-order matches export */}
        <svg className="anno-svg" width={size.w} height={size.h}>
          <defs>
            {items.filter((a) => a.type === 'arrow').map((a) => (
              <marker key={a.id} id={`iv-arrow-${a.id}`} markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={a.color} />
              </marker>
            ))}
            <marker id="iv-arrow-draft" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={color} />
            </marker>
          </defs>
          {items.map((a) => {
            const on = selectedId === a.id;
            switch (a.type) {
              case 'highlight':
                return <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill={a.color || '#ffd54a'} fillOpacity="0.4" className={on ? 'sel' : ''} onPointerDown={(e) => startMove(e, a)} />;
              case 'rect':
                return <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} className={on ? 'sel' : ''} onPointerDown={(e) => startMove(e, a)} />;
              case 'redact':
                return <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="#000" className={on ? 'sel' : ''} onPointerDown={(e) => startMove(e, a)} />;
              case 'whiteout':
                return <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="#fff" stroke={on ? 'var(--accent)' : '#e2e5ea'} strokeWidth="1" className={on ? 'sel' : ''} onPointerDown={(e) => startMove(e, a)} />;
              case 'ellipse':
                return <ellipse key={a.id} cx={px(a.x + a.w / 2)} cy={py(a.y + a.h / 2)} rx={px(a.w / 2)} ry={py(a.h / 2)} fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} className={on ? 'sel' : ''} onPointerDown={(e) => startMove(e, a)} />;
              case 'line':
              case 'arrow':
                return (
                  <g key={a.id}>
                    <line x1={px(a.x0)} y1={py(a.y0)} x2={px(a.x1)} y2={py(a.y1)} stroke="transparent" strokeWidth={Math.max(12, strokePx(a.strokeW) + 10)} onPointerDown={(e) => startMove(e, a)} style={{ cursor: 'move', pointerEvents: 'stroke' }} />
                    <line x1={px(a.x0)} y1={py(a.y0)} x2={px(a.x1)} y2={py(a.y1)} stroke={a.color} strokeWidth={strokePx(a.strokeW)} strokeLinecap="round" markerEnd={a.type === 'arrow' ? `url(#iv-arrow-${a.id})` : undefined} style={{ pointerEvents: 'none' }} />
                  </g>
                );
              case 'draw':
                return (
                  <g key={a.id}>
                    <polyline points={a.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')} fill="none" stroke="transparent" strokeWidth={Math.max(12, strokePx(a.strokeW) + 10)} strokeLinejoin="round" onPointerDown={(e) => startMove(e, a)} style={{ cursor: 'move', pointerEvents: 'stroke' }} />
                    <polyline points={a.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')} fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} className={on ? 'sel-stroke' : ''} />
                  </g>
                );
              case 'crop':
                return (
                  <g key={a.id}>
                    <rect x="0" y="0" width={size.w} height={py(a.y)} fill="#000" fillOpacity="0.35" />
                    <rect x="0" y={py(a.y + a.h)} width={size.w} height={Math.max(0, size.h - py(a.y + a.h))} fill="#000" fillOpacity="0.35" />
                    <rect x="0" y={py(a.y)} width={px(a.x)} height={py(a.h)} fill="#000" fillOpacity="0.35" />
                    <rect x={px(a.x + a.w)} y={py(a.y)} width={Math.max(0, size.w - px(a.x + a.w))} height={py(a.h)} fill="#000" fillOpacity="0.35" />
                    <rect x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="6 4" onPointerDown={(e) => startMove(e, a)} />
                  </g>
                );
              case 'field':
                return (
                  <g key={a.id}>
                    <rect x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="var(--accent)" fillOpacity="0.08" stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 3" className={on ? 'sel' : ''} onPointerDown={(e) => startMove(e, a)} />
                    <text x={px(a.x) + 4} y={py(a.y) + 13} fontSize="11" fill="var(--accent)" style={{ pointerEvents: 'none' }}>{a.fieldType === 'checkbox' ? '☑' : 'T'} {a.name || ''}</text>
                  </g>
                );
              default:
                return null;
            }
          })}

          {/* live draft */}
          {(draft?.type === 'textfield' || draft?.type === 'checkbox') && (
            <rect x={px(Math.min(draft.x0, draft.x))} y={py(Math.min(draft.y0, draft.y))} width={px(Math.abs(draft.x - draft.x0))} height={py(Math.abs(draft.y - draft.y0))} fill="var(--accent)" fillOpacity="0.08" stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 3" />
          )}
          {draft?.type === 'crop' && (
            <rect x={px(Math.min(draft.x0, draft.x))} y={py(Math.min(draft.y0, draft.y))} width={px(Math.abs(draft.x - draft.x0))} height={py(Math.abs(draft.y - draft.y0))} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="6 4" />
          )}
          {draft?.type === 'draw' && (
            <polyline points={draft.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')} fill="none" stroke={color} strokeWidth={strokePx(strokeW)} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {(draft?.type === 'highlight' || draft?.type === 'rect' || draft?.type === 'redact' || draft?.type === 'whiteout') && (
            <rect x={px(Math.min(draft.x0, draft.x))} y={py(Math.min(draft.y0, draft.y))} width={px(Math.abs(draft.x - draft.x0))} height={py(Math.abs(draft.y - draft.y0))}
              fill={draft.type === 'highlight' ? color : draft.type === 'redact' ? '#000' : draft.type === 'whiteout' ? '#fff' : 'none'}
              fillOpacity={draft.type === 'rect' ? 0 : draft.type === 'highlight' ? 0.4 : 1}
              stroke={draft.type === 'rect' ? color : 'none'} strokeWidth={strokePx(strokeW)} />
          )}
          {draft?.type === 'ellipse' && (
            <ellipse cx={px((draft.x0 + draft.x) / 2)} cy={py((draft.y0 + draft.y) / 2)} rx={px(Math.abs(draft.x - draft.x0) / 2)} ry={py(Math.abs(draft.y - draft.y0) / 2)} fill="none" stroke={color} strokeWidth={strokePx(strokeW)} />
          )}
          {(draft?.type === 'line' || draft?.type === 'arrow') && (
            <line x1={px(draft.x0)} y1={py(draft.y0)} x2={px(draft.x)} y2={py(draft.y)} stroke={color} strokeWidth={strokePx(strokeW)} strokeLinecap="round" markerEnd={draft.type === 'arrow' ? 'url(#iv-arrow-draft)' : undefined} />
          )}
        </svg>

        {/* signature / image annotations */}
        {items.filter((a) => a.type === 'image').map((a) => (
          <img key={a.id} src={a.dataUrl} alt="" className={`anno-img ${selectedId === a.id ? 'sel' : ''}`}
            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%` }}
            onPointerDown={(e) => startMove(e, a)} draggable={false} />
        ))}

        {/* text annotations (contentEditable) */}
        {items.filter((a) => a.type === 'text').map((a) => (
          <div key={a.id}
            className={`anno-text ${selectedId === a.id ? 'sel' : ''}`}
            style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, fontSize: `${Math.max(8, a.size * size.h)}px`, color: a.color }}
            contentEditable
            suppressContentEditableWarning
            ref={(el) => {
              if (el && focusRef.current === a.id) {
                focusRef.current = null;
                requestAnimationFrame(() => { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); });
              }
            }}
            onPointerDown={(e) => startMove(e, a)}
            onFocus={() => onSelect(a.id)}
            onBeforeInput={() => { if (!editPushedRef.current) { onBeginChange?.(); editPushedRef.current = true; } }}
            onBlur={(e) => commitText(a.id, e.currentTarget)}
          >{a.text}</div>
        ))}

        {/* selection outline + resize handles (top layer, only handles capture pointer) */}
        {selected && size.w > 0 && (
          <svg className="anno-overlay" width={size.w} height={size.h}>
            {(selected.type === 'line' || selected.type === 'arrow') && (
              <>
                <rect className="handle" x={px(selected.x0) - 5} y={py(selected.y0) - 5} width="10" height="10" onPointerDown={(e) => startEndpoint(e, selected, 0)} style={{ cursor: 'crosshair' }} />
                <rect className="handle" x={px(selected.x1) - 5} y={py(selected.y1) - 5} width="10" height="10" onPointerDown={(e) => startEndpoint(e, selected, 1)} style={{ cursor: 'crosshair' }} />
              </>
            )}
            {selBox && selected.type !== 'text' && (
              <>
                <rect className="sel-outline" x={px(selBox.x)} y={py(selBox.y)} width={px(selBox.w)} height={py(selBox.h)} />
                {(selected.type === 'image' ? ['nw', 'ne', 'se', 'sw'] : HANDLES).map((hnd) => {
                  const hx = selBox.x + (hnd.includes('w') ? 0 : hnd.includes('e') ? selBox.w : selBox.w / 2);
                  const hy = selBox.y + (hnd.includes('n') ? 0 : hnd.includes('s') ? selBox.h : selBox.h / 2);
                  const cur = { n: 'ns', s: 'ns', e: 'ew', w: 'ew', nw: 'nwse', se: 'nwse', ne: 'nesw', sw: 'nesw' }[hnd] + '-resize';
                  return <rect key={hnd} className="handle" x={px(hx) - 5} y={py(hy) - 5} width="10" height="10" style={{ cursor: cur }}
                    onPointerDown={(e) => startResize(e, selected, hnd)} />;
                })}
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
