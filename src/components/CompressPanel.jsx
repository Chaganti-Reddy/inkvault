import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import { buildPdf, compressBytes, downloadBytes } from '../lib/pdfops.js';
import { FiMinimize2, FiDownload } from '../ui/icons.js';

const LEVELS = [
  { key: 'high', dpi: 150, quality: 0.82 },
  { key: 'balanced', dpi: 110, quality: 0.62 },
  { key: 'small', dpi: 90, quality: 0.5 },
];

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function CompressPanel() {
  const { t } = useTranslation();
  const { pages, sources, annotations, formValues, fileName } = usePdf();
  const [level, setLevel] = useState('balanced');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { before, after, bytes }
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true); setError(''); setResult(null);
    try {
      const opts = LEVELS.find((l) => l.key === level);
      const base = await buildPdf(pages, sources, annotations, formValues);
      const compressed = await compressBytes(base, opts);
      setResult({ before: base.length, after: compressed.length, bytes: compressed });
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const saved = result ? Math.max(0, Math.round((1 - result.after / result.before) * 100)) : 0;

  return (
    <div className="ocr-panel">
      <div className="ocr-card">
        <FiMinimize2 className="ocr-icon" />
        <h2>{t('compress.title')}</h2>
        <p className="ocr-sub">{t('compress.sub')}</p>

        <div className="level-pick">
          {LEVELS.map((l) => (
            <button key={l.key} className={`level-btn ${level === l.key ? 'on' : ''}`} onClick={() => setLevel(l.key)} disabled={busy}>
              <span className="level-name">{t(`compress.${l.key}`)}</span>
              <span className="level-desc">{t(`compress.${l.key}Desc`)}</span>
            </button>
          ))}
        </div>

        <button className="btn primary" onClick={run} disabled={busy}>
          <FiMinimize2 /> {busy ? t('compress.working') : t('compress.run')}
        </button>

        {error && <div className="error">{error}</div>}
        {result && (
          <div className="compress-result">
            <div className="cr-sizes">
              <span>{fmtSize(result.before)}</span>
              <span className="cr-arrow">→</span>
              <span className="cr-after">{fmtSize(result.after)}</span>
              <span className={`cr-badge ${saved > 0 ? 'good' : ''}`}>{saved > 0 ? t('compress.saved', { pct: saved }) : t('compress.noGain')}</span>
            </div>
            <button className="btn primary sm" onClick={() => downloadBytes(result.bytes, (fileName || 'document').replace(/\.pdf$/i, '') + '-compressed.pdf')}>
              <FiDownload /> {t('common.download')}
            </button>
          </div>
        )}

        <p className="ocr-note">{t('compress.note')}</p>
      </div>
    </div>
  );
}
