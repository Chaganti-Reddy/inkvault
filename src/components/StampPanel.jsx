import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import { FiDroplet, FiHash } from '../ui/icons.js';

const POSITIONS = {
  'bottom-center': { x: 0.5, y: 0.955, align: 'center' },
  'bottom-right': { x: 0.9, y: 0.955, align: 'right' },
  'bottom-left': { x: 0.1, y: 0.955, align: 'left' },
  'top-center': { x: 0.5, y: 0.05, align: 'center' },
  'top-right': { x: 0.9, y: 0.05, align: 'right' },
};

function formatNumber(fmt, n, total) {
  return fmt.replace(/\{n\}/g, n).replace(/\{total\}/g, total);
}

export default function StampPanel() {
  const { t } = useTranslation();
  const { pages, annotations, applyStamps } = usePdf();

  const [wmText, setWmText] = useState('CONFIDENTIAL');
  const [wmOpacity, setWmOpacity] = useState(0.15);

  const [fmt, setFmt] = useState('{n}');
  const [pos, setPos] = useState('bottom-center');
  const [start, setStart] = useState(1);

  const hasWm = Object.values(annotations).flat().some((a) => a.type === 'watermark');
  const hasNum = Object.values(annotations).flat().some((a) => a.type === 'pagenum');

  const applyWatermark = () => {
    if (!wmText.trim()) return;
    const byPage = {};
    for (const pg of pages) {
      byPage[pg.id] = [{ type: 'watermark', text: wmText, x: 0.16, y: 0.62, size: 0.09, angle: 45, opacity: wmOpacity, color: '#000000' }];
    }
    applyStamps('watermark', byPage);
  };

  const applyNumbers = () => {
    const p = POSITIONS[pos];
    const total = pages.length;
    const byPage = {};
    pages.forEach((pg, i) => {
      byPage[pg.id] = [{ type: 'pagenum', text: formatNumber(fmt, String(start + i), String(total)), x: p.x, y: p.y, size: 0.016, align: p.align, color: '#333333' }];
    });
    applyStamps('pagenum', byPage);
  };

  return (
    <div className="ocr-panel">
      <div className="stamp-cards">
        <div className="ocr-card">
          <FiDroplet className="ocr-icon" />
          <h2>{t('stamp.wmTitle')}</h2>
          <p className="ocr-sub">{t('stamp.wmSub')}</p>
          <label className="ocr-lang">
            {t('stamp.wmText')}
            <input value={wmText} onChange={(e) => setWmText(e.target.value)} />
          </label>
          <label className="ocr-lang">
            {t('stamp.wmOpacity', { pct: Math.round(wmOpacity * 100) })}
            <input type="range" min="5" max="60" value={wmOpacity * 100} onChange={(e) => setWmOpacity(Number(e.target.value) / 100)} />
          </label>
          <button className="btn primary" onClick={applyWatermark}>{t('stamp.wmApply', { n: pages.length })}</button>
          {hasWm && <button className="btn sm stamp-clear" onClick={() => applyStamps('watermark', {})}>{t('stamp.remove')}</button>}
        </div>

        <div className="ocr-card">
          <FiHash className="ocr-icon" />
          <h2>{t('stamp.numTitle')}</h2>
          <p className="ocr-sub">{t('stamp.numSub')}</p>
          <label className="ocr-lang">
            {t('stamp.numFormat')}
            <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
              <option value="{n}">1</option>
              <option value="Page {n}">Page 1</option>
              <option value="{n} / {total}">1 / {pages.length}</option>
              <option value="Page {n} of {total}">Page 1 of {pages.length}</option>
            </select>
          </label>
          <label className="ocr-lang">
            {t('stamp.numPosition')}
            <select value={pos} onChange={(e) => setPos(e.target.value)}>
              <option value="bottom-center">{t('stamp.posBottomCenter')}</option>
              <option value="bottom-right">{t('stamp.posBottomRight')}</option>
              <option value="bottom-left">{t('stamp.posBottomLeft')}</option>
              <option value="top-center">{t('stamp.posTopCenter')}</option>
              <option value="top-right">{t('stamp.posTopRight')}</option>
            </select>
          </label>
          <label className="ocr-lang">
            {t('stamp.numStart')}
            <input type="number" min="1" value={start} onChange={(e) => setStart(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <button className="btn primary" onClick={applyNumbers}>{t('stamp.numApply', { n: pages.length })}</button>
          {hasNum && <button className="btn sm stamp-clear" onClick={() => applyStamps('pagenum', {})}>{t('stamp.remove')}</button>}
        </div>
      </div>
    </div>
  );
}
