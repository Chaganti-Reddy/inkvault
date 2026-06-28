import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import FormPageLayer from './FormPageLayer.jsx';
import { FiType } from '../ui/icons.js';

export default function FormsPanel() {
  const { t } = useTranslation();
  const { pages, sources, formValues, setFormValue } = usePdf();
  const scrollRef = useRef(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const counts = useRef({});
  const [totalFields, setTotalFields] = useState(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBaseWidth(Math.min(820, el.clientWidth - 48));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = Math.max(200, baseWidth);

  const noteCount = useCallback((pageId, n) => {
    counts.current[pageId] = n;
    setTotalFields(Object.values(counts.current).reduce((a, b) => a + b, 0));
  }, []);

  return (
    <div className="annotate">
      <div className="anno-bar">
        <div className="redact-note"><FiType /> {totalFields === 0 ? t('forms.none') : t('forms.hint')}</div>
      </div>
      <div className="anno-scroll" ref={scrollRef}>
        {pages.map((pg) => (
          <div key={pg.id} className="anno-page-wrap">
            <FormPageLayer
              page={pg}
              source={sources[pg.srcKey]}
              width={width}
              values={formValues[pg.srcKey]}
              onSet={(name, value) => setFormValue(pg.srcKey, name, value)}
              onCount={(n) => noteCount(pg.id, n)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
