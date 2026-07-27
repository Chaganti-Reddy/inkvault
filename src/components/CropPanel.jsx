import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import AnnotateLayer from './AnnotateLayer.jsx';
import { FiCrop, FiTrash2 } from '../ui/icons.js';

// Draw a rectangle on a page to crop it to that area (one crop box per page).
// Applied as the page's CropBox on export.
export default function CropPanel({ zoom = 1 }) {
  const { t } = useTranslation();
  const { pages, sources, annotations, setPageCrop, beginChange } = usePdf();
  const scrollRef = useRef(null);
  const [baseWidth, setBaseWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBaseWidth(Math.min(1400, el.clientWidth - 48));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = Math.max(200, baseWidth * zoom);
  const count = Object.values(annotations).flat().filter((a) => a.type === 'crop').length;
  const clearAll = () => pages.forEach((p) => setPageCrop(p.id, null));

  return (
    <div className="annotate">
      <div className="anno-bar">
        <div className="redact-note"><FiCrop /> {t('crop.note', { count })}</div>
        <div className="spacer" />
        {count > 0 && <button className="btn sm" onClick={clearAll}><FiTrash2 /> {t('crop.clear')}</button>}
      </div>
      <div className="anno-scroll" ref={scrollRef}>
        {pages.map((pg) => (
          <div key={pg.id} data-pageid={pg.id} className="anno-page-wrap">
            <AnnotateLayer
              page={pg}
              source={sources[pg.srcKey]}
              width={width}
              tool="crop"
              color="#000000"
              strokeW={0.004}
              fontSize={0.03}
              items={annotations[pg.id] || []}
              selectedId={null}
              onSelect={() => {}}
              onAdd={(ann) => setPageCrop(pg.id, { x: ann.x, y: ann.y, w: ann.w, h: ann.h })}
              onUpdate={() => {}}
              onBeginChange={beginChange}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
