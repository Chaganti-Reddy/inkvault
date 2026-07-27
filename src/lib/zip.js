// Bundle files into a .zip and download it. files: [{ name, data }] where data is
// a Blob or Uint8Array. Uses JSZip, entirely in the browser.
import JSZip from 'jszip';

export async function downloadZip(files, zipName) {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.data);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName || 'inkvault.zip';
  a.click();
  URL.revokeObjectURL(url);
}
