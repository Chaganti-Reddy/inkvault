import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import PageThumb from './PageThumb.jsx';
import { extractPdf, downloadBytes, downloadBlob, renderPagesToImages } from '../lib/pdfops.js';
import { FiRotateCw, FiTrash2, FiLayers, FiDownload, FiCopy, FiCheckSquare, FiFilePlus, FiRepeat } from '../ui/icons.js';

// Parse "1-3,5,8" into zero-based page indices.
function parseRanges(str, total) {
  const out = new Set();
  for (const part of str.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const a = Math.max(1, parseInt(m[1], 10));
    const b = m[2] ? parseInt(m[2], 10) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= total) out.add(i - 1);
  }
  return [...out];
}

export default function OrganizePanel() {
  const { t } = useTranslation();
  const { pages, sources, annotations, formValues, metadata, fileName, rotatePages, deletePages, duplicatePages, reorderPages, mergeFile, insertBlankPage } = usePdf();
  const [rangeStr, setRangeStr] = useState('');
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
    const bytes = await extractPdf(pages, sources, sel, annotations, formValues);
    downloadBytes(bytes, fileName.replace(/\.pdf$/i, '') + '-extract.pdf');
  };

  const doSplit = async () => {
    const idx = parseRanges(rangeStr, pages.length);
    if (!idx.length) return;
    const rangeIds = idx.map((i) => pages[i].id);
    const bytes = await extractPdf(pages, sources, rangeIds, annotations, formValues);
    downloadBytes(bytes, fileName.replace(/\.pdf$/i, '') + `-pages-${rangeStr.replace(/[^0-9,-]/g, '')}.pdf`);
  };

  const reverse = () => reorderPages([...ids].reverse());

  const base = (fileName || 'document').replace(/\.pdf$/i, '');
  const extractOne = async (id) => {
    const n = ids.indexOf(id) + 1;
    const bytes = await extractPdf(pages, sources, [id], annotations, formValues, metadata);
    downloadBytes(bytes, `${base}-page-${n}.pdf`);
  };
  const imageOne = async (id) => {
    const n = ids.indexOf(id) + 1;
    const pg = pages.find((p) => p.id === id);
    const imgs = await renderPagesToImages([pg], sources, annotations, formValues, metadata, { format: 'png', dpi: 150 });
    downloadBlob(imgs[0].data, `${base}-page-${n}.png`);
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
        <button className="btn sm" onClick={reverse}><FiRepeat /> {t('organize.reverse')}</button>
        <button className="btn sm" onClick={insertBlankPage}><FiFilePlus /> {t('organize.blank')}</button>
        <button className="btn sm" onClick={() => mergeRef.current?.click()}><FiLayers /> {t('organize.merge')}</button>
        <button className="btn sm" onClick={doExtract}><FiDownload /> {t('organize.extract')}</button>
        <span className="split-box">
          <input className="range-input" value={rangeStr} onChange={(e) => setRangeStr(e.target.value)} placeholder={t('organize.rangePlaceholder')} />
          <button className="btn sm" disabled={!rangeStr.trim()} onClick={doSplit}>{t('organize.split')}</button>
        </span>
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
            onExtract={extractOne}
            onToImage={imageOne}
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
