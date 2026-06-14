import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import PdfViewer from '../components/PdfViewer.jsx';
import { FiZoomIn, FiZoomOut, FiMaximize, FiDownload } from '../ui/icons.js';

export default function Editor() {
  const { t } = useTranslation();
  const { doc, numPages, fileName, loading, bytes } = usePdf();
  const [zoom, setZoom] = useState(1);
  const [pageInView, setPageInView] = useState(1);

  if (!doc && !loading) return <Navigate to="/" replace />;

  const download = () => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="editor">
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="page-indicator">{t('viewer.page', { n: pageInView, total: numPages })}</span>
        </div>
        <div className="toolbar-center">
          <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))} aria-label={t('viewer.zoomOut')}><FiZoomOut /></button>
          <span className="zoom-val">{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} aria-label={t('viewer.zoomIn')}><FiZoomIn /></button>
          <button className="icon-btn" onClick={() => setZoom(1)} aria-label={t('viewer.fit')}><FiMaximize /></button>
        </div>
        <div className="toolbar-right">
          <button className="btn primary sm" onClick={download}><FiDownload /> {t('common.download')}</button>
        </div>
      </div>

      {doc && (
        <PdfViewer doc={doc} numPages={numPages} zoom={zoom} onPageInView={setPageInView} />
      )}
      {loading && <div className="editor-loading">{t('viewer.loading')}</div>}
    </main>
  );
}
