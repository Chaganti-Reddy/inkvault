import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import { renderPagesToImages, splitToSinglePages } from '../lib/pdfops.js';
import { downloadZip } from '../lib/zip.js';
import { FiImage, FiScissors } from '../ui/icons.js';

const QUALITY = [
  { key: 'screen', dpi: 96 },
  { key: 'good', dpi: 150 },
  { key: 'print', dpi: 300 },
];

export default function ExportPanel() {
  const { t } = useTranslation();
  const { pages, sources, annotations, formValues, metadata, fileName } = usePdf();
  const [format, setFormat] = useState('jpeg');
  const [q, setQ] = useState('good');
  const [busy, setBusy] = useState('');
  const base = (fileName || 'document').replace(/\.pdf$/i, '');

  const toImages = async () => {
    setBusy('img');
    try {
      const dpi = QUALITY.find((x) => x.key === q).dpi;
      const files = await renderPagesToImages(pages, sources, annotations, formValues, metadata, { format, dpi });
      await downloadZip(files, `${base}-${format === 'png' ? 'png' : 'jpg'}.zip`);
    } finally { setBusy(''); }
  };

  const toSplit = async () => {
    setBusy('split');
    try {
      const files = await splitToSinglePages(pages, sources, annotations, formValues, metadata);
      await downloadZip(files, `${base}-pages.zip`);
    } finally { setBusy(''); }
  };

  return (
    <div className="ocr-panel">
      <div className="stamp-cards">
        <div className="ocr-card">
          <FiImage className="ocr-icon" />
          <h2>{t('exp.imgTitle')}</h2>
          <p className="ocr-sub">{t('exp.imgSub')}</p>
          <label className="ocr-lang">{t('exp.format')}
            <select value={format} onChange={(e) => setFormat(e.target.value)} disabled={!!busy}>
              <option value="jpeg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </label>
          <label className="ocr-lang">{t('exp.quality')}
            <select value={q} onChange={(e) => setQ(e.target.value)} disabled={!!busy}>
              {QUALITY.map((x) => <option key={x.key} value={x.key}>{t(`exp.q_${x.key}`)}</option>)}
            </select>
          </label>
          <button className="btn primary" onClick={toImages} disabled={!!busy}>
            <FiImage /> {busy === 'img' ? t('exp.working') : t('exp.imgBtn', { n: pages.length })}
          </button>
        </div>

        <div className="ocr-card">
          <FiScissors className="ocr-icon" />
          <h2>{t('exp.splitTitle')}</h2>
          <p className="ocr-sub">{t('exp.splitSub')}</p>
          <button className="btn primary" onClick={toSplit} disabled={!!busy}>
            <FiScissors /> {busy === 'split' ? t('exp.working') : t('exp.splitBtn', { n: pages.length })}
          </button>
          <p className="ocr-note">{t('exp.note')}</p>
        </div>
      </div>
    </div>
  );
}
