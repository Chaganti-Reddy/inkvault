import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadDocument, readFileBytes, isPdf } from '../lib/pdfview.js';
import { imagesToPdf, isImage } from '../lib/images.js';
import { decryptBytes } from '../lib/protect.js';
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
  const [locked, setLocked] = useState(null); // { bytes, name } when an encrypted PDF needs a password
  const [unlocking, setUnlocking] = useState(false);
  const [annotations, setAnnotations] = useState({}); // pageId -> [{ id, type, ... normalized coords }]
  const [formValues, setFormValues] = useState({}); // srcKey -> { fieldName: value }

  // Undo/redo: a ref mirrors the current editable state so history snapshots capture
  // the latest values without stale closures, and past/future drive the UI.
  const stateRef = useRef({ pages: [], annotations: {}, formValues: {} });
  useEffect(() => { stateRef.current = { pages, annotations, formValues }; }, [pages, annotations, formValues]);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const pushHistory = useCallback(() => {
    setPast((p) => [...p.slice(-49), stateRef.current]);
    setFuture([]);
  }, []);
  const clearHistory = useCallback(() => { setPast([]); setFuture([]); }, []);

  const restore = useCallback((snap) => {
    setPages(snap.pages); setAnnotations(snap.annotations); setFormValues(snap.formValues);
    stateRef.current = snap;
    setDirty(true);
  }, []);
  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [stateRef.current, ...f].slice(0, 50));
      restore(p[p.length - 1]);
      return p.slice(0, -1);
    });
  }, [restore]);
  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p.slice(-49), stateRef.current]);
      restore(f[0]);
      return f.slice(1);
    });
  }, [restore]);

  const reset = useCallback(() => {
    setSources({}); setPages([]); setFileName(''); setError(''); setDirty(false); setAnnotations({}); setFormValues({}); setLocked(null);
    setPast([]); setFuture([]);
  }, []);

  const setFormValue = useCallback((srcKey, name, value) => {
    pushHistory();
    setFormValues((f) => ({ ...f, [srcKey]: { ...(f[srcKey] || {}), [name]: value } }));
    setDirty(true);
  }, [pushHistory]);

  const openBytes = useCallback(async (data, name) => {
    setError('');
    setLoading(true);
    try {
      const canonical = data instanceof Uint8Array ? data : new Uint8Array(data);
      let doc;
      try {
        doc = await loadDocument(canonical.slice());
      } catch (e) {
        if (e?.name === 'PasswordException') { setLocked({ bytes: canonical, name: name || 'document.pdf' }); return; }
        throw e;
      }
      const key = 's0';
      const items = Array.from({ length: doc.numPages }, (_, i) => ({ id: nextId(), srcKey: key, index: i, rotation: 0 }));
      setSources({ [key]: { bytes: canonical, doc, name: name || 'document.pdf' } });
      setPages(items);
      setFileName(name || 'document.pdf');
      setDirty(false);
      setLocked(null);
      clearHistory();
      navigate('/edit');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [navigate, clearHistory]);

  // Decrypt a locked PDF with the supplied password, then open the plain bytes.
  const unlockWithPassword = useCallback(async (password) => {
    if (!locked) return;
    setUnlocking(true);
    setError('');
    try {
      const plain = await decryptBytes(locked.bytes, password);
      const name = locked.name;
      setLocked(null);
      await openBytes(plain, name);
    } catch {
      setError(i18n.t('home.errorPassword'));
    } finally {
      setUnlocking(false);
    }
  }, [locked, openBytes]);

  const cancelUnlock = useCallback(() => { setLocked(null); setError(''); }, []);

  const openFile = useCallback(async (file) => {
    if (!isPdf(file)) { setError(i18n.t('home.errorType')); return; }
    const data = await readFileBytes(file);
    await openBytes(data, file.name);
  }, [openBytes]);

  // Build a PDF from image files (one per page) and open it.
  const importImages = useCallback(async (files) => {
    const imgs = [...files].filter(isImage);
    if (!imgs.length) { setError(i18n.t('home.errorImage')); return; }
    setError('');
    setLoading(true);
    try {
      const bytes = await imagesToPdf(imgs);
      await openBytes(bytes, 'images.pdf');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [openBytes]);

  // Merge another PDF's pages onto the end of the model.
  const mergeFile = useCallback(async (file) => {
    if (!isPdf(file)) { setError(i18n.t('home.errorType')); return; }
    const data = await readFileBytes(file);
    const canonical = new Uint8Array(data);
    const doc = await loadDocument(canonical.slice());
    const key = `s${Date.now()}`;
    const items = Array.from({ length: doc.numPages }, (_, i) => ({ id: nextId(), srcKey: key, index: i, rotation: 0 }));
    pushHistory();
    setSources((s) => ({ ...s, [key]: { bytes: canonical, doc, name: file.name } }));
    setPages((p) => [...p, ...items]);
    setDirty(true);
  }, [pushHistory]);

  const rotatePages = useCallback((ids, delta = 90) => {
    const set = new Set(ids);
    pushHistory();
    setPages((p) => p.map((pg) => (set.has(pg.id) ? { ...pg, rotation: (pg.rotation + delta + 360) % 360 } : pg)));
    setDirty(true);
  }, [pushHistory]);

  const deletePages = useCallback((ids) => {
    const set = new Set(ids);
    pushHistory();
    setPages((p) => (p.length - set.size < 1 ? p : p.filter((pg) => !set.has(pg.id))));
    setDirty(true);
  }, [pushHistory]);

  const duplicatePages = useCallback((ids) => {
    const set = new Set(ids);
    pushHistory();
    setPages((p) => {
      const out = [];
      for (const pg of p) {
        out.push(pg);
        if (set.has(pg.id)) out.push({ ...pg, id: nextId() });
      }
      return out;
    });
    setDirty(true);
  }, [pushHistory]);

  // Reorder to an explicit new list of page ids.
  const reorderPages = useCallback((orderedIds) => {
    pushHistory();
    setPages((p) => {
      const byId = new Map(p.map((pg) => [pg.id, pg]));
      const next = orderedIds.map((id) => byId.get(id)).filter(Boolean);
      return next.length === p.length ? next : p;
    });
    setDirty(true);
  }, [pushHistory]);

  // --- annotations (coords normalized 0..1 to the displayed page box) ---
  const addAnnotation = useCallback((pageId, ann) => {
    const withId = { id: nextId(), ...ann };
    pushHistory();
    setAnnotations((a) => ({ ...a, [pageId]: [...(a[pageId] || []), withId] }));
    setDirty(true);
    return withId.id;
  }, [pushHistory]);
  const updateAnnotation = useCallback((pageId, id, patch) => {
    setAnnotations((a) => ({ ...a, [pageId]: (a[pageId] || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    setDirty(true);
  }, []);
  const removeAnnotation = useCallback((pageId, id) => {
    pushHistory();
    setAnnotations((a) => ({ ...a, [pageId]: (a[pageId] || []).filter((x) => x.id !== id) }));
    setDirty(true);
  }, [pushHistory]);
  // Replace all annotations of a given type across pages (used by watermark and
  // page-number stamps). `byPageId` maps a page id to the new annotations for it.
  const applyStamps = useCallback((type, byPageId) => {
    pushHistory();
    setAnnotations((prev) => {
      const next = { ...prev };
      const ids = new Set([...Object.keys(prev), ...Object.keys(byPageId)]);
      for (const pid of ids) {
        const kept = (prev[pid] || []).filter((a) => a.type !== type);
        const add = (byPageId[pid] || []).map((a) => ({ id: nextId(), ...a }));
        next[pid] = [...kept, ...add];
      }
      return next;
    });
    setDirty(true);
  }, [pushHistory]);

  // Replace the invisible OCR text layer for a page (drops any prior 'otext').
  const setOcrLayer = useCallback((pageId, items) => {
    setAnnotations((a) => ({
      ...a,
      [pageId]: [...(a[pageId] || []).filter((x) => x.type !== 'otext'), ...items.map((it) => ({ id: nextId(), type: 'otext', ...it }))],
    }));
    setDirty(true);
  }, []);

  const close = useCallback(() => { reset(); navigate('/'); }, [reset, navigate]);

  const value = {
    sources, pages, fileName, loading, error, dirty, setError, setDirty,
    locked, unlocking, unlockWithPassword, cancelUnlock,
    openFile, openBytes, mergeFile, importImages, rotatePages, deletePages, duplicatePages, reorderPages, close,
    annotations, addAnnotation, updateAnnotation, removeAnnotation, setOcrLayer, applyStamps,
    formValues, setFormValue,
    undo, redo, canUndo: past.length > 0, canRedo: future.length > 0,
    numPages: pages.length,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
