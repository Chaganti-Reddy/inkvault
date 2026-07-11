# Architecture

InkVault is a single-page React app with no backend. This document explains how the pieces fit together and why the design keeps everything on the user's device.

## The document model

The open document is not a single file handle — it is an ordered list of **page items**, held in `PdfContext`. Each item points at a source PDF (by key), a page index within that source, and a rotation. Reorder, delete, rotate and duplicate simply edit this array, which is cheap and never re-parses anything. Merging another PDF adds a new source and appends its pages. Real PDF bytes are only rebuilt when the user exports.

This is why organize operations feel instant even on large PDFs: nothing is regenerated until the final Download.

## Rendering

`pdf.js` renders pages to `<canvas>` for the viewer, thumbnails, and the interactive layers. Rendering is lazy — each page renders the first time it scrolls near the viewport (via `IntersectionObserver`) and re-renders when width or rotation changes. Render tasks are cancelled on unmount to avoid the "cannot use the same canvas" error under React Strict Mode double-invocation.

## Coordinates

Everything the user draws (annotations, redaction boxes, OCR words) is stored in **normalized coordinates** — fractions of the displayed page box, origin top-left. This makes the data independent of zoom and of the on-screen render size.

At export time those normalized coordinates are mapped into pdf-lib user space (origin bottom-left, y-up), inverting each page's clockwise `/Rotate` value. The mapping handles all four rotations (0, 90, 180, 270) for rectangles, lines, text and images, so annotations land correctly even on rotated pages.

## Export pipeline

`buildPdf(pages, sources, annotations, formValues)` in `src/lib/pdfops.js` produces the final bytes with pdf-lib:

1. Each source is loaded once. If the user filled form fields for a source, those values are applied and the form is flattened so they bake into the page content and survive page copying.
2. For every page item, the page is copied from its source and its rotation is set.
3. Annotations for that page are drawn: highlights and rectangles as vector shapes, pen strokes as line segments, text with the base font, signatures as embedded images, and OCR results as invisible (fully transparent) text for search and copy.
4. Pages carrying a redaction box are handled differently (see below).

## True redaction

Covering text with a black rectangle is not redaction — the text still sits underneath and is trivially recoverable. InkVault instead **rasterizes** any page that has a redaction box: the page is rendered to an image at 150 DPI, the boxes are painted over the pixels, and the flattened image replaces the page. The original text and vector content no longer exist in the output. Pages without redactions stay as vector PDF, so only what you redact loses its text layer.

## OCR

`tesseract.js` recognizes text from a rasterized page image and returns words with bounding boxes. Each word becomes an invisible text annotation positioned over the scan, so the exported PDF looks identical but is now searchable and selectable. The engine is loaded lazily and only when the user runs OCR; the document image is processed in-browser and never uploaded.

## Password protection

Base pdf-lib cannot encrypt, so the Protect tool uses `@cantoo/pdf-lib`, an API-compatible fork that adds standard PDF encryption. The edited document is built first, then encrypted with the user's password. Opening a password-protected PDF is the same idea in reverse: pdf.js reports a password is required, InkVault prompts for it, and both pdf.js and pdf-lib load the source with that password.

## Why no backend

There is nothing a server would add except a place for files to leak. pdf.js, pdf-lib and tesseract.js all run in the browser, so parsing, editing, OCR and encryption happen locally. The app ships as static files and can be hosted anywhere. The only outbound requests are for the OCR engine's static assets on first use, which are public and contain no user data.
