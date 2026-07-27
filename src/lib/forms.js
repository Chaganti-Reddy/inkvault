// Form filling via pdf-lib. Values are applied to a document's AcroForm and then
// flattened (appearances baked into the page, interactivity removed) so the result
// survives page copying/merging in the export pipeline.
//
// Baking is UNCONDITIONAL when a source carries form fields: even with no edits we
// still flatten so the page keeps a correct, self-contained appearance instead of
// copying orphaned widget annotations without their AcroForm into the output.
import { PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList } from '@cantoo/pdf-lib';

// Apply `values` ({ fieldName: string | boolean | string[] }) to the doc's form,
// then flatten. `font` regenerates appearances so non-Latin values render (and so
// flatten doesn't fall back to a WinAnsi-only font that throws on such glyphs).
//
// A field NAME PRESENT in `values` is applied even when its value is empty (this is
// how a pre-filled field is cleared); a name ABSENT from `values` is left untouched.
// Returns true if the doc had a form to bake.
export function bakeForm(doc, values = {}, font) {
  let form;
  try { form = doc.getForm(); } catch { return false; }
  const fields = form.getFields();
  if (!fields.length) return false;

  const byName = new Map(fields.map((f) => [f.getName(), f]));
  for (const [name, val] of Object.entries(values || {})) {
    const field = byName.get(name);
    if (!field) continue;
    try {
      if (field instanceof PDFTextField) {
        let s = val == null ? '' : String(val);
        const max = field.getMaxLength?.();
        if (max != null && s.length > max) s = s.slice(0, max);
        field.setText(s === '' ? undefined : s);
      } else if (field instanceof PDFCheckBox) {
        val ? field.check() : field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        if (val == null || val === '') field.clear?.();
        else field.select(String(val));
      } else if (field instanceof PDFDropdown) {
        if (val == null || val === '') field.clear?.();
        else field.select(String(val));
      } else if (field instanceof PDFOptionList) {
        const arr = Array.isArray(val) ? val.map(String) : (val == null || val === '' ? [] : [String(val)]);
        field.clear?.();
        if (arr.length) field.select(arr);
      }
    } catch { /* value/option mismatch — skip that field rather than fail the export */ }
  }

  // Regenerate every field's appearance with our Unicode font before flattening.
  // flatten() bakes whatever appearance streams exist; generating them here with a
  // font that has the needed glyphs avoids a silent WinAnsi encoding failure that
  // would otherwise abort the whole flatten.
  try { if (font) form.updateFieldAppearances(font); } catch { /* per-field fallback below */ }
  if (font) {
    for (const f of fields) { try { f.updateAppearances?.(font); } catch { /* leave field's own appearance */ } }
  }
  try { form.flatten(); } catch { /* nothing fillable / already flat */ }
  return true;
}
