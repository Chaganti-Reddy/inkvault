import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import { FiInfo } from '../ui/icons.js';

// Document properties (metadata) editor — baked into the file on export.
export default function InfoPanel() {
  const { t } = useTranslation();
  const { metadata, setMetadata } = usePdf();
  const field = (key) => ({ value: metadata[key] || '', onChange: (e) => setMetadata({ [key]: e.target.value }) });

  return (
    <div className="ocr-panel">
      <div className="ocr-card">
        <FiInfo className="ocr-icon" />
        <h2>{t('info.title')}</h2>
        <p className="ocr-sub">{t('info.sub')}</p>
        <label className="ocr-lang">{t('info.docTitle')}<input {...field('title')} /></label>
        <label className="ocr-lang">{t('info.author')}<input {...field('author')} /></label>
        <label className="ocr-lang">{t('info.subject')}<input {...field('subject')} /></label>
        <label className="ocr-lang">{t('info.keywords')}<input {...field('keywords')} placeholder={t('info.keywordsHint')} /></label>
        <p className="ocr-note">{t('info.note')}</p>
      </div>
    </div>
  );
}
