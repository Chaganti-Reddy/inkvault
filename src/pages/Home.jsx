import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import { IMAGE_ACCEPT } from '../lib/images.js';
import { compressImages } from '../lib/imagetools.js';
import { downloadZip } from '../lib/zip.js';
import { downloadBlob } from '../lib/pdfops.js';
import { toast } from '../lib/toast.js';
import ScanModal from '../components/ScanModal.jsx';
import {
  FiUpload, FiLayers, FiEdit3, FiEyeOff, FiSearch, FiType, FiLock, FiMinimize2, FiCamera, LuShieldCheck,
} from '../ui/icons.js';
// FiLock is used both in the feature grid and the unlock modal.

const FEATURES = [
  { key: 'organize', tool: 'organize', Icon: FiLayers },
  { key: 'annotate', tool: 'annotate', Icon: FiEdit3 },
  { key: 'redact', tool: 'redact', Icon: FiEyeOff },
  { key: 'ocr', tool: 'ocr', Icon: FiSearch },
  { key: 'forms', tool: 'forms', Icon: FiType },
  { key: 'secure', tool: 'protect', Icon: FiLock },
];

export default function Home() {
  const { t } = useTranslation();
  const { openFile, importImages, error, loading, locked, unlocking, unlockWithPassword, cancelUnlock, setPendingTool } = usePdf();
  const inputRef = useRef(null);
  const imgRef = useRef(null);
  const compressRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pw, setPw] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const compressPick = async (files) => {
    setCompressing(true);
    try {
      const out = await compressImages([...files], { quality: 0.7, maxDim: 2000 });
      if (out.length === 1) downloadBlob(out[0].blob, out[0].name);
      else await downloadZip(out.map((o) => ({ name: o.name, data: o.blob })), 'compressed-images.zip');
      const saved = out.reduce((a, o) => a + (o.before - o.after), 0);
      toast(t('home.compressedToast', { n: out.length, kb: Math.max(0, Math.round(saved / 1024)) }));
    } catch (e) {
      toast(e?.message || String(e), 'error');
    } finally {
      setCompressing(false);
    }
  };

  useEffect(() => {
    if (!locked) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') cancelUnlock(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, cancelUnlock]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = [...(e.dataTransfer.files || [])];
    if (!files.length) return;
    if (files[0].type === 'application/pdf' || /\.pdf$/i.test(files[0].name)) openFile(files[0]);
    else importImages(files);
  };

  return (
    <main
      className="home"
      onDragOver={(e) => { e.preventDefault(); if (!loading) setDragging(true); }}
      onDragLeave={(e) => { if (e.target === e.currentTarget) setDragging(false); }}
      onDrop={(e) => !loading && onDrop(e)}
    >
      <section className="hero">
        <h1>{t('home.headline')}</h1>
        <p className="hero-sub">{t('home.sub')}</p>

        <div
          className={`dropzone ${dragging ? 'drag' : ''} ${loading ? 'loading' : ''}`}
          onDragOver={(e) => { e.preventDefault(); if (!loading) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => !loading && onDrop(e)}
          onClick={() => !loading && inputRef.current?.click()}
        >
          {loading ? (
            <>
              <span className="dz-spinner" />
              <div className="dz-title">{t('home.working')}</div>
            </>
          ) : (
            <>
              <FiUpload className="dz-icon" />
              <div className="dz-title">{t('home.drop')}</div>
              <div className="dz-or">{t('home.or')}</div>
              <div className="dz-buttons">
                <button className="btn primary" type="button">{t('home.choose')}</button>
                <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); imgRef.current?.click(); }}>{t('home.chooseImages')}</button>
              </div>
            </>
          )}
        </div>

        {/* Inputs live OUTSIDE the dropzone: a programmatic .click() dispatches a click
            that would otherwise bubble to the dropzone's onClick and open the wrong picker. */}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])}
        />
        <input
          ref={imgRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(e) => e.target.files?.length && importImages(e.target.files)}
        />
        <input
          ref={compressRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(e) => { if (e.target.files?.length) compressPick(e.target.files); e.target.value = ''; }}
        />

        {error && <div className="error">{error}</div>}

        <div className="more-tools">
          <button className="btn sm" type="button" onClick={() => compressRef.current?.click()} disabled={compressing}>
            <FiMinimize2 /> {compressing ? t('home.compressing') : t('home.compressImages')}
          </button>
          <button className="btn sm" type="button" onClick={() => setScanOpen(true)}>
            <FiCamera /> {t('home.scan')}
          </button>
        </div>

        <div className="privacy-line"><LuShieldCheck /> {t('home.privacy')}</div>
      </section>

      {scanOpen && <ScanModal onClose={() => setScanOpen(false)} onDone={(files) => { setScanOpen(false); importImages(files); }} />}

      {locked && (
        <div className="modal-backdrop" onClick={cancelUnlock}>
          <form
            className="modal pw-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (pw) unlockWithPassword(pw); }}
          >
            <FiLock className="pw-icon" />
            <h3>{t('home.lockedTitle')}</h3>
            <p className="pw-sub">{t('home.lockedSub', { name: locked.name })}</p>
            <input
              type="password"
              autoFocus
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t('home.passwordPlaceholder')}
            />
            {error && <div className="error">{error}</div>}
            <div className="pw-actions">
              <button type="button" className="btn" onClick={cancelUnlock}>{t('common.cancel')}</button>
              <button type="submit" className="btn primary" disabled={!pw || unlocking}>
                {unlocking ? t('home.unlocking') : t('home.unlock')}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="features">
        {FEATURES.map(({ key, tool, Icon }) => (
          <button className="feature" key={key} type="button" onClick={() => { setPendingTool(tool); inputRef.current?.click(); }}>
            <Icon className="feature-icon" />
            <div className="feature-title">{t(`home.features.${key}`)}</div>
            <div className="feature-sub">{t(`home.features.${key}Sub`)}</div>
          </button>
        ))}
      </section>
    </main>
  );
}
