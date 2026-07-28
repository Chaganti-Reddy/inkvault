import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import AnnotateLayer from './AnnotateLayer.jsx';
import { FiMousePointer, FiType, FiCheckSquare, FiTrash2 } from '../ui/icons.js';

// Draw fillable form fields onto pages. Each becomes a real AcroForm field on export.
export default function FormBuildPanel({ zoom = 1 }) {
  const { t } = useTranslation();
  const { pages, sources, annotations, addAnnotation, updateAnnotation, removeAnnotation, applyStamps, beginChange } = usePdf();
  const [tool, setTool] = useState('textfield');
  const [sel, setSel] = useState(null);
  const scrollRef = useRef(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const counter = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBaseWidth(Math.min(1400, el.clientWidth - 48));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Seed the auto-name counter past any fields already on the pages, so re-entering
  // the tool doesn't restart at Field1 and collide with existing names.
  useEffect(() => {
    let max = 0;
    for (const a of Object.values(annotations).flat()) {
      const m = /(\d+)$/.exec(a?.name || '');
      if (a?.type === 'field' && m) max = Math.max(max, Number(m[1]));
    }
    counter.current = Math.max(counter.current, max);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (!sel || document.activeElement?.isContentEditable || document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { removeAnnotation(sel.pageId, sel.id); setSel(null); }
      if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, removeAnnotation]);

  // Drop a selection that no longer exists (e.g. after undo, or Clear fields).
  useEffect(() => {
    if (sel && !(annotations[sel.pageId] || []).some((a) => a.id === sel.id)) setSel(null);
  }, [annotations, sel]);

  const width = Math.max(200, baseWidth * zoom);
  const count = Object.values(annotations).flat().filter((a) => a.type === 'field').length;
  const selAnn = sel ? (annotations[sel.pageId] || []).find((a) => a.id === sel.id) : null;

  return (
    <div className="annotate">
      <div className="anno-bar">
        <div className="anno-tools">
          <button className={`anno-tool ${tool === 'select' ? 'on' : ''}`} title={t('annotate.select')} onClick={() => setTool('select')}><FiMousePointer /></button>
          <button className={`anno-tool ${tool === 'textfield' ? 'on' : ''}`} title={t('build.text')} onClick={() => setTool('textfield')}><FiType /></button>
          <button className={`anno-tool ${tool === 'checkbox' ? 'on' : ''}`} title={t('build.checkbox')} onClick={() => setTool('checkbox')}><FiCheckSquare /></button>
        </div>
        {selAnn ? (
          <label className="field-name-edit">
            {t('build.fieldName')}
            <input type="text" value={selAnn.name || ''} onFocus={() => beginChange()}
              onChange={(e) => updateAnnotation(sel.pageId, sel.id, { name: e.target.value })} />
          </label>
        ) : (
          <div className="redact-note">{t('build.note', { count })}</div>
        )}
        <div className="spacer" />
        {count > 0 && <button className="btn sm" onClick={() => applyStamps('field', {})}><FiTrash2 /> {t('build.clear')}</button>}
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
              onAdd={(ann) => addAnnotation(pg.id, { ...ann, name: `${ann.fieldType === 'checkbox' ? 'Check' : 'Field'}${++counter.current}` })}
              onUpdate={(id, patch) => updateAnnotation(pg.id, id, patch)}
              onBeginChange={beginChange}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
