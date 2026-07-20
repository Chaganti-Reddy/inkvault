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
