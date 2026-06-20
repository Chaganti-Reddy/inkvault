import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX } from '../ui/icons.js';

// Produces a transparent-background PNG signature via drawing, typing, or upload.
// onDone receives { dataUrl, ratio } where ratio = height / width.
export default function SignatureModal({ onDone, onClose }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('draw');
  const [typed, setTyped] = useState('');
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (tab !== 'draw') return;
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  }, [tab]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvasRef.current.width / r.width), y: (e.clientY - r.top) * (canvasRef.current.height / r.height) };
  };
  const down = (e) => { drawing.current = true; dirty.current = true; const ctx = canvasRef.current.getContext('2d'); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (!drawing.current) return; const ctx = canvasRef.current.getContext('2d'); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const up = () => { drawing.current = false; };
  const clearDraw = () => { const c = canvasRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); dirty.current = false; };

  // Trim transparent margins and return { dataUrl, ratio }.
  const finishCanvas = (c) => {
    const ctx = c.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let minX = width, minY = height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 10) {
          found = true;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) return null;
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d').drawImage(c, minX, minY, w, h, 0, 0, w, h);
    return { dataUrl: out.toDataURL('image/png'), ratio: h / w };
  };

  const confirmDraw = () => { if (!dirty.current) return; const r = finishCanvas(canvasRef.current); if (r) onDone(r); };

  const confirmTyped = () => {
    if (!typed.trim()) return;
    const c = document.createElement('canvas');
    c.width = 600; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.font = '72px "Segoe Script", "Brush Script MT", cursive';
    ctx.textBaseline = 'middle';
    ctx.fillText(typed, 20, 100);
    const r = finishCanvas(c);
    if (r) onDone(r);
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => onDone({ dataUrl: reader.result, ratio: img.height / img.width });
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sig-modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label={t('common.close')}><FiX /></button>
        <h3>{t('sign.title')}</h3>
        <div className="sig-tabs">
          <button className={tab === 'draw' ? 'on' : ''} onClick={() => setTab('draw')}>{t('sign.draw')}</button>
          <button className={tab === 'type' ? 'on' : ''} onClick={() => setTab('type')}>{t('sign.type')}</button>
          <button className={tab === 'upload' ? 'on' : ''} onClick={() => setTab('upload')}>{t('sign.upload')}</button>
        </div>

        {tab === 'draw' && (
          <div className="sig-body">
            <canvas ref={canvasRef} width={560} height={200} className="sig-canvas"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
            <div className="sig-actions">
              <button className="btn sm" onClick={clearDraw}>{t('sign.clear')}</button>
              <button className="btn primary sm" onClick={confirmDraw}>{t('sign.place')}</button>
            </div>
          </div>
        )}
        {tab === 'type' && (
          <div className="sig-body">
            <input className="sig-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('sign.typePlaceholder')} autoFocus />
            <div className="sig-preview" aria-hidden="true">{typed}</div>
            <div className="sig-actions">
              <button className="btn primary sm" onClick={confirmTyped}>{t('sign.place')}</button>
            </div>
          </div>
        )}
        {tab === 'upload' && (
          <div className="sig-body">
            <input type="file" accept="image/*" onChange={onUpload} />
            <p className="sig-hint">{t('sign.uploadHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
