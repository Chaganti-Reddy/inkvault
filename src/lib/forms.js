// Form filling via pdf-lib. Values are applied to a document's AcroForm and then
// flattened (appearances baked into the page, interactivity removed) so the result
// survives page copying/merging in the export pipeline.
import { PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList } from 'pdf-lib';

// values: { fieldName: string | boolean }. Returns true if anything was applied.
export function applyFormValues(doc, values) {
  if (!values || !Object.keys(values).length) return false;
  const form = doc.getForm();
  const byName = new Map(form.getFields().map((f) => [f.getName(), f]));
  let applied = false;
  for (const [name, val] of Object.entries(values)) {
    const field = byName.get(name);
    if (field == null || val == null || val === '') continue;
    try {
      if (field instanceof PDFTextField) field.setText(String(val));
      else if (field instanceof PDFCheckBox) { if (val) field.check(); else field.uncheck(); }
      else if (field instanceof PDFRadioGroup) field.select(String(val));
      else if (field instanceof PDFDropdown) field.select(String(val));
      else if (field instanceof PDFOptionList) field.select(String(val));
      applied = true;
    } catch { /* option/value mismatch — skip that field rather than fail the export */ }
  }
  return applied;
}

export function flattenForm(doc) {
  try { doc.getForm().flatten(); } catch { /* no form / already flat */ }
}
