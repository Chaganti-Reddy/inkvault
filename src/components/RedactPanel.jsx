import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import AnnotateLayer from './AnnotateLayer.jsx';
import { FiMousePointer, FiEyeOff, FiTrash2, LuShieldCheck } from '../ui/icons.js';

// Redaction is destructive: on export, any page carrying a redaction box is
// rasterized and the boxes are painted over the pixels, so the hidden content is
// permanently removed. The banner makes that guarantee (and its trade-off) explicit.
export default function RedactPanel() {
  const { t } = useTranslation();
  const { pages, sources, annotations, addAnnotation, updateAnnotation, removeAnnotation } = usePdf();
  const [tool, setTool] = useState('redact');
  const [sel, setSel] = useState(null);
  const scrollRef = useRef(null);
  const [baseWidth, setBaseWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBaseWidth(Math.min(1100, el.clientWidth - 48));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!sel || document.activeElement?.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { removeAnnotation(sel.pageId, sel.id); setSel(null); }
      if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, removeAnnotation]);

  const width = Math.max(200, baseWidth);
  const count = Object.values(annotations).flat().filter((a) => a.type === 'redact').length;

  return (
    <div className="annotate">
      <div className="anno-bar">
        <div className="anno-tools">
          <button className={`anno-tool ${tool === 'select' ? 'on' : ''}`} title={t('annotate.select')} onClick={() => setTool('select')}><FiMousePointer /></button>
          <button className={`anno-tool ${tool === 'redact' ? 'on' : ''}`} title={t('redact.box')} onClick={() => setTool('redact')}><FiEyeOff /></button>
        </div>
        <div className="redact-note"><LuShieldCheck /> {t('redact.note', { count })}</div>
        <div className="spacer" />
        {sel && (
          <button className="btn sm" onClick={() => { removeAnnotation(sel.pageId, sel.id); setSel(null); }}>
            <FiTrash2 /> {t('annotate.deleteSel')}
          </button>
        )}
      </div>

      <div className="anno-scroll" ref={scrollRef}>
        {pages.map((pg) => (
          <div key={pg.id} data-pageid={pg.id} className="anno-page-wrap">
            <AnnotateLayer
              page={pg}
              source={sources[pg.srcKey]}
              width={width}
              tool={tool}
              color="#000000"
              strokeW={0.004}
              fontSize={0.03}
              items={annotations[pg.id] || []}
              selectedId={sel?.pageId === pg.id ? sel.id : null}
              onSelect={(id) => setSel(id ? { pageId: pg.id, id } : null)}
              onAdd={(ann) => addAnnotation(pg.id, ann)}
              onUpdate={(id, patch) => updateAnnotation(pg.id, id, patch)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
