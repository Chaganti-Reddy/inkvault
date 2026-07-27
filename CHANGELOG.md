# Changelog

All notable changes to InkVault are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## [1.4.0]

- **PDF → images** — export every page as JPG or PNG (screen/good/print quality) in a single zip.
- **Split into files** — save each page as its own PDF, bundled in a zip.
- **Faster start** — the home tool cards now open a file and jump straight into that tool.

## [1.3.0]

- **Crop** — draw a box on any page to crop it to that area (applied as the PDF CropBox on export).
- **Unicode text** — annotations, watermarks and page numbers now render non-Latin scripts (Latin-extended, Cyrillic, Greek and more) via an embedded Noto Sans font.
- **Keyboard** — ⌘/Ctrl+S downloads the current document.

## [1.2.0]

- **More annotation tools** — lines, arrows, ellipses and whiteout, alongside text, highlighter, pen, rectangles and signatures.
- **Organize** — insert blank pages, reverse page order, and export an arbitrary page range (e.g. `1-3, 5`).
- **Document properties** — view and edit title, author, subject and keywords; prefilled from the file, baked on export.
- **Protect** — optional open password plus restrictions on printing, copying and editing.
- Annotations now also render in the read-only View tab; pages fit the window width; the editor layout is locked so only the document scrolls.

## [1.1.0]

- **Undo/redo** across page, annotation, stamp and form edits, with ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z (or Ctrl+Y).
- **Stamp** tool — diagonal watermarks and page numbers (several formats and positions), aligned using real font metrics.
- **Extract text** — save all selectable text, including OCR output, to a `.txt` file.
- **Open password-protected PDFs** — prompts for the password and unlocks locally.
- **Installable PWA** — a service worker precaches the app so it works fully offline after the first visit.

## [1.0.0]

First public release. A complete, 100% client-side PDF studio.

- **Organize** — merge, split, reorder by drag and drop, rotate, delete and duplicate pages.
- **Annotate & sign** — text, highlighter, freehand pen, rectangles, and signatures by drawing, typing or uploading an image.
- **Redact** — draw boxes that permanently remove the underlying content by flattening the affected page to an image on export.
- **Fill forms** — complete AcroForm fields (text, checkbox, radio, dropdown) and flatten them into the page.
- **OCR** — add an invisible searchable text layer to scanned or image-only PDFs in 100+ languages via tesseract.js.
- **Compress** — reduce file size with a quality dial and live before/after comparison.
- **Protect** — password-encrypt PDFs, and open password-protected PDFs for editing.
- **Images → PDF** — build a PDF from dropped or selected images, one per page.
- Light and dark themes, fully internationalized strings, keyboard-friendly, no telemetry.
