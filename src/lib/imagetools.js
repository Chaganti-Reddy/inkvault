// Compress standalone images in the browser: optionally downscale to a max
// dimension, then re-encode as JPEG at the chosen quality. Returns blobs + sizes.
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

export async function compressImages(files, { quality = 0.7, maxDim = 2000 } = {}) {
  const out = [];
  for (const file of files) {
    const img = await loadImage(file);
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    out.push({ name: file.name.replace(/\.[^.]+$/, '') + '.jpg', blob, before: file.size, after: blob.size });
  }
  return out;
}
