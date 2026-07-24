import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import AnnotateLayer from './AnnotateLayer.jsx';
import SignatureModal from './SignatureModal.jsx';
import { FiMousePointer, FiType, FiEdit2, FiEdit3, FiSquare, FiCircle, FiMinus, FiArrowUpRight, FiPenTool, FiTrash2, LuEraser } from '../ui/icons.js';

const TOOLS = [
  { key: 'select', Icon: FiMousePointer },
  { key: 'text', Icon: FiType },
  { key: 'highlight', Icon: FiEdit2 },
  { key: 'pen', Icon: FiEdit3 },
  { key: 'line', Icon: FiMinus },
  { key: 'arrow', Icon: FiArrowUpRight },
  { key: 'rect', Icon: FiSquare },
  { key: 'ellipse', Icon: FiCircle },
  { key: 'whiteout', Icon: LuEraser },
];
const COLORS = ['#111111', '#e5484d', '#2f6feb', '#2f9e6d'];
const STROKES = [0.003, 0.005, 0.009];
const FONTS = [0.02, 0.03, 0.045];

export default function AnnotatePanel() {
  const { t } = useTranslation();
  const { pages, sources, annotations, addAnnotation, updateAnnotation, removeAnnotation } = usePdf();
  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#e5484d');
  const [sizeIdx, setSizeIdx] = useState(1);
  const [sel, setSel] = useState(null); // { pageId, id }
  const [sigOpen, setSigOpen] = useState(false);
  const scrollRef = useRef(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const currentPage = useRef(pages[0]?.id);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBaseWidth(Math.min(1100, el.clientWidth - 48));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track the page nearest the viewport centre (for placing signatures).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const mid = el.scrollTop + el.clientHeight / 2;
      let best = null, bestDist = Infinity;
      el.querySelectorAll('[data-pageid]').forEach((node) => {
        const c = node.offsetTop + node.offsetHeight / 2;
        const d = Math.abs(c - mid);
        if (d < bestDist) { bestDist = d; best = node.dataset.pageid; }
      });
      if (best) currentPage.current = best;
    };
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [pages]);

  // Delete key removes the selected annotation (unless editing text).
  useEffect(() => {
    const onKey = (e) => {
      if (!sel) return;
      const editing = document.activeElement?.isContentEditable;
      if (editing) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { removeAnnotation(sel.pageId, sel.id); setSel(null); }
      if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, removeAnnotation]);

  const placeSignature = ({ dataUrl, ratio }) => {
    const pageId = currentPage.current || pages[0]?.id;
    if (!pageId) return;
    const id = addAnnotation(pageId, { type: 'image', x: 0.3, y: 0.4, w: 0.35, ratio, dataUrl });
    setSel({ pageId, id });
    setSigOpen(false);
    setTool('select');
  };

  const width = Math.max(200, baseWidth);
  const strokeW = STROKES[sizeIdx];
  const fontSize = FONTS[sizeIdx];

  return (
    <div className="annotate">
      <div className="anno-bar">
        <div className="anno-tools">
          {TOOLS.map(({ key, Icon }) => (
            <button key={key} className={`anno-tool ${tool === key ? 'on' : ''}`} title={t(`annotate.${key}`)} onClick={() => setTool(key)}>
              <Icon />
            </button>
          ))}
          <button className="anno-tool" title={t('annotate.signature')} onClick={() => setSigOpen(true)}><FiPenTool /></button>
        </div>

        <div className="anno-sep" />
        <div className="anno-colors">
          {COLORS.map((c) => (
            <button key={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
          <input type="color" className="swatch-custom" value={color} onChange={(e) => setColor(e.target.value)} title={t('annotate.color')} />
        </div>

        <div className="anno-sep" />
        <div className="anno-sizes">
          {['S', 'M', 'L'].map((s, i) => (
            <button key={s} className={`size-btn ${sizeIdx === i ? 'on' : ''}`} onClick={() => setSizeIdx(i)}>{s}</button>
          ))}
        </div>

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
              color={color}
              strokeW={strokeW}
              fontSize={fontSize}
              items={annotations[pg.id] || []}
              selectedId={sel?.pageId === pg.id ? sel.id : null}
              onSelect={(id) => setSel(id ? { pageId: pg.id, id } : null)}
              onAdd={(ann) => addAnnotation(pg.id, ann)}
              onUpdate={(id, patch) => updateAnnotation(pg.id, id, patch)}
            />
          </div>
        ))}
      </div>

      {sigOpen && <SignatureModal onDone={placeSignature} onClose={() => setSigOpen(false)} />}
    </div>
  );
}
