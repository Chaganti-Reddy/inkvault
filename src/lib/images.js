// Build a PDF from image files, one image per page. JPEG/PNG embed directly; other
// formats (webp, gif, bmp) are converted to PNG via a canvas first. All in-browser.
import { PDFDocument } from '@cantoo/pdf-lib';

function readBytes(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result));
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

function toPngBytes(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const b64 = canvas.toDataURL('image/png').split(',')[1];
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      resolve(arr);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

export async function imagesToPdf(files) {
  const doc = await PDFDocument.create();
  for (const file of files) {
    const isJpg = /jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name);
    const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name);
    let img;
    if (isJpg) img = await doc.embedJpg(await readBytes(file));
    else if (isPng) img = await doc.embedPng(await readBytes(file));
    else img = await doc.embedPng(await toPngBytes(file));
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return doc.save();
}

export function isImage(file) {
  return file && (/^image\//.test(file.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name));
}
