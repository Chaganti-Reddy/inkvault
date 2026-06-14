import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../lib/pdfview.js';

// One page. Renders lazily the first time it scrolls near the viewport, and
// re-renders when the target width changes (zoom). Keeps big PDFs responsive.
function Page({ doc, pageNumber, width, onVisible }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            onVisible?.(pageNumber);
          }
        }
      },
      { root: null, rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pageNumber, onVisible]);

  useEffect(() => {
    if (!seen || !width) return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await renderPage(doc, pageNumber, width, canvasRef.current);
      } catch { /* page render can be cancelled on fast scroll/zoom; ignore */ }
    })();
    return () => { cancelled = true; };
  }, [seen, width, doc, pageNumber]);

  return (
    <div className="pdf-page" ref={wrapRef} data-page={pageNumber}>
      <canvas ref={canvasRef} className="pdf-canvas" />
    </div>
  );
}

export default function PdfViewer({ doc, numPages, zoom = 1, onPageInView }) {
  const scrollRef = useRef(null);
  const [baseWidth, setBaseWidth] = useState(0);

  // Base width = the column width; zoom scales from there. Clamped so pages don't
  // touch the edges.
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
      {Array.from({ length: numPages }, (_, i) => (
        <Page key={i + 1} doc={doc} pageNumber={i + 1} width={width} onVisible={onPageInView} />
      ))}
    </div>
  );
}
