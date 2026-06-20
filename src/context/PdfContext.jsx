import { createContext, useContext, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadDocument, readFileBytes, isPdf } from '../lib/pdfview.js';
import i18n from '../i18n.js';

const Ctx = createContext(null);
export const usePdf = () => useContext(Ctx);

let idSeq = 0;
const nextId = () => `p${++idSeq}`;

// The document is a *model*: an ordered list of page items, each pointing at a
// source PDF (by key), a page index within it, and a rotation. Reorder / delete /
// rotate just edit this array — cheap, no re-render of unaffected pages. Merge adds
// a new source and appends its pages. Bytes are only rebuilt (via pdf-lib) on export.
export function PdfProvider({ children }) {
  const navigate = useNavigate();
  const [sources, setSources] = useState({}); // key -> { bytes, doc, name }
  const [pages, setPages] = useState([]); // [{ id, srcKey, index, rotation }]
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [annotations, setAnnotations] = useState({}); // pageId -> [{ id, type, ... normalized coords }]

  const reset = useCallback(() => {
    setSources({}); setPages([]); setFileName(''); setError(''); setDirty(false); setAnnotations({});
  }, []);

  const openBytes = useCallback(async (data, name) => {
    setError('');
    setLoading(true);
    try {
      const canonical = data instanceof Uint8Array ? data : new Uint8Array(data);
      const doc = await loadDocument(canonical.slice());
      const key = 's0';
      const items = Array.from({ length: doc.numPages }, (_, i) => ({ id: nextId(), srcKey: key, index: i, rotation: 0 }));
      setSources({ [key]: { bytes: canonical, doc, name: name || 'document.pdf' } });
      setPages(items);
      setFileName(name || 'document.pdf');
      setDirty(false);
      navigate('/edit');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const openFile = useCallback(async (file) => {
    if (!isPdf(file)) { setError(i18n.t('home.errorType')); return; }
    const data = await readFileBytes(file);
    await openBytes(data, file.name);
  }, [openBytes]);

  // Merge another PDF's pages onto the end of the model.
  const mergeFile = useCallback(async (file) => {
    if (!isPdf(file)) { setError(i18n.t('home.errorType')); return; }
    const data = await readFileBytes(file);
    const canonical = new Uint8Array(data);
    const doc = await loadDocument(canonical.slice());
    const key = `s${Date.now()}`;
    const items = Array.from({ length: doc.numPages }, (_, i) => ({ id: nextId(), srcKey: key, index: i, rotation: 0 }));
    setSources((s) => ({ ...s, [key]: { bytes: canonical, doc, name: file.name } }));
    setPages((p) => [...p, ...items]);
    setDirty(true);
  }, []);

  const rotatePages = useCallback((ids, delta = 90) => {
    const set = new Set(ids);
    setPages((p) => p.map((pg) => (set.has(pg.id) ? { ...pg, rotation: (pg.rotation + delta + 360) % 360 } : pg)));
    setDirty(true);
  }, []);

  const deletePages = useCallback((ids) => {
    const set = new Set(ids);
    setPages((p) => (p.length - set.size < 1 ? p : p.filter((pg) => !set.has(pg.id))));
    setDirty(true);
  }, []);

  const duplicatePages = useCallback((ids) => {
    const set = new Set(ids);
    setPages((p) => {
      const out = [];
      for (const pg of p) {
        out.push(pg);
        if (set.has(pg.id)) out.push({ ...pg, id: nextId() });
      }
      return out;
    });
    setDirty(true);
  }, []);

  // Reorder to an explicit new list of page ids.
  const reorderPages = useCallback((orderedIds) => {
    setPages((p) => {
      const byId = new Map(p.map((pg) => [pg.id, pg]));
      const next = orderedIds.map((id) => byId.get(id)).filter(Boolean);
      return next.length === p.length ? next : p;
    });
    setDirty(true);
  }, []);

  // --- annotations (coords normalized 0..1 to the displayed page box) ---
  const addAnnotation = useCallback((pageId, ann) => {
    const withId = { id: nextId(), ...ann };
    setAnnotations((a) => ({ ...a, [pageId]: [...(a[pageId] || []), withId] }));
    setDirty(true);
    return withId.id;
  }, []);
  const updateAnnotation = useCallback((pageId, id, patch) => {
    setAnnotations((a) => ({ ...a, [pageId]: (a[pageId] || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    setDirty(true);
  }, []);
  const removeAnnotation = useCallback((pageId, id) => {
    setAnnotations((a) => ({ ...a, [pageId]: (a[pageId] || []).filter((x) => x.id !== id) }));
    setDirty(true);
  }, []);

  const close = useCallback(() => { reset(); navigate('/'); }, [reset, navigate]);

  const value = {
    sources, pages, fileName, loading, error, dirty, setError, setDirty,
    openFile, openBytes, mergeFile, rotatePages, deletePages, duplicatePages, reorderPages, close,
    annotations, addAnnotation, updateAnnotation, removeAnnotation,
    numPages: pages.length,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
