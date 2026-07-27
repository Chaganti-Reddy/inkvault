import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import PdfViewer from '../components/PdfViewer.jsx';
import OrganizePanel from '../components/OrganizePanel.jsx';
import AnnotatePanel from '../components/AnnotatePanel.jsx';
import RedactPanel from '../components/RedactPanel.jsx';
import FormsPanel from '../components/FormsPanel.jsx';
import OcrPanel from '../components/OcrPanel.jsx';
import CompressPanel from '../components/CompressPanel.jsx';
import ProtectPanel from '../components/ProtectPanel.jsx';
import StampPanel from '../components/StampPanel.jsx';
import InfoPanel from '../components/InfoPanel.jsx';
import CropPanel from '../components/CropPanel.jsx';
import ExportPanel from '../components/ExportPanel.jsx';
import ToolRail from '../components/ToolRail.jsx';
import { buildPdf, downloadBytes, extractText, downloadText } from '../lib/pdfops.js';
import { FiZoomIn, FiZoomOut, FiMaximize, FiDownload, FiCornerUpLeft, FiCornerUpRight, FiFileText } from '../ui/icons.js';

export default function Editor() {
  const { t } = useTranslation();
  const { pages, sources, annotations, formValues, metadata, numPages, fileName, loading, dirty, undo, redo, canUndo, canRedo, pendingTool, setPendingTool } = usePdf();
  const [tool, setTool] = useState(pendingTool || 'view');
  const [zoom, setZoom] = useState(1);
  const [pageInView, setPageInView] = useState(1);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const downloadRef = useRef(null);

  // Consume the "open in this tool" hint set by the home page.
  useEffect(() => { if (pendingTool) setPendingTool(null); }, [pendingTool, setPendingTool]);

  // Warn before leaving with unsaved edits (edits live only in memory, by design).
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Undo/redo keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
      else if (k === 's') { e.preventDefault(); downloadRef.current?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  if (!numPages && !loading) return <Navigate to="/" replace />;

  const download = async () => {
    setSaving(true);
    try {
      const bytes = await buildPdf(pages, sources, annotations, formValues, metadata);
      downloadBytes(bytes, fileName || 'document.pdf');
    } finally {
      setSaving(false);
    }
  };
  downloadRef.current = download;

  const exportText = async () => {
    setExtracting(true);
    try {
      const text = await extractText(pages, sources, annotations, formValues);
      downloadText(text, (fileName || 'document').replace(/\.pdf$/i, '') + '.txt');
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="editor-shell">
      <ToolRail tool={tool} setTool={setTool} />
      <main className="editor">
        <div className="toolbar">
          <div className="toolbar-left">
            <button className="icon-btn" onClick={undo} disabled={!canUndo} title={t('editor.undo')} aria-label={t('editor.undo')}><FiCornerUpLeft /></button>
            <button className="icon-btn" onClick={redo} disabled={!canRedo} title={t('editor.redo')} aria-label={t('editor.redo')}><FiCornerUpRight /></button>
            {tool === 'view' && <span className="page-indicator">{t('viewer.page', { n: pageInView, total: numPages })}</span>}
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
            <button className="btn sm" onClick={exportText} disabled={extracting} title={t('editor.extractText')}>
              <FiFileText /> {extracting ? t('editor.extracting') : t('editor.textBtn')}
            </button>
            <button className="btn primary sm" onClick={download} disabled={saving}>
              <FiDownload /> {saving ? t('viewer.saving') : t('common.download')}
            </button>
          </div>
        </div>

        {tool === 'view' && <PdfViewer pages={pages} sources={sources} annotations={annotations} zoom={zoom} onPageInView={setPageInView} />}
        {tool === 'organize' && <OrganizePanel />}
        {tool === 'annotate' && <AnnotatePanel />}
        {tool === 'crop' && <CropPanel />}
        {tool === 'redact' && <RedactPanel />}
        {tool === 'forms' && <FormsPanel />}
        {tool === 'stamp' && <StampPanel />}
        {tool === 'ocr' && <OcrPanel />}
        {tool === 'compress' && <CompressPanel />}
        {tool === 'protect' && <ProtectPanel />}
        {tool === 'export' && <ExportPanel />}
        {tool === 'info' && <InfoPanel />}
        {loading && <div className="editor-loading">{t('viewer.loading')}</div>}
      </main>
    </div>
  );
}
