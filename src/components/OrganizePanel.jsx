import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import PageThumb from './PageThumb.jsx';
import { extractPdf, downloadBytes } from '../lib/pdfops.js';
import { FiRotateCw, FiTrash2, FiLayers, FiDownload, FiCopy, FiCheckSquare } from '../ui/icons.js';

export default function OrganizePanel() {
  const { t } = useTranslation();
  const { pages, sources, fileName, rotatePages, deletePages, duplicatePages, reorderPages, mergeFile } = usePdf();
  const [selected, setSelected] = useState(() => new Set());
  const [lastId, setLastId] = useState(null);
  const [dragIds, setDragIds] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { id, side }
  const mergeRef = useRef(null);

  const ids = pages.map((p) => p.id);
  const targetIds = () => (selected.size ? [...selected] : ids); // act on selection, else all

  const select = (id, e) => {
    const next = new Set(selected);
    if (e.shiftKey && lastId) {
      const a = ids.indexOf(lastId); const b = ids.indexOf(id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      for (let i = lo; i <= hi; i++) next.add(ids[i]);
    } else if (e.ctrlKey || e.metaKey) {
      if (next.has(id)) next.delete(id); else next.add(id);
    } else {
      next.clear(); next.add(id);
    }
    setSelected(next);
    setLastId(id);
  };

  const selectAll = () => setSelected(new Set(selected.size === ids.length ? [] : ids));

  // --- drag to reorder ---
  const onDragStart = (id) => setDragIds(selected.has(id) && selected.size ? [...selected] : [id]);
  const onDragOver = (id, e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
    setDropTarget({ id, side });
  };
  const onDrop = (targetId, e) => {
    e.preventDefault();
    if (!dragIds) return;
    const moving = new Set(dragIds);
    const rest = ids.filter((x) => !moving.has(x));
    let pos = rest.indexOf(targetId);
    if (dropTarget?.side === 'right') pos += 1;
    if (pos < 0) pos = rest.length;
    const next = [...rest.slice(0, pos), ...dragIds, ...rest.slice(pos)];
    reorderPages(next);
    setDragIds(null); setDropTarget(null);
  };
  const onDragEnd = () => { setDragIds(null); setDropTarget(null); };

  const doExtract = async () => {
    const sel = selected.size ? [...selected] : ids;
    const bytes = await extractPdf(pages, sources, sel);
    downloadBytes(bytes, fileName.replace(/\.pdf$/i, '') + '-extract.pdf');
  };

  const selCount = selected.size;
  const scopeLabel = selCount ? t('organize.selected', { n: selCount }) : t('organize.allPages', { n: ids.length });

  return (
    <div className="organize">
      <div className="organize-bar">
        <span className="scope">{scopeLabel}</span>
        <div className="spacer" />
        <button className="btn sm" onClick={selectAll}><FiCheckSquare /> {selCount === ids.length && selCount ? t('organize.selectNone') : t('organize.selectAll')}</button>
        <button className="btn sm" onClick={() => rotatePages(targetIds())}><FiRotateCw /> {t('organize.rotate')}</button>
        <button className="btn sm" onClick={() => duplicatePages(targetIds())}><FiCopy /> {t('organize.duplicate')}</button>
        <button className="btn sm" disabled={!selCount} onClick={() => { deletePages([...selected]); setSelected(new Set()); }}><FiTrash2 /> {t('organize.delete')}</button>
        <button className="btn sm" onClick={() => mergeRef.current?.click()}><FiLayers /> {t('organize.merge')}</button>
        <button className="btn sm" onClick={doExtract}><FiDownload /> {t('organize.extract')}</button>
        <input ref={mergeRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) mergeFile(f); e.target.value = ''; }} />
      </div>

      <div className="thumb-grid">
        {pages.map((pg, i) => (
          <PageThumb
            key={pg.id}
            page={pg}
            source={sources[pg.srcKey]}
            number={i + 1}
            selected={selected.has(pg.id)}
            dropSide={dropTarget?.id === pg.id ? dropTarget.side : null}
            onSelect={select}
            onRotate={(id) => rotatePages([id])}
            onDelete={(id) => { deletePages([id]); setSelected((s) => { const n = new Set(s); n.delete(id); return n; }); }}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}
