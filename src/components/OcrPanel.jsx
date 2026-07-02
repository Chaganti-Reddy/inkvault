import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import { createRecognizer, OCR_LANGS } from '../lib/ocr.js';
import { rasterizePage } from '../lib/pdfview.js';
import { FiSearch, LuShieldCheck } from '../ui/icons.js';

const OCR_DPI = 200;

export default function OcrPanel() {
  const { t } = useTranslation();
  const { pages, sources, annotations, setOcrLayer } = usePdf();
  const [lang, setLang] = useState('eng');
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState({ page: 0, total: 0, pct: 0 });
  const [error, setError] = useState('');

  const ocrPageCount = pages.filter((p) => (annotations[p.id] || []).some((a) => a.type === 'otext')).length;

  const run = async () => {
    setRunning(true);
    setError('');
    let rec = null;
    try {
      rec = await createRecognizer(lang, (m) => {
        if (m.status === 'recognizing text') setProg((p) => ({ ...p, pct: Math.round(m.progress * 100) }));
      });
      for (let i = 0; i < pages.length; i++) {
        const pg = pages[i];
        setProg({ page: i + 1, total: pages.length, pct: 0 });
        const { canvas } = await rasterizePage(sources[pg.srcKey].doc, pg.index + 1, OCR_DPI, pg.rotation || 0);
        const words = await rec.recognize(canvas);
        const items = words.map((w) => ({
          x: w.bbox.x0 / canvas.width,
          y: w.bbox.y0 / canvas.height,
          size: Math.max(0.006, (w.bbox.y1 - w.bbox.y0) / canvas.height),
          text: w.text,
        })).filter((it) => it.size > 0);
        setOcrLayer(pg.id, items);
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      if (rec) await rec.terminate();
      setRunning(false);
      setProg({ page: 0, total: 0, pct: 0 });
    }
  };

  return (
    <div className="ocr-panel">
      <div className="ocr-card">
        <FiSearch className="ocr-icon" />
        <h2>{t('ocr.title')}</h2>
        <p className="ocr-sub">{t('ocr.sub')}</p>

        <label className="ocr-lang">
          {t('ocr.language')}
          <select value={lang} onChange={(e) => setLang(e.target.value)} disabled={running}>
            {OCR_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>

        <button className="btn primary" onClick={run} disabled={running}>
          <FiSearch /> {running ? t('ocr.running', { page: prog.page, total: prog.total, pct: prog.pct }) : t('ocr.run', { n: pages.length })}
        </button>

        {running && <div className="ocr-progress"><div style={{ width: `${prog.total ? ((prog.page - 1) / prog.total) * 100 + prog.pct / prog.total : 0}%` }} /></div>}
        {error && <div className="error">{error}</div>}
        {!running && ocrPageCount > 0 && <div className="ocr-done"><LuShieldCheck /> {t('ocr.done', { n: ocrPageCount })}</div>}

        <p className="ocr-note">{t('ocr.note')}</p>
      </div>
    </div>
  );
}
