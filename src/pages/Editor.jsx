import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import PdfViewer from '../components/PdfViewer.jsx';
import OrganizePanel from '../components/OrganizePanel.jsx';
import ToolRail from '../components/ToolRail.jsx';
import { buildPdf, downloadBytes } from '../lib/pdfops.js';
import { FiZoomIn, FiZoomOut, FiMaximize, FiDownload } from '../ui/icons.js';

export default function Editor() {
  const { t } = useTranslation();
  const { pages, sources, numPages, fileName, loading } = usePdf();
  const [tool, setTool] = useState('view');
  const [zoom, setZoom] = useState(1);
  const [pageInView, setPageInView] = useState(1);
  const [saving, setSaving] = useState(false);

  if (!numPages && !loading) return <Navigate to="/" replace />;

  const download = async () => {
    setSaving(true);
    try {
      const bytes = await buildPdf(pages, sources);
      downloadBytes(bytes, fileName || 'document.pdf');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-shell">
      <ToolRail tool={tool} setTool={setTool} />
      <main className="editor">
        <div className="toolbar">
          <div className="toolbar-left">
            {tool === 'view' && <span className="page-indicator">{t('viewer.page', { n: pageInView, total: numPages })}</span>}
            {tool === 'organize' && <span className="page-indicator">{t('tool.organize')}</span>}
          </div>
          <div className="toolbar-center">
            {tool === 'view' && (
              <>
                <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))} aria-label={t('viewer.zoomOut')}><FiZoomOut /></button>
                <span className="zoom-val">{Math.round(zoom * 100)}%</span>
                <button className="icon-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.15))} aria-label={t('viewer.zoomIn')}><FiZoomIn /></button>
                <button className="icon-btn" onClick={() => setZoom(1)} aria-label={t('viewer.fit')}><FiMaximize /></button>
              </>
            )}
          </div>
          <div className="toolbar-right">
            <button className="btn primary sm" onClick={download} disabled={saving}>
              <FiDownload /> {saving ? t('viewer.saving') : t('common.download')}
            </button>
          </div>
        </div>

        {tool === 'view' && <PdfViewer pages={pages} sources={sources} zoom={zoom} onPageInView={setPageInView} />}
        {tool === 'organize' && <OrganizePanel />}
        {loading && <div className="editor-loading">{t('viewer.loading')}</div>}
      </main>
    </div>
  );
}
