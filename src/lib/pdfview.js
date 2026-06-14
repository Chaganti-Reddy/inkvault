// Thin wrapper around pdf.js for on-screen rendering. All parsing happens in a
// Web Worker in the user's browser — nothing is uploaded.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Load a document from raw bytes. Pass a *copy* of the bytes if you also intend
// to hand the same buffer to pdf-lib — pdf.js transfers/detaches the buffer.
export async function loadDocument(data) {
  const task = pdfjs.getDocument({ data });
  return task.promise;
}

// Render one page onto a canvas at the given CSS width, accounting for devicePixelRatio
// so text stays crisp on high-DPI screens. Returns the rendered { width, height } in CSS px.
export async function renderPage(doc, pageNumber, cssWidth, canvas) {
  const page = await doc.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = cssWidth / unscaled.width;
  const viewport = page.getViewport({ scale });
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { width: viewport.width, height: viewport.height };
}

export function readFileBytes(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function isPdf(file) {
  return file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
}
