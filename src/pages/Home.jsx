import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import {
  FiUpload, FiLayers, FiEdit3, FiEyeOff, FiSearch, FiType, FiLock, LuShieldCheck,
} from '../ui/icons.js';

const FEATURES = [
  { key: 'organize', Icon: FiLayers },
  { key: 'annotate', Icon: FiEdit3 },
  { key: 'redact', Icon: FiEyeOff },
  { key: 'ocr', Icon: FiSearch },
  { key: 'forms', Icon: FiType },
  { key: 'secure', Icon: FiLock },
];

export default function Home() {
  const { t } = useTranslation();
  const { openFile, importImages, error } = usePdf();
  const inputRef = useRef(null);
  const imgRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = [...(e.dataTransfer.files || [])];
    if (!files.length) return;
    if (files[0].type === 'application/pdf' || /\.pdf$/i.test(files[0].name)) openFile(files[0]);
    else importImages(files);
  };

  return (
    <main className="home">
      <section className="hero">
        <h1>{t('home.headline')}</h1>
        <p className="hero-sub">{t('home.sub')}</p>

        <div
          className={`dropzone ${dragging ? 'drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <FiUpload className="dz-icon" />
          <div className="dz-title">{t('home.drop')}</div>
          <div className="dz-or">{t('home.or')}</div>
          <div className="dz-buttons">
            <button className="btn primary" type="button">{t('home.choose')}</button>
            <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); imgRef.current?.click(); }}>{t('home.chooseImages')}</button>
          </div>
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
            accept="image/*"
            multiple
            hidden
            onChange={(e) => e.target.files?.length && importImages(e.target.files)}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <div className="privacy-line"><LuShieldCheck /> {t('home.privacy')}</div>
      </section>

      <section className="features">
        {FEATURES.map(({ key, Icon }) => (
          <div className="feature" key={key}>
            <Icon className="feature-icon" />
            <div className="feature-title">{t(`home.features.${key}`)}</div>
            <div className="feature-sub">{t(`home.features.${key}Sub`)}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
