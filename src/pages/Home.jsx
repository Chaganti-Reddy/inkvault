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
  const { openFile, error } = usePdf();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) openFile(file);
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
          <button className="btn primary" type="button">{t('home.choose')}</button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])}
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
