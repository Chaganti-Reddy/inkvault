// Password-protect a PDF (standard encryption) using the @cantoo/pdf-lib fork,
// which adds an `encrypt` method the base pdf-lib lacks. Runs entirely in the
// browser — the password and document never leave the device.
import { PDFDocument } from '@cantoo/pdf-lib';

export async function protectBytes(baseBytes, password) {
  const doc = await PDFDocument.load(baseBytes.slice(), { ignoreEncryption: true });
  doc.encrypt({ userPassword: password, ownerPassword: password });
  return doc.save();
}

// Decrypt a password-protected PDF into plain bytes so the rest of the app (pdf.js
// and base pdf-lib) can work with it normally. Throws if the password is wrong.
export async function decryptBytes(bytes, password) {
  const doc = await PDFDocument.load(bytes.slice(), { password });
  return doc.save();
}
