import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../lib/pdfview.js';

// One page rendered from its source document. Renders lazily the first time it
// scrolls near the viewport, and re-renders when width or rotation changes.
function Page({ page, source, displayNumber, width, onVisible }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setSeen(true); onVisible?.(displayNumber); } }),
      { root: null, rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [displayNumber, onVisible]);

  useEffect(() => {
    if (!seen || !width || !source) return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await renderPage(source.doc, page.index + 1, width, canvasRef.current, page.rotation);
      } catch { /* render can be cancelled on fast scroll/zoom; ignore */ }
    })();
    return () => { cancelled = true; };
  }, [seen, width, source, page.index, page.rotation]);

  return (
    <div className="pdf-page" ref={wrapRef} data-page={displayNumber}>
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
}

export default function PdfViewer({ pages, sources, zoom = 1, onPageInView }) {
  const scrollRef = useRef(null);
  const [baseWidth, setBaseWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBaseWidth(Math.min(900, el.clientWidth - 48));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = Math.max(120, baseWidth * zoom);

  return (
    <div className="pdf-scroll" ref={scrollRef}>
      {pages.map((pg, i) => (
        <Page
          key={pg.id}
          page={pg}
          source={sources[pg.srcKey]}
          displayNumber={i + 1}
          width={width}
          onVisible={onPageInView}
        />
      ))}
    </div>
  );
}
