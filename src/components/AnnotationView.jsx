// Read-only overlay that paints a page's annotations on top of the rendered canvas
// (used by the View tab). Non-interactive — it never intercepts pointer events.
export default function AnnotationView({ items, w, h }) {
  if (!items || !items.length || !w) return null;
  const px = (n) => n * w;
  const py = (n) => n * h;
  const strokePx = (n) => Math.max(1, n * h);

  return (
    <div className="anno-view" style={{ width: w, height: h }}>
      <svg width={w} height={h}>
        {items.filter((a) => a.type === 'highlight').map((a) => (
          <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill={a.color} fillOpacity="0.4" />
        ))}
        {items.filter((a) => a.type === 'redact').map((a) => (
          <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="#000" />
        ))}
        {items.filter((a) => a.type === 'whiteout').map((a) => (
          <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="#fff" />
        ))}
        {items.filter((a) => a.type === 'ellipse').map((a) => (
          <ellipse key={a.id} cx={px(a.x + a.w / 2)} cy={py(a.y + a.h / 2)} rx={px(a.w / 2)} ry={py(a.h / 2)} fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} />
        ))}
        {items.filter((a) => a.type === 'line' || a.type === 'arrow').map((a) => (
          <line key={a.id} x1={px(a.x0)} y1={py(a.y0)} x2={px(a.x1)} y2={py(a.y1)} stroke={a.color} strokeWidth={strokePx(a.strokeW)} strokeLinecap="round" markerEnd={a.type === 'arrow' ? 'url(#iv-arrow-v)' : undefined} />
        ))}
        <defs>
          <marker id="iv-arrow-v" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#e5484d" />
          </marker>
        </defs>
        {items.filter((a) => a.type === 'rect').map((a) => (
          <rect key={a.id} x={px(a.x)} y={py(a.y)} width={px(a.w)} height={py(a.h)} fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} />
        ))}
        {items.filter((a) => a.type === 'draw').map((a) => (
          <polyline key={a.id} points={a.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')} fill="none" stroke={a.color} strokeWidth={strokePx(a.strokeW)} strokeLinecap="round" strokeLinejoin="round" />
        ))}
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
