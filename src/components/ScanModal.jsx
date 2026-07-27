import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCamera, FiX, FiTrash2 } from '../ui/icons.js';

// Capture pages from the device camera and turn them into a PDF (via images→PDF).
// The stream stays on-device; nothing is uploaded.
export default function ScanModal({ onClose, onDone }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [shots, setShots] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError(t('scan.noCamera')));
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((tr) => tr.stop()); };
  }, [t]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob((b) => setShots((s) => [...s, { url: URL.createObjectURL(b), blob: b }]), 'image/jpeg', 0.9);
  };

  const removeShot = (i) => setShots((s) => s.filter((_, idx) => idx !== i));
  const create = () => onDone(shots.map((s, i) => new File([s.blob], `scan-${i + 1}.jpg`, { type: 'image/jpeg' })));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal scan-modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label={t('common.close')}><FiX /></button>
        <h3>{t('scan.title')}</h3>
        {error ? (
          <div className="error">{error}</div>
        ) : (
          <div className="scan-video-wrap"><video ref={videoRef} autoPlay playsInline muted className="scan-video" /></div>
        )}
        {!error && (
          <div className="scan-actions">
            <button className="btn" onClick={capture}><FiCamera /> {t('scan.capture')}</button>
            <button className="btn primary" onClick={create} disabled={!shots.length}>{t('scan.create', { n: shots.length })}</button>
          </div>
        )}
        {shots.length > 0 && (
          <div className="scan-strip">
            {shots.map((s, i) => (
              <div className="scan-shot" key={i}>
                <img src={s.url} alt="" />
                <button className="thumb-btn danger" onClick={() => removeShot(i)}><FiTrash2 /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
