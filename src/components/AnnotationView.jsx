// Read-only overlay that paints a page's annotations on top of the rendered canvas
// (used by the View tab). Non-interactive — it never intercepts pointer events.
// Shapes render in a single pass in creation order so the on-screen stack matches
// both the editor overlay and the exported PDF.
export default function AnnotationView({ items, w, h }) {
  if (!items || !items.length || !w) return null;
  const px = (n) => n * w;
  const py = (n) => n * h;
  const strokePx = (n) => Math.max(1, n * h);

  return (
    <div className="anno-view" style={{ width: w, height: h }}>
      <svg width={w} height={h}>
        <defs>
          {items.filter((a) => a.type === 'arrow').map((a) => (
            <marker key={a.id} id={`iv-arrow-v-${a.id}`} markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={a.color} />
            </marker>
          ))}
        </defs>
        {items.map((a) => {
          switch (a.type) {
            case 'highlight':
              return <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill={a.color || '#ffd54a'} fillOpacity="0.4" />;
            case 'redact':
              return <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="#000" />;
            case 'whiteout':
              return <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="#fff" />;
            case 'rect':
              return <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} />;
            case 'ellipse':
              return <ellipse key={a.id} cx={px(a.x + a.w / 2)} cy={py(a.y + a.h / 2)} rx={px(a.w / 2)} ry={py(a.h / 2)} fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} />;
            case 'line':
            case 'arrow':
              return <line key={a.id} x1={px(a.x0)} y1={py(a.y0)} x2={px(a.x1)} y2={py(a.y1)} stroke={a.color} strokeWidth={strokePx(a.strokeW)} strokeLinecap="round" markerEnd={a.type === 'arrow' ? `url(#iv-arrow-v-${a.id})` : undefined} />;
            case 'draw':
              return <polyline key={a.id} points={a.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')} fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} strokeLinecap="round" strokeLinejoin="round" />;
            case 'crop':
              return (
                <g key={a.id}>
                  <rect x="0" y="0" width={w} height={py(a.y)} fill="#000" fillOpacity="0.35" />
                  <rect x="0" y={py(a.y + a.h)} width={w} height={Math.max(0, h - py(a.y + a.h))} fill="#000" fillOpacity="0.35" />
                  <rect x="0" y={py(a.y)} width={px(a.x)} height={py(a.h)} fill="#000" fillOpacity="0.35" />
                  <rect x={px(a.x + a.w)} y={py(a.y)} width={Math.max(0, w - px(a.x + a.w))} height={py(a.h)} fill="#000" fillOpacity="0.35" />
                  <rect x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="none" stroke="#574fd6" strokeWidth="1.5" strokeDasharray="6 4" />
                </g>
              );
            case 'field':
              return <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="#574fd6" fillOpacity="0.08" stroke="#574fd6" strokeWidth="1" strokeDasharray="4 3" />;
            case 'watermark':
            case 'pagenum': {
              if (!a.text) return null;
              const fs = Math.max(8, a.size * h);
              const x = px(a.x); const y = py(a.y) + fs * 0.82;
              const anchor = a.align === 'center' ? 'middle' : a.align === 'right' ? 'end' : 'start';
              return <text key={a.id} x={x} y={y} fontSize={fs} fill={a.color || '#000'} fillOpacity={a.opacity == null ? 1 : a.opacity} textAnchor={anchor} transform={a.angle ? `rotate(${-a.angle} ${x} ${y})` : undefined}>{a.text}</text>;
            }
            default:
              return null;
          }
        })}
      </svg>
      {items.filter((a) => a.type === 'image').map((a) => (
        <img key={a.id} src={a.dataUrl} alt="" className="anno-view-img" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%` }} draggable={false} />
      ))}
      {items.filter((a) => a.type === 'text' && a.text).map((a) => (
        <div key={a.id} className="anno-view-text" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, fontSize: `${Math.max(8, a.size * h)}px`, color: a.color }}>{a.text}</div>
      ))}
    </div>
  );
}
