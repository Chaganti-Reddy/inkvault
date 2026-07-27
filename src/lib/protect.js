// Password-protect a PDF (standard encryption) using the @cantoo/pdf-lib fork,
// which adds an `encrypt` method the base pdf-lib lacks. Runs entirely in the
// browser — the password and document never leave the device.
import { PDFDocument } from '@cantoo/pdf-lib';

// Encrypt with an optional open password and optional usage restrictions.
// restrict: { print, copy, edit } — true means "prevent this action".
export async function protectBytes(baseBytes, { userPassword = '', restrict = {} } = {}) {
  const doc = await PDFDocument.load(baseBytes.slice(), { ignoreEncryption: true });
  // Encryption needs a non-empty owner password; if the user only restricts (no open
  // password) we use a random owner secret they never need to type.
  const ownerPassword = userPassword || (crypto.randomUUID?.() ?? String(Math.random()));
  doc.encrypt({
    userPassword,
    ownerPassword,
    permissions: {
      printing: restrict.print ? undefined : 'highResolution',
      copying: !restrict.copy,
      modifying: !restrict.edit,
      annotating: !restrict.edit,
      fillingForms: !restrict.edit,
      contentAccessibility: true,
      documentAssembly: !restrict.edit,
    },
  });
  return doc.save();
}

// Decrypt a password-protected PDF into plain bytes so the rest of the app (pdf.js
// and base pdf-lib) can work with it normally. Throws if the password is wrong.
export async function decryptBytes(bytes, password) {
  const doc = await PDFDocument.load(bytes.slice(), { password });
  return doc.save();
}
