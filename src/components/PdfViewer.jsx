import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../lib/pdfview.js';
import AnnotationView from './AnnotationView.jsx';

// One page rendered from its source document. Renders lazily the first time it
// scrolls near the viewport, and re-renders when width or rotation changes.
function Page({ page, source, displayNumber, width, items, onVisible }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [seen, setSeen] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

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
        const dim = await renderPage(source.doc, page.index + 1, width, canvasRef.current, page.rotation);
        if (!cancelled) setSize({ w: dim.width, h: dim.height });
      } catch { /* render can be cancelled on fast scroll/zoom; ignore */ }
    })();
    return () => { cancelled = true; };
  }, [seen, width, source, page.index, page.rotation]);

  return (
    <div className="pdf-page" ref={wrapRef} data-page={displayNumber}>
      <canvas ref={canvasRef} className="pdf-canvas" />
      <AnnotationView items={items} w={size.w} h={size.h} />
    </div>
  );
}

export default function PdfViewer({ pages, sources, annotations = {}, zoom = 1, onPageInView }) {
  const scrollRef = useRef(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Fit to the available width (100% zoom = page fills the column), capped so it
    // doesn't get unreadably wide on very large monitors.
    const measure = () => setBaseWidth(Math.min(1400, el.clientWidth - 40));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = Math.max(120, baseWidth * zoom);
  const onVisible = (n) => { setCurrent(n); onPageInView?.(n); };
  const jump = (n) => {
    const c = scrollRef.current;
    const el = c?.querySelector(`.pdf-page[data-page="${n}"]`);
    if (el) c.scrollTop += el.getBoundingClientRect().top - c.getBoundingClientRect().top - 12;
  };

  return (
    <div className="pdf-view-row">
      {pages.length > 1 && (
        <nav className="pdf-nav">
          {pages.map((pg, i) => (
            <button key={pg.id} className={`pdf-nav-btn ${current === i + 1 ? 'on' : ''}`} onClick={() => jump(i + 1)}>{i + 1}</button>
          ))}
        </nav>
      )}
      <div className="pdf-scroll" ref={scrollRef}>
        {pages.map((pg, i) => (
          <Page
            key={pg.id}
            page={pg}
            source={sources[pg.srcKey]}
            displayNumber={i + 1}
            width={width}
            items={annotations[pg.id]}
            onVisible={onVisible}
          />
        ))}
      </div>
    </div>
  );
}
