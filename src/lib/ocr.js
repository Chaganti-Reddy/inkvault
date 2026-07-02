// OCR via tesseract.js, loaded lazily (it's heavy) only when the user runs it.
// The page image is processed on-device; the document itself is never uploaded.
// The recognition engine + language data download once from a public CDN, like any
// other static asset.
let cachedModule = null;

async function tesseract() {
  if (!cachedModule) cachedModule = (await import('tesseract.js')).default;
  return cachedModule;
}

// Create a recognizer bound to a language. `onStatus` receives tesseract progress
// events ({ status, progress }). Reuse across pages, then terminate().
export async function createRecognizer(lang, onStatus) {
  const T = await tesseract();
  const worker = await T.createWorker(lang, 1, { logger: (m) => onStatus?.(m) });
  return {
    // tesseract.js v6+ only returns the word hierarchy when `blocks` output is
    // requested; `data.words` is otherwise empty. Flatten blocks → paragraphs →
    // lines → words.
    recognize: async (canvas) => {
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      const words = [];
      for (const block of data.blocks || []) {
        for (const para of block.paragraphs || []) {
          for (const line of para.lines || []) {
            for (const w of line.words || []) {
              if (w.text && w.text.trim()) words.push(w);
            }
          }
        }
      }
      return words;
    },
    terminate: () => worker.terminate(),
  };
}

export const OCR_LANGS = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'por', label: 'Portuguese' },
  { code: 'ita', label: 'Italian' },
  { code: 'hin', label: 'Hindi' },
];
