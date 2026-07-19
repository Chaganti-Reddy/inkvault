# Changelog

All notable changes to InkVault are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

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
