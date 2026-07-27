import { useEffect, useRef, useState } from 'react';
import { renderPage } from '../lib/pdfview.js';
import { FiRotateCw, FiTrash2, FiDownload, FiImage } from '../ui/icons.js';

const THUMB_WIDTH = 150;

export default function PageThumb({
  page, source, number, selected, dropSide,
  onSelect, onRotate, onDelete, onExtract, onToImage,
  onDragStart, onDragOver, onDrop, onDragEnd,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setSeen(true)),
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || !source) return;
    let cancelled = false;
    (async () => {
      try { if (!cancelled) await renderPage(source.doc, page.index + 1, THUMB_WIDTH, canvasRef.current, page.rotation); }
      catch { /* ignore cancelled render */ }
    })();
    return () => { cancelled = true; };
  }, [seen, source, page.index, page.rotation]);

  return (
    <div
      ref={wrapRef}
      className={`thumb ${selected ? 'sel' : ''} ${dropSide ? `drop-${dropSide}` : ''}`}
      draggable
      onClick={(e) => onSelect(page.id, e)}
      onDragStart={(e) => onDragStart(page.id, e)}
      onDragOver={(e) => onDragOver(page.id, e)}
      onDrop={(e) => onDrop(page.id, e)}
      onDragEnd={onDragEnd}
    >
      <div className="thumb-canvas-wrap">
        <canvas ref={canvasRef} className="thumb-canvas" />
      </div>
      <div className="thumb-bar">
        <span className="thumb-num">{number}</span>
        <span className="thumb-actions">
          <button className="thumb-btn" title="Rotate" onClick={(e) => { e.stopPropagation(); onRotate(page.id); }}><FiRotateCw /></button>
          <button className="thumb-btn" title="Extract page as PDF" onClick={(e) => { e.stopPropagation(); onExtract(page.id); }}><FiDownload /></button>
          <button className="thumb-btn" title="Save page as image" onClick={(e) => { e.stopPropagation(); onToImage(page.id); }}><FiImage /></button>
          <button className="thumb-btn danger" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}><FiTrash2 /></button>
        </span>
      </div>
    </div>
  );
}
