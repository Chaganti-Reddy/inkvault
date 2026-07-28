# Changelog

All notable changes to InkVault are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## [1.9.0]

- **Smarter compression (re-optimization)** — compression now recompresses and downscales the embedded JPEG images inside a PDF while leaving text and vector content untouched, and never rasterizes a document that has selectable text (so text PDFs keep their text). Only true scans are re-rendered as images. Masked and CMYK images are left intact to avoid corruption, and the result is never larger than the original.
- **Smaller exports** — the Unicode font is only embedded when the document actually draws text, watermarks or page numbers, so plain, redacted and form-only exports no longer carry unused font data.
- **Better form filling** — read-only fields are shown locked, text fields honour their maximum length, required fields are marked, password fields are masked, and combo boxes, multi-select list boxes and dropdowns each behave correctly. Drawn fields can be given a name in the toolbar.
- **Annotations reworked** — every object (including pen strokes, lines and arrows) can now be selected, moved, nudged with the arrow keys and resized with handles; lines and arrows have draggable endpoints and signatures resize with a locked aspect ratio. Changing the colour or size while something is selected edits that object, not just the next one.
- **Correct stacking** — annotations now paint on screen in the same order they export, so what you see is what you get.
- **Highlighter colours** — the highlighter respects the chosen colour (with a one-click yellow), and each arrow keeps its own colour in every view.
- **Text tool fixes** — new text boxes focus immediately, no longer spawn duplicates, keep line breaks, and empty boxes are discarded.
- **Form data-loss fixes** — forms flatten correctly even when opened and exported without edits, pre-filled fields can now be cleared, non-Latin values and over-length values no longer vanish, and form fields drawn on a redacted page are kept. Drawn fields sit upright on rotated pages and checkboxes centre in the drawn box.

## [1.8.0]

- **Zoom everywhere** — the zoom in/out and fit-to-width controls now work in every page tool (Annotate, Crop, Redact, Fill forms and Build form), not just View. Pages auto-fit the window on open and scroll horizontally when zoomed past the edge.

## [1.7.4]

- **Thumbnail nav** — the View tab side rail now shows real page previews instead of plain numbers.

## [1.7.3]

- **Smarter compression** — keeps selectable text on text PDFs (only rasterizes when that's genuinely smaller) and never produces a file larger than the original.

## [1.7.2]

- **Editor-grade undo** — moving or editing an annotation is now its own undo step (undo restores the position/text instead of deleting it), and typing in a form field collapses into a single step per field.
- **Glyph-exact redact-by-search** — match boxes track real character widths (measured), not an even-width estimate.
- Fixed a React warning when a dropdown field's value was an array.

## [1.7.1]

- **Undo now covers Apply** — undo/redo snapshots the whole document, so any chain step (including baking edits with Apply) can be undone.
- **Live preview in View** — watermarks, page numbers, form fields and crop boxes now show in the View tab before you export.

## [1.7.0]

- **Apply** — bake the current edits into the working document in place, then keep editing the result. Chain operations freely: watermark → Apply → split the watermarked pages → crop one → and so on, all without leaving the app.

## [1.6.0]

- **Redact by search** — type a word or phrase and every occurrence across the document is marked for redaction automatically.
- **Build form** — draw text fields and checkboxes onto pages; they export as real, fillable AcroForm fields.

## [1.5.0]

- **Scan to PDF** — capture pages from your camera and turn them into a PDF.
- **Compress images** — shrink standalone JPG/PNG images (downscale + re-encode), bundled as a zip.
- **Per-page actions** — extract any single page as a PDF or save it as an image, right from the thumbnail.
- **Grayscale** — a grayscale option when compressing.
- **Page-jump rail** in the View tab, **toast notifications** for saves and errors, and **drop a file anywhere** on the home screen.

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
